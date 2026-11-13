// Hash router: #/ (Game Room) · #/g?id=… (a solo game) · #/quiz (Quiz Shelf) · #/party (host or join a party) · #/join · #/play · #/host · #/screen
import { setFavicon } from './icons.js';

const routes = {
  '': () => import('./views/gameroom.js'),
  g: () => import('./views/solo.js'),
  quiz: () => import('./views/quiz.js'),
  admin: () => import('./views/admin.js'), // hidden: owner code only
  party: () => import('./views/home.js'),
  join: () => import('./views/join.js'),
  play: () => import('./views/player.js'),
  host: () => import('./views/host.js'),
  screen: () => import('./views/screen.js'),
};

let cleanup = null;
async function go() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const name = path.split('/')[0];
  const params = new URLSearchParams(query || '');
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.className = '';
  document.body.className = '';
  document.title = name === 'quiz' ? 'Quiz Shelf · Game Room' : 'Game Room'; // rooms rename the tab themselves
  setFavicon('dice');
  const mod = await (routes[name] || routes[''])();
  cleanup = await mod.mount(app, params);
}
window.addEventListener('hashchange', go);
go();
