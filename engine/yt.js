// Minimal YouTube IFrame API wrapper.
let apiPromise = null;
function api() {
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => { apiPromise = null; reject(new Error('yt api timeout')); }, 12000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); try { prev && prev(); } catch {} resolve(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { clearTimeout(timer); apiPromise = null; s.remove(); reject(new Error('yt api blocked')); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const ID = /^[\w-]{11}$/;
export function videoId(url) {
  const u = String(url || '').trim();
  if (ID.test(u)) return u;
  let x; try { x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch { return null; }
  const h = x.hostname.replace(/^(www|m|music)\./, '').toLowerCase();
  let id = null;
  if (h === 'youtu.be') id = x.pathname.split('/')[1];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    const seg = x.pathname.split('/').filter(Boolean);
    if (seg[0] === 'watch') id = x.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(seg[0])) id = seg[1];
  }
  return id && ID.test(id) ? id : null;
}

export async function createPlayer(el, { onError, onEnd } = {}) {
  const YT = await api();
  const host = document.createElement('div'); el.appendChild(host);
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('yt player timeout')), 15000);
    const p = new YT.Player(host, {
      width: '100%', height: '100%',
      playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => { clearTimeout(to); resolve(wrap(p)); },
        onError: (e) => onError && onError(e.data),
        onStateChange: (e) => { if (e.data === 0 && onEnd) onEnd(); },
      },
    });
  });
}

function wrap(p) {
  let current = null;
  return {
    get id() { return current; },
    load(id, start = 0, play = true) { current = id; play ? p.loadVideoById({ videoId: id, startSeconds: start }) : p.cueVideoById({ videoId: id, startSeconds: start }); },
    play() { p.playVideo(); }, pause() { p.pauseVideo(); },
    seek(s) { p.seekTo(s, true); },
    time() { try { return p.getCurrentTime() || 0; } catch { return 0; } },
    state() { try { return p.getPlayerState(); } catch { return -1; } },
    dur() { try { return p.getDuration() || 0; } catch { return 0; } },
    volume(v) { try { p.setVolume(v); } catch {} },
    destroy() { try { p.destroy(); } catch {} },
  };
}
