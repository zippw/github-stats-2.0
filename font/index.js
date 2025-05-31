// PARAMS
const CONVERTED_FONT_FILENAME = 'font.svg';
const ENABLE_SIZE_OPTIMIZATION = true;
const ENABLE_FLIPPING_LETTERS = true;
const FONT_ASCENT = 832;

const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require("fast-xml-parser");
const { parseSVG } = require('svg-path-parser');

const fontSvgPath = path.resolve(__dirname, CONVERTED_FONT_FILENAME);

(async () => {
    const svg = fs.readFileSync(fontSvgPath, { encoding: 'utf-8' });
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "attr-",
        isArray: (name) => false,
    });

    const svgJson = parser.parse(svg);
    const glyphs = {};

    glyphs['0000'] = transformPath(svgJson.svg.defs.font['missing-glyph']['attr-d']);

    for (const g of svgJson.svg.defs.font.glyph) {
        const unicode = g['attr-unicode'];
        const path = g['attr-d'];

        if (!unicode || !path) {
            if (!unicode) console.log('Warning: no unicode', g);
            if (!path) console.log('Warning: no path', g);
            continue
        }

        glyphs[glyph2unicode(unicode)] = transformPath(g['attr-d']);
    }

    await fs.writeFileSync(path.resolve(__dirname, '../src/glyphs.json'), JSON.stringify(glyphs))
    console.log(`Done. Generated ${Object.keys(glyphs).length} glyphs`)
})();

function transformPath(path) {
    path = optimizePath(path);
    path = reversePath(path);
    return path
}

function optimizePath(path) {
    if (!ENABLE_SIZE_OPTIMIZATION) return path;

    const commands = parseSVG(path)

    let d = '';
    let offset = { x: 0, y: 0 };
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const nextCmd = i === commands.length - 1 ? null : commands[i + 1];

        // horizontal line
        if (cmd.code === nextCmd?.code && cmd.code === 'v') {
            if (cmd.y) offset.y += cmd.y;
            continue;
        }

        // vertical line
        if (cmd.code === nextCmd?.code && cmd.code === 'h') {
            if (cmd.x) offset.x += cmd.x;
            continue;
        }

        if (cmd.x !== undefined) cmd.x += offset.x;
        if (cmd.y !== undefined) cmd.y += offset.y;
        offset = { x: 0, y: 0 };

        d += cmd.code + [cmd.x, cmd.y].filter(x => x !== undefined).join(',');
    }

    return d;
}

function reversePath(path) {
    if (!ENABLE_FLIPPING_LETTERS) return path;

    const commands = parseSVG(path)

    let d = '';
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];

        if (cmd.y !== undefined) cmd.y = !cmd.relative ? FONT_ASCENT - cmd.y : cmd.y * -1;

        d += cmd.code + [cmd.x, cmd.y].filter(x => x !== undefined).join(',');
    }

    return d;
}

function glyph2unicode(glyph) {
    if (glyph.startsWith('&#x') && glyph.endsWith(';')) {
        const hexCode = glyph.substring(3, glyph.length - 1);
        return String(hexCode.padStart(4, '0'));
    }

    if (glyph.length === 1) {
        const hexValue = glyph.charCodeAt(0).toString(16).toLowerCase();
        return String(hexValue.padStart(4, '0'));
    }

    return glyph.split('').map(c => {
        const hex = c.charCodeAt(0).toString(16).padStart(4, '0');
        return String(hex);
    }).join('');
}