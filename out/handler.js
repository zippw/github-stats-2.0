"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const { renderFile } = require('pug');
const path = require('node:path');
// Sends string with cached svg in the response if less than 5min have passed since the last request.
let cachedData;
let cachedError;
const GITHUB_LOGIN = 'zippw';
const ghvc = async (token, toIncrement = false) => {
    let result = 'N/A';
    try {
        const TableName = "test/users";
        const getItemResponse = await fetch(process.env.ydb_endpoint || '', {
            method: 'POST',
            headers: { 'X-Amz-Target': 'DynamoDB_20120810.GetItem', 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ TableName, Key: { "username": { "S": GITHUB_LOGIN } } }) // если можно как-то сделать квери сразу на значение .ghvc.N, я буду рад
        });
        if (getItemResponse.ok) {
            const data = await getItemResponse.json();
            if (data.Item)
                result = parseInt(data.Item.ghvc.N) + 1;
        }
        ;
        if (toIncrement)
            await fetch(`${process.env.ydb_endpoint}`, {
                method: 'POST',
                headers: { 'X-Amz-Target': 'DynamoDB_20120810.PutItem', 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ TableName, Item: { "username": { "S": GITHUB_LOGIN }, "ghvc": { "N": result.toString() } } })
            });
    }
    catch (error) { }
    return result;
};
const handler = async (event, context) => {
    // query parameters and defaults
    const queryDefaults = Object.assign({
        // indicates that caching headers should be sent upon successful response.
        isCached: 'true', // default: true
        // sets the number of dashes in a circle
        dashesCount: '40', // min: langsPerSlide * 2 - 1 | max: 500 | default: 40
        // sets the number of seconds during which the slide will be shown
        slideDuration: '6', // min: 1 | max: 60 | default: 6
        // sets the max number of languages to be rendered per slide
        languagesPerSlide: '5', // min: 1  | max: 20 | default: 5
        // sets whether the number of visits will be increased by one
        ghvcInc: 'false' // default: false
    }, event?.queryStringParameters || {});
    const options = {
        isCached: queryDefaults.isCached === 'true',
        slideDuration: Math.min(60, Math.max(1, parseInt(queryDefaults.slideDuration) || 0)),
        languagesPerSlide: Math.min(20, parseInt(queryDefaults.languagesPerSlide)) || 5,
        dashesCount: Math.min(500, Math.max((Math.min(20, parseInt(queryDefaults.languagesPerSlide)) || 5) * 2 - 1, parseInt(queryDefaults.dashesCount) || 40)),
        ghvcInc: queryDefaults.ghvcInc === 'true'
    };
    // github GraphQL query
    // FUTURE: support > 100 repositories
    const query = `{
        user(login: "${GITHUB_LOGIN}") {
            repositories(first: 100) {
                nodes {
                    name
                    stargazerCount
                    forkCount
                    languages(first: 100) {
                        edges {
                            size
                            node {
                                name
                                color
                            }
                        }
                    }
                }
            }
        }
    }`;
    if (cachedData)
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
                'Cache-Control': options.isCached ? `max-age=${60 * 60 * 24 * 7}` : 'no-cache, no-store',
            },
            body: cachedData,
        };
    try {
        // const visits = 500
        const [response, visits] = await Promise.all([
            fetch('https://api.github.com/graphql', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `bearer ${process.env.GITHUB_TOKEN}`
                },
                body: JSON.stringify({ query })
            }),
            ghvc(context.token?.access_token || '', options.ghvcInc)
        ]);
        if (!response.ok)
            throw new Error('503');
        const data = await response.json();
        const repos = data.data.user.repositories.nodes;
        const { langs, total } = repos.reduce((acc, repo) => {
            (repo.languages.edges).forEach(({ size, node: { name, color } }) => {
                if (!acc.langs[name])
                    acc.langs[name] = { size: 0, color, sizep: '' };
                acc.langs[name].size += size;
                acc.total.langSize += size;
            });
            acc.total.stars += repo.stargazerCount;
            acc.total.forks += repo.forkCount;
            return acc;
        }, { langs: {}, total: { langSize: 0, stars: 0, forks: 0, views: visits } });
        Object.keys(langs).forEach(key => langs[key].sizep = ((langs[key].size / total.langSize) * 100).toFixed(3) + "%");
        // let langs = {
        //     JavaScript: { size: 990733, color: '#f1e05a', sizep: '43.094%' },
        //     HTML: { size: 837380, color: '#e34c26', sizep: '36.424%' },
        //     SCSS: { size: 236881, color: '#c6538c', sizep: '10.304%' },
        //     CSS: { size: 98470, color: '#663399', sizep: '4.283%' },
        //     Pug: { size: 78352, color: '#a86454', sizep: '3.408%' },
        //     TypeScript: { size: 38744, color: '#3178c6', sizep: '1.685%' },
        //     GLSL: { size: 11157, color: '#5686a5', sizep: '0.485%' },
        //     'C++': { size: 2939, color: '#f34b7d', sizep: '0.128%' },
        //     Python: { size: 2770, color: '#3572A5', sizep: '0.120%' },
        //     Handlebars: { size: 1438, color: '#f7931e', sizep: '0.063%' },
        //     Procfile: { size: 12, color: '#3B2F63', sizep: '0.001%' },
        //     Batchfile: { size: 106, color: '#C1F12E', sizep: '0.005%' },
        //     // }, total = { langSize: 2298982, stars: 2, forks: 2, views: 125 };
        // }, total = { langSize: 2298982, stars: 2, forks: 2, views: visits }
        // let langs = {
        //     'C++': { size: 383269, color: '#f34b7d', sizep: '0.759%' },
        //     Arduino: { size: 18572, color: null, sizep: '0.037%' },
        //     Python: { size: 31472356, color: '#3572A5', sizep: '62.326%' },
        //     C: { size: 17792627, color: '#555555', sizep: '35.236%' },
        //     Makefile: { size: 32262, color: '#427819', sizep: '0.064%' },
        //     Batchfile: { size: 73342, color: '#C1F12E', sizep: '0.145%' },
        //     CSS: { size: 1318, color: '#663399', sizep: '0.003%' },
        //     HTML: { size: 190740, color: '#e34c26', sizep: '0.378%' },
        //     Assembly: { size: 49121, color: '#6E4C13', sizep: '0.097%' },
        //     DTrace: { size: 2196, color: null, sizep: '0.004%' },
        //     Shell: { size: 58027, color: '#89e051', sizep: '0.115%' },
        //     Roff: { size: 39403, color: '#ecdebe', sizep: '0.078%' },
        //     PLSQL: { size: 22886, color: '#dad8d8', sizep: '0.045%' },
        //     PowerShell: { size: 20248, color: '#012456', sizep: '0.040%' },
        //     'Objective-C': { size: 26873, color: '#438eff', sizep: '0.053%' },
        //     'Common Lisp': { size: 24579, color: '#3fb68b', sizep: '0.049%' },
        //     M4: { size: 177066, color: null, sizep: '0.351%' },
        //     'Rich Text Format': { size: 7579, color: null, sizep: '0.015%' },
        //     XSLT: { size: 153, color: '#EB8CEB', sizep: '0.000%' },
        //     VBScript: { size: 70, color: '#15dcdc', sizep: '0.000%' },
        //     JavaScript: { size: 103559, color: '#f1e05a', sizep: '0.205%' }
        // }, total = { langSize: 50496246, stars: 0, forks: 0 }
        const arr = Object.entries(langs)
            .map(([lang, data]) => ({ lang, ...data }))
            .sort((a, b) => b.size - a.size);
        const chunkedArr = [];
        for (let i = 0; i < arr.length; i += options.languagesPerSlide) {
            const group = arr.slice(i, i + options.languagesPerSlide); // split by 5 languages
            const total5langs = group.reduce((acc, x) => acc + x.size, 0); // sum of lang sizes
            const totalCells = options.dashesCount - (group.length - 1); // exclude dashes between zones
            // the number of ratio cells for each group of languages
            let ratio = group.map(x => Math.max(1, Math.round(totalCells * (x.size / total5langs))));
            // ratio correction
            let sum = ratio.reduce((a, b) => a + b, 0);
            while (sum !== totalCells) {
                if (sum > totalCells) { // decrease max value if not less than 1
                    let maxIndex = ratio.indexOf(Math.max(...ratio));
                    if (ratio[maxIndex] > 1)
                        ratio[maxIndex]--;
                }
                else { // increase min value
                    let minIndex = ratio.indexOf(Math.min(...ratio));
                    ratio[minIndex]++;
                }
                sum = ratio.reduce((a, b) => a + b, 0);
            }
            group.forEach((x, idx) => x.size = ratio[idx]);
            chunkedArr.push(group);
        }
        const allText = chunkedArr.flatMap(x => x).reduce((acc, { lang, sizep }, i) => acc += lang + sizep, '') // all langs 
            + [...Array(chunkedArr.length + 1).keys()].join('') // + pagination
            + `github.com/${GITHUB_LOGIN}` // + link
            + 'N/A' + '0123456789.,KMBT'; // + numeric stats
        let svg = renderFile(path.join(__dirname, 'pug/index.pug'), {
            slides: chunkedArr, total, options,
            glyphs: {
                paths: require('./glyphs.json'),
                // used: Object.keys(require('./glyphs.json'))
                used: getUsedUnicodes(allText).concat('0000')
            }
        });
        cachedData = svg;
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
                'Cache-Control': options.isCached ? `max-age=${60 * 60 * 24 * 7}` : 'no-cache, no-store',
            },
            body: svg,
        };
    }
    catch (error) {
        const phrase = [
            'Well, that didn’t work.',
            'Stats? Nope, not today.',
            'Something went wrong on our end.',
            'IDK what went wrong.',
            'Languages usage data failed to load.',
            'The stats service is experiencing issues.',
            'No valid stats output.',
            'SVG renderer crashed.',
            'Server didn\'t make it.',
            'A wild error appeared!',
            'Maybe it’s your internet?',
            'Error: Not your lucky day.'
        ][Math.floor(Math.random() * 12)];
        let svg = cachedError || renderFile(path.join(__dirname, 'pug/index.pug'), {
            error: { phrase, object: error }, options,
            glyphs: {
                paths: require('./glyphs.json'),
                used: getUsedUnicodes(phrase)
            }
        });
        cachedError = svg;
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
                'Cache-Control': 'no-cache, no-store'
            },
            body: svg
        };
    }
};
exports.handler = handler;
/**
 * Returns an array of Unicode hex codes representing glyphs used in the input string.
 * If `useAllGlyphs` is true, returns all available glyphs from the predefined JSON file.
 *
 * @param {string} str - The input string to analyze for used glyphs.
 * @param {boolean} [useAllGlyphs=false] - If true, ignores the input string and returns all possible glyphs.
 * @returns {string[]} An array of 4-digit Unicode hex codes (e.g., ["0041", "0042"]).
 */
function getUsedUnicodes(str, useAllGlyphs = false) {
    if (useAllGlyphs)
        return Object.keys(require('./glyphs.json'));
    const unicodeSet = new Set();
    for (let i = 0; i < str.length; i++) {
        const hex = str.charCodeAt(i).toString(16).padStart(4, '0');
        unicodeSet.add(String(hex));
    }
    return Array.from(unicodeSet);
}
