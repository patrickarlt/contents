import _ from './util.js';
import Sister from 'sister';

let Contents;

/**
 * @param {object} config
 * @return {Contents}
 */
Contents = config => {
    let articles,
        contents,
        eventEmitter,
        instanceConfig,
        list,
        tree;

    contents = {};

    eventEmitter = Sister();

    instanceConfig = Contents.config(config);

    articles = Contents.articles(instanceConfig.articles, instanceConfig.articleName, instanceConfig.articleId);
    tree = Contents.tree(articles);
    list = Contents.list(tree, instanceConfig.link);

    Contents.bind(eventEmitter, list, instanceConfig);

    /**
     * @return {HTMLElement} Ordered list element representation of the table of contents.
     */
    contents.list = () => {
        return list;
    };

    /**
     * @return {array} Array representation of the table of contents.
     */
    contents.tree = () => {
        return tree;
    };

    /**
     * @return {Sister} Event emitter used to attach event listeners and trigger events.
     */
    contents.eventEmitter = () => {
        return eventEmitter;
    };

    return contents;
};

/**
 * Setups event listeners to reflect changes to the table of contents and user navigation.
 *
 * @param {Sister} eventEmitter
 * @param {HTMLElement} list Table of contents root element (<ol>).
 * @param {object} config Result of contents.config.
 * @return {object} Result of contents.eventEmitter.
 */
Contents.bind = (eventEmitter, list, config) => {
    let articleOffsetIndex,
        guides,
        lastArticleIndex,
        windowHeight;

    lastArticleIndex = null;

    guides = list.querySelectorAll('li');

    eventEmitter.on('resize', () => {
        windowHeight = Contents.windowHeight();
        articleOffsetIndex = Contents.indexOffset(config.articles);

        eventEmitter.trigger('scroll');
    });

    eventEmitter.on('scroll', () => {
        let articleIndex,
            changeEvent;

        articleIndex = Contents.getIndexOfClosestValue(Contents.windowScrollY() + windowHeight * 0.2, articleOffsetIndex);

        if (articleIndex !== lastArticleIndex) {
            changeEvent = {};

            changeEvent.current = {
                article: config.articles[articleIndex],
                guide: guides[articleIndex]
            };

            if (lastArticleIndex !== null) {
                changeEvent.previous = {
                    article: config.articles[lastArticleIndex],
                    guide: guides[lastArticleIndex]
                };
            }

            eventEmitter.trigger('change', changeEvent);

            lastArticleIndex = articleIndex;
        }
    });

    // This allows the script that constructs Contents
    // to catch the first ready, resize and scroll events.
    setTimeout(() => {
        eventEmitter.trigger('resize');
        eventEmitter.trigger('ready');

        global.addEventListener('resize', Contents.throttle(() => {
            eventEmitter.trigger('resize');
        }, 100));

        global.addEventListener('scroll', Contents.throttle(() => {
            eventEmitter.trigger('scroll');
        }, 100));
    }, 10);
};

/**
 * @return {Number}
 */
Contents.windowHeight = () => {
    return global.innerHeight || global.document.documentElement.clientHeight;
};

/**
 * @return {Number}
 */
Contents.windowScrollY = () => {
    return global.pageYOffset || global.document.documentElement.scrollTop;
};

/**
 * Interpret execution configuration.
 *
 * @param {Object} userConfig
 * @return {Object}
 */
Contents.config = (userConfig = {}) => {
    let defaultConfig,
        difference,
        instanceConfig,
        properties;

    properties = [
        'articles',
        'articleName',
        'articleId',
        'link'
    ];

    difference = _.difference(Object.keys(userConfig), properties);

    if (difference.length) {
        throw new Error(`Unknown configuration property "${difference[0]}".`);
    }

    defaultConfig = {
        articles: global.document.querySelectorAll('h1, h2, h3, h4, h5, h6'),
        articleName: Contents.articleName,
        articleId: Contents.articleId,
        link: Contents.link
    };

    instanceConfig = _.assign({}, defaultConfig, userConfig);

    if (!instanceConfig.articles.length || !(instanceConfig.articles[0] instanceof HTMLElement)) {
        throw new Error('Option "articles" is not a collection of HTMLElement objects.');
    }

    if (typeof instanceConfig.articleName !== 'function') {
        throw new Error('Option "articleName" must be a function.');
    }

    if (typeof instanceConfig.articleId !== 'function') {
        throw new Error('Option "articleId" must be a function.');
    }

    if (typeof instanceConfig.link !== 'function') {
        throw new Error('Option "link" must be a function.');
    }

    return instanceConfig;
};

/**
 * Derive article name.
 *
 * This method can be overwritten using config.articleName.
 *
 * @param {HTMLElement} element
 * @return {String}
 */
Contents.articleName = element => {
    return element.innerText || element.textContent;
};

/**
 * Derive article ID.
 *
 * This method can be overwritten using config.articleId.
 *
 * @param {String} articleName
 * @param {HTMLElement} element
 * @return {String}
 */
Contents.articleId = (articleName, element) => {
    return element.id || articleName;
};

/**
 * Make element ID unique in the context of the document.
 *
 * @param {String} inputId
 * @param {Array} existingIDs Existing IDs in the document. Required for markup-contents. (https://github.com/gajus/markdown-contents)
 * @return {String}
 */
Contents.uniqueID = (inputId, existingIDs) => {
    let assignedId,
        formattedId,
        i;

    i = 1;

    formattedId = Contents.formatId(inputId);

    if (existingIDs) {
        assignedId = formattedId;

        while (existingIDs.indexOf(assignedId) !== -1) {
            assignedId = `${formattedId}-${i++}`;
        }

        existingIDs.push(assignedId);
    } else {
        if (!global.document) {
            throw new Error('No document context.');
        }

        assignedId = formattedId;

        while (global.document.querySelector(`#${assignedId}`)) {
            assignedId = `${formattedId}-${i++}`;
        }
    }

    return assignedId;
};

/**
 * Formats text into an ID/anchor safe value.
 *
 * @see http://stackoverflow.com/a/1077111/368691
 * @param {String} str
 * @return {String}
 */
Contents.formatId = str => {
    return str
        .toLowerCase()
        .replace(/[ãàáäâ]/g, 'a')
        .replace(/[ẽèéëê]/g, 'e')
        .replace(/[ìíïî]/g, 'i')
        .replace(/[õòóöô]/g, 'o')
        .replace(/[ùúüû]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-_]+/g, '-')
        .replace(/\-+/g, '-')
        .replace(/^\-|\-$/g, '')
        .replace(/^[^a-z]+/g, '');
};

/**
 * Generate flat index of the articles.
 *
 * @param {Array} elements
 * @param {Contents.articleName} articleName
 * @param {Contents.articleId} articleId
 * @return {Array}
 */
Contents.articles = (elements, articleName = Contents.articleName, articleId = Contents.articleId) => {
    return _.map(elements, element => {
        let article;

        article = {};

        article.level = Contents.level(element);
        article.name = articleName(element);
        article.id = articleId(article.name, element);
        article.element = element;

        return article;
    });
};

/**
 * Makes hierarchical index of the articles from a flat index.
 *
 * @param {Array} articles Generated using Contents.articles.
 * @param {Boolean} makeUniqueIDs
 * @param {Array} uniqueIDpool
 * @return {Array}
 */
Contents.tree = (articles, makeUniqueIDs, uniqueIDpool) => {
    let lastNode,
        rootNode,
        tree;

    rootNode = {
        descendants: [],
        level: 0
    };

    tree = rootNode.descendants;

    _.forEach(articles, article => {
        if (makeUniqueIDs) {
            article.id = Contents.uniqueID(article.id, uniqueIDpool);
        }
        article.descendants = [];

        if (!lastNode) {
            tree.push(article);
        } else if (lastNode.level === article.level) {
            Contents.tree.findParentNode(lastNode, rootNode).descendants.push(article);
        } else if (article.level > lastNode.level) {
            lastNode.descendants.push(article);
        } else {
            Contents.tree.findParentNodeWithLevelLower(lastNode, article.level, rootNode).descendants.push(article);
        }

        lastNode = article;
    });

    return tree;
};

/**
 * Find the object whose descendant is the needle object.
 *
 * @param {Object} needle
 * @param {Object} haystack
 * @return {HTMLElement}
 */
Contents.tree.findParentNode = (needle, haystack) => {
    let i,
        parent;

    if (haystack.descendants.indexOf(needle) !== -1) {
        return haystack;
    }

    i = haystack.descendants.length;

    while (i--) {
        parent = Contents.tree.findParentNode(needle, haystack.descendants[i]);

        if (parent) {
            return parent;
        }
    }

    throw new Error('Invalid tree.');
};

/**
 * Find the object whose descendant is the needle object.
 * Look for parent (including parents of the found object) with level lower than level.
 *
 * @param {Object} needle
 * @param {Number} level
 * @param {Object} haystack
 * @return {HTMLElement}
 */
Contents.tree.findParentNodeWithLevelLower = (needle, level, haystack) => {
    let parent;

    parent = Contents.tree.findParentNode(needle, haystack);

    if (parent.level < level) {
        return parent;
    } else {
        return Contents.tree.findParentNodeWithLevelLower(parent, level, haystack);
    }
};

/**
 * Generate ordered list from a tree (see tree) object.
 *
 * @param {Array} tree
 * @param {Function} link Used to customize the destination element in the list and the source element.
 * @return {HTMLElement}
 */
Contents.list = (tree, link) => {
    let list;

    list = global.document.createElement('ol');

    _.forEach(tree, article => {
        let li;

        li = global.document.createElement('li');

        if (link) {
            link(li, article);
        }

        if (article.descendants.length) {
            li.appendChild(Contents.list(article.descendants, link));
        }

        list.appendChild(li);
    });

    return list;
};

/**
 * This function is called after the table of contents is generated.
 * It is called for each article in the index.
 * Used to represent article in the table of contents and to setup navigation.
 *
 * @todo wrong description
 * @param {HTMLElement} guide An element in the table of contents representing an article.
 * @param {Object} article {level, id, name, element, descendants}
 * @return {undefined}
 */
Contents.link = (guide, article) => {
    let articleLink,
        guideLink;

    guideLink = global.document.createElement('a');
    articleLink = global.document.createElement('a');

    article.element.id = article.id;

    articleLink.href = `#${article.id}`;

    while (article.element.childNodes.length) {
        articleLink.appendChild(article.element.childNodes[0]);
    }

    article.element.appendChild(articleLink);

    guideLink.appendChild(global.document.createTextNode(article.name));
    guideLink.href = `#${article.id}`;

    guide.insertBefore(guideLink, guide.firstChild);
};

/**
 * Extract element level used to construct list hierarchy, e.g. <h1> is 1, <h2> is 2.
 * When element is not a heading, use Contents.level data attribute. Default to 1.
 *
 * @param {HTMLElement} element
 * @return {Number}
 */
Contents.level = element => {
    let tagName;

    tagName = element.tagName.toLowerCase();

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].indexOf(tagName) !== -1) {
        return parseInt(tagName.slice(1), 10);
    }

    if (typeof element.dataset['gajus.contents.level'] !== 'undefined') {
        return parseInt(element.dataset['gajus.contents.level'], 10);
    }

    if (jQuery && typeof jQuery.data(element, 'gajus.contents.level') !== 'undefined') {
        return jQuery.data(element, 'gajus.contents.level');
    }

    return 1;
};

/**
 * Produce a list of offset values for each element.
 *
 * @param {NodeList} elements
 * @return {Array}
 */
Contents.indexOffset = elements => {
    let element,
        i,
        j,
        offset,
        scrollYIndex;

    scrollYIndex = [];
    i = 0;
    j = elements.length;

    while (i < j) {
        element = elements[i++];

        offset = element.offsetTop;

        // element.offsetTop might produce a float value.
        // Round to the nearest multiple of 5 (either up or down).
        // This is done to help readability and testing.
        offset = 5 * Math.round(offset / 5);

        scrollYIndex.push(offset);
    }

    return scrollYIndex;
};

/**
 * Find the nearest value to the needle in the haystack and return the value index.
 *
 * @see http://stackoverflow.com/a/26366951/368691
 * @param {Number} needle
 * @param {Array} haystack
 * @return {Number}
 */
Contents.getIndexOfClosestValue = (needle, haystack) => {
    let closestValueIndex,
        i,
        j,
        lastClosestValueIndex;

    closestValueIndex = 0;
    i = 0;
    j = haystack.length;

    if (!j) {
        throw new Error('Haystack must be not empty.');
    }

    while (i < j) {
        if (Math.abs(needle - haystack[closestValueIndex]) > Math.abs(haystack[i] - needle)) {
            closestValueIndex = i;
        }

        if (closestValueIndex === lastClosestValueIndex) {
            break;
        }

        lastClosestValueIndex = closestValueIndex;

        i++;
    }

    return closestValueIndex;
};

/**
 * @callback throttleCallback
 * @param {...*} var_args
 */

/**
 * Creates and returns a new, throttled version of the passed function, that, when invoked repeatedly,
 * will only call the original function at most once per every wait milliseconds.
 *
 * @see https://remysharp.com/2010/07/21/throttling-function-calls
 * @param {throttleCallback} throttled
 * @param {Number} threshold Number of milliseconds between firing the throttled function.
 * @param {Object} context The value of "this" provided for the call to throttled.
 * @return {Function}
 */
Contents.throttle = (throttled, threshold = 250, context = {}) => {
    let deferTimer,
        last;

    return () => {
        let args,
            now;

        args = arguments;
        now = Number(new Date());

        if (last && now < last + threshold) {
            clearTimeout(deferTimer);
            deferTimer = setTimeout(() => {
                last = now;
                Reflect.apply(throttled, context, args);
            }, threshold);
        } else {
            last = now;
            Reflect.apply(throttled, context, args);
        }
    };
};

global.gajus = global.gajus || {};
global.gajus.Contents = Contents;

export default Contents;
