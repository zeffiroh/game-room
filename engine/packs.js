// Loads class packs: packs/index.json lists them; each pack.json names its content files.
const cache = new Map();

export async function listPacks() {
  const res = await fetch('packs/index.json', { cache: 'no-cache' });
  return (await res.json()).packs;
}

export async function loadPack(id) {
  if (cache.has(id)) return cache.get(id);
  const p = (async () => {
    const list = await listPacks();
    const entry = list.find(x => x.id === id) || list[0];
    const base = `packs/${entry.folder || entry.id}/`;
    const pack = await (await fetch(base + 'pack.json', { cache: 'no-cache' })).json();
    pack.id = entry.id;
    if (entry.only) { // single-game pack: spawn, that game, the end
      const lobby = pack.show.find(x => x.station === 'lobby') || { station: 'lobby', title: 'Spawn' };
      pack.show = [lobby, ...pack.show.filter(x => x.station === entry.only), { station: 'closing', title: 'The end' }];
      pack.title = entry.name;
    }
    pack.data = {};
    await Promise.all(Object.entries(pack.files || {}).map(async ([key, file]) => {
      const r = await fetch(base + file, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`Pack file missing: ${base}${file}`);
      pack.data[key] = await r.json();
    }));
    return pack;
  })();
  cache.set(id, p);
  return p;
}

// Stamp catalogue = every step in the show that grants a stamp.
export function stampsOf(pack) {
  return (pack.show || []).filter(s => s.stamp).map(s => ({ id: s.stamp.id, name: s.stamp.name, icon: s.stamp.icon }));
}
