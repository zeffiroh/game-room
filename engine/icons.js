// The icon pack. Every icon is drawn in ASCII: '#' = ink, '+' = accent (maroon), 'o' = white, '.' = empty.
// iconSvg() turns the rows into crisp pixel rects, so they stay sharp at any size, including the browser tab.
// To add one: draw it below (any width/height, 8x8 or 9x9 looks best) and it shows up in every picker.

export const ICONS = {
  star: [
    '...#....',
    '...#....',
    '..#+#...',
    '###+####',
    '.#+++#..',
    '..#+#...',
    '.#.#.#..',
    '#.....#.',
  ],
  heart: [
    '........',
    '.##..##.',
    '#++##++#',
    '#++++++#',
    '.#++++#.',
    '..#++#..',
    '...##...',
    '........',
  ],
  dna: [
    '#.....#',
    '.#+++#.',
    '..#.#..',
    '...#...',
    '..#.#..',
    '.#+++#.',
    '#.....#',
    '.#+++#.',
    '..#.#..',
    '...#...',
    '..#.#..',
  ],
  flask: [
    '..####..',
    '...##...',
    '...##...',
    '..#..#..',
    '.#....#.',
    '#+o+++o#',
    '#++++++#',
    '.######.',
  ],
  cell: [
    '..####..',
    '.#....#.',
    '#..++..#',
    '#.++++.#',
    '#.++++.#',
    '#..++.##',
    '.#....#.',
    '..####..',
  ],
  virus: [
    '#...#...#',
    '.#..#..#.',
    '..#####..',
    '..#+++#..',
    '###+o+###',
    '..#+++#..',
    '..#####..',
    '.#..#..#.',
    '#...#...#',
  ],
  leaf: [
    '....####',
    '..##+++#',
    '.#+++#+#',
    '#+++#++#',
    '#++#++#.',
    '#+#++#..',
    '.###....',
    '#.......',
  ],
  chart: [
    '#.......',
    '#.....++',
    '#.....++',
    '#..++.++',
    '#..++.++',
    '#++++.++',
    '#++++.++',
    '########',
  ],
  sigma: [
    '#######.',
    '.#....#.',
    '..#.....',
    '...#....',
    '..#.....',
    '.#....#.',
    '#######.',
    '........',
  ],
  terminal: [
    '########',
    '#++++++#',
    '########',
    '#......#',
    '#.#....#',
    '#..#...#',
    '#.#.##.#',
    '########',
  ],
  book: [
    '.........',
    '.###.###.',
    '#ooo#ooo#',
    '#o++#++o#',
    '#ooo#ooo#',
    '#o++#++o#',
    '#ooo#ooo#',
    '.###.###.',
    '....#....',
  ],
  globe: [
    '..####..',
    '.#.++.#.',
    '#.++++.#',
    '########',
    '#.++++.#',
    '#..++..#',
    '.#.++.#.',
    '..####..',
  ],
  film: [
    '########',
    '#o#oo#o#',
    '########',
    '#++++++#',
    '#++++++#',
    '########',
    '#o#oo#o#',
    '########',
  ],
  note: [
    '....###.',
    '....#.##',
    '....#..#',
    '....#...',
    '....#...',
    '.####...',
    '#++##...',
    '.###....',
  ],
  dice: [
    '########',
    '#oooooo#',
    '#o+oo+o#',
    '#oooooo#',
    '#o+oo+o#',
    '#oooooo#',
    '#o+oo+o#',
    '########',
  ],
  paddle: [
    '..####..',
    '.#++++#.',
    '#++++++#',
    '#++++++#',
    '#++++++#',
    '.#++++#.',
    '..####..',
    '...##.#.',
    '...##...',
  ],
  pizza: [
    '########',
    '#+o++o+#',
    '.#++++#.',
    '.#+o++#.',
    '..#++#..',
    '..#+o#..',
    '...##...',
    '........',
  ],
  trophy: [
    '########',
    '#++++++#',
    '.#++++#.',
    '..####..',
    '...##...',
    '...##...',
    '..####..',
    '.######.',
  ],
  bolt: [
    '....##..',
    '...##...',
    '..##....',
    '.######.',
    '....##..',
    '...##...',
    '..##....',
    '.##.....',
  ],
  smile: [
    '..####..',
    '.#oooo#.',
    '#o#oo#o#',
    '#oooooo#',
    '#o+oo+o#',
    '#oo++oo#',
    '.#oooo#.',
    '..####..',
  ],
  rocket: [
    '...##...',
    '..#++#..',
    '..#oo#..',
    '..#++#..',
    '.##oo##.',
    '#.#oo#.#',
    '#.####.#',
    '..+..+..',
  ],
  floppy: [
    '########',
    '#.####.#',
    '#.##o#.#',
    '#.####.#',
    '#......#',
    '#.oooo.#',
    '#.o++o.#',
    '########',
  ],
  cup: [
    '.#.#....',
    '#.#.....',
    '######..',
    '#oooo###',
    '#oooo#.#',
    '#+++o###',
    '.####...',
    '######..',
  ],
  apple: [
    '....#...',
    '...#.##.',
    '.++#++..',
    '++++++#.',
    '+o++++#.',
    '++++++#.',
    '.++++#..',
    '..+.+...',
  ],
  brain: [
    '..####..',
    '.#+#++#.',
    '#++#+#+#',
    '#+#++#+#',
    '#++#+#+#',
    '.#+#++#.',
    '..####..',
    '...##...',
  ],
  scroll: [
    '.######.',
    '#oooooo#',
    '.#o##o#.',
    '.#oooo#.',
    '.#o##o#.',
    '.#oooo#.',
    '#oooooo#',
    '.######.',
  ],
  eye: [
    '........',
    '..####..',
    '.#oooo#.',
    '#oo++oo#',
    '#oo+#oo#',
    '.#oooo#.',
    '..####..',
    '........',
  ],
  ghost: [
    '..####..',
    '.#oooo#.',
    '#o#oo#o#',
    '#oooooo#',
    '#oooooo#',
    '#oooooo#',
    '#o#oo#o#',
    '##.##.##',
  ],
};

export const ICON_NAMES = Object.keys(ICONS);
export const isIcon = (name) => Object.prototype.hasOwnProperty.call(ICONS, name);

// One rect per horizontal run of the same color, so a 9x9 icon is ~20 rects, not 81.
function rects(rows, colors) {
  let out = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1; while (row[x + w] === ch) w++;
      if (colors[ch]) out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${colors[ch]}"/>`;
      x += w;
    }
  });
  return out;
}

// size = pixel height. ink/accent/fill can be any CSS color.
export function iconSvg(name, { size = 16, ink = '#000', accent = '#7a0f1f', fill = '#fff', cls = 'ico', title = '' } = {}) {
  const rows = ICONS[name] || ICONS.star;
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const width = Math.round(size * w / h);
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${width}" height="${size}" shape-rendering="crispEdges" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}>${rects(rows, { '#': ink, '+': accent, o: fill })}</svg>`;
}

// For the browser tab: same icon on a silver tile with a 1px black frame, like a Win95 shortcut.
export function iconDataUrl(name) {
  const rows = ICONS[name] || ICONS.star;
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, n = Math.max(w, h) + 2;
  const ox = (n - w) / 2, oy = (n - h) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#c0c0c0"/><g transform="translate(${ox} ${oy})">${rects(rows, { '#': '#000', '+': '#7a0f1f', o: '#fff' })}</g></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function setFavicon(name) {
  let l = document.querySelector('link[rel=icon]');
  if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
  l.href = iconDataUrl(name);
}
