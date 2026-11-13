// The Game Room catalogue. Each game: { id, title, blurb, how[], learn, touch?, thumb(g,W,H,t), create(api) }
import mothHunter from './moth-hunter.js';
import replicator from './replicator.js';
import antibodyArena from './antibody-arena.js';
import cellCycleRunner from './cell-cycle-runner.js';

export const GAMES = [mothHunter, antibodyArena, replicator, cellCycleRunner];
export const byId = (id) => GAMES.find(g => g.id === id);
