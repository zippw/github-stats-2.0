# Instructions

## Custom font setup
1. convert .otf font to svg using online converters;
2. Replace `font/font.svg` with your own .svg font file;
3. Check params in `font/index.js` file and run it with `node font/index.js`
4. You now have glyphs.json file appeared in `src` folder.

> [!TIP]  
> If ENABLE_FLIPPING_LETTERS working incorrect, you may consider using `transform="scale(1, -1) translate(0, -FONT_ASCENT)` on `defs > symbol > path()` in `src/index.pug`