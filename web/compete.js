// compete.js — engine ladder + async human-vs-human + leaderboard.
// Talks to the Worker (prod) or the Python dev shim (LAN) via the same
// API. Async H2H is correspondence chess: each side plays one ply in the
// emulator's two-player mode, then POSTs the new .szx; the server flips
// the turn. Uses the window.SG bridge exposed by app.js.

// API base resolution:
//  - an explicit non-empty window.SG_API_BASE (config.js) wins (split hosting);
//  - else on the LAN dev server (:8099) talk to the Python shim (:8100);
//  - else same-origin '' (Worker serving static + /api, or a Pages Function).
const API = (typeof window.SG_API_BASE === 'string' && window.SG_API_BASE)
  ? window.SG_API_BASE
  : (location.port === '8099' ? `${location.protocol}//${location.hostname}:8100` : '');

const $ = (id) => document.getElementById(id);
const api = (path, opts) => fetch(API + path, {
  ...opts, headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
}).then(r => r.json());
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
const u8 = (s) => { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };

const name = () => (localStorage.getItem('sg_name') || '').trim();
const corr = () => { try { return JSON.parse(localStorage.getItem('sg_corr') || 'null'); } catch { return null; } };
const setCorr = (c) => c ? localStorage.setItem('sg_corr', JSON.stringify(c)) : localStorage.removeItem('sg_corr');

// ---------- engine ladder ----------
function initLadder() {
  $('playername').value = name();
  $('playername').onchange = () => localStorage.setItem('sg_name', $('playername').value.trim().slice(0, 24));

  // when a game vs the engine ends, offer to log the result
  window.SG.onOver((status) => {
    const guess = /black wins|0-1/i.test(status) ? 'loss'
      : /white wins|checkmate|1-0/i.test(status) ? 'win'
      : 'draw';
    showReport(guess, status);
  });

  $('report-win').onclick = () => report('win');
  $('report-loss').onclick = () => report('loss');
  $('report-draw').onclick = () => report('draw');
  refreshLeaderboard();
}
function showReport(guess, status) {
  $('reportbox').classList.remove('hidden');
  $('reportstatus').textContent = 'Game over: ' + status;
  for (const r of ['win', 'loss', 'draw'])
    $('report-' + r).classList.toggle('suggest', r === guess);
}
async function report(result) {
  const nm = name();
  if (!nm) { window.SG.flash('enter a player name first'); $('playername').focus(); return; }
  const moves = Math.ceil(window.SG.history().length / 2);
  const res = await api('/api/ladder', { method: 'POST',
    body: JSON.stringify({ name: nm, level: window.SG.level(), result, moves }) });
  $('reportbox').classList.add('hidden');
  window.SG.flash(res.rank ? `logged — you're #${res.rank}` : 'logged');
  refreshLeaderboard();
}
async function refreshLeaderboard() {
  const data = await api('/api/leaderboard').catch(() => null);
  if (!data) { $('leaderboard').innerHTML = '<tr><td colspan="4" class="dim">offline</td></tr>'; return; }
  const me = name();
  $('leaderboard').innerHTML = (data.ladder.length ? data.ladder : []).map((r, i) =>
    `<tr class="${r.name === me ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(r.name)}</td>` +
    `<td>Lv ${r.best}</td><td>${r.wins}W</td></tr>`).join('')
    || '<tr><td colspan="4" class="dim">no games yet — be the first</td></tr>';
}

// ---------- correspondence (async H2H) ----------
function initCorr() {
  // joining via a shared link?
  const g = new URLSearchParams(location.search).get('g');
  if (g && (!corr() || corr().gid !== g)) joinFlow(g);
  else renderCorr();

  $('corr-create').onclick = createCorr;
  $('corr-submit').onclick = submitPly;
  $('corr-refresh').onclick = () => syncCorr(true);
  $('corr-leave').onclick = () => { setCorr(null); renderCorr(); };
  $('corr-copy').onclick = () => { navigator.clipboard?.writeText(shareUrl(corr().gid)); window.SG.flash('link copied'); };

  setInterval(() => { if (corr()) syncCorr(false); }, 6000); // gentle poll
}
const shareUrl = (gid) => `${location.origin}${location.pathname}?g=${gid}`;

async function createCorr() {
  const nm = name() || 'White';
  const res = await api('/api/games', { method: 'POST', body: JSON.stringify({ name: nm }) }).catch(() => null);
  if (!res || !res.id) { window.SG.flash('could not reach server'); return; }
  // fresh game in two-player mode so the local machine won't auto-reply
  window.SG.tap('N'); window.SG.tap('V');
  setCorr({ gid: res.id, token: res.token, color: 'white', baseLen: 0, mode: '2p' });
  renderCorr();
  window.SG.flash('game created — share the link');
}
async function joinFlow(gid) {
  const nm = name() || prompt('Your name?') || 'Black';
  localStorage.setItem('sg_name', nm.slice(0, 24));
  const res = await api(`/api/games/${gid}/join`, { method: 'POST', body: JSON.stringify({ name: nm }) }).catch(() => null);
  if (!res || !res.token) { window.SG.flash(res && res.error ? res.error : 'could not join'); history.replaceState(null, '', location.pathname); return; }
  setCorr({ gid, token: res.token, color: 'black', baseLen: 0, mode: '2p' });
  history.replaceState(null, '', location.pathname);
  await syncCorr(true);                       // pull White's opening position
  renderCorr();
}

async function submitPly() {
  const c = corr(); if (!c) return;
  const hist = window.SG.history();
  if (hist.length <= c.baseLen) { window.SG.flash('make your move on the board first'); return; }
  const bytes = window.SG.getSzx(); if (!bytes) { window.SG.flash('could not read state'); return; }
  const over = /checkmate|stalemate|draw|flag/i.test(window.SG.status());
  const result = over ? (c.color === 'white' ? '1-0' : '0-1') : undefined;
  const res = await api(`/api/games/${c.gid}/move`, { method: 'POST',
    body: JSON.stringify({ token: c.token, szx: b64(bytes), movelog: hist, result }) }).catch(() => null);
  if (!res || !res.ok) { window.SG.flash(res && res.error ? res.error : 'submit failed'); return; }
  c.baseLen = hist.length; setCorr(c);
  window.SG.flash('move sent'); renderCorr(res);
}

async function syncCorr(loud) {
  const c = corr(); if (!c) return;
  const g = await api(`/api/games/${c.gid}`).catch(() => null);
  if (!g || g.error) { if (loud) window.SG.flash('game not found'); return; }
  const myTurn = g.turn === c.color;
  // if it's my turn and the server has more plies than I have locally, pull state
  if (myTurn && g.hasState && (g.movelog || []).length > window.SG.history().length) {
    const st = await api(`/api/games/${c.gid}/state`).catch(() => null);
    if (st && st.szx) {
      window.SG.loadSzx(u8(st.szx), g.movelog);
      c.baseLen = (g.movelog || []).length; setCorr(c);
      window.SG.flash('your turn — opponent moved');
    }
  }
  renderCorr(g);
}

function renderCorr(g) {
  const c = corr();
  const idle = $('corr-idle'), active = $('corr-active');
  if (!c) { idle.classList.remove('hidden'); active.classList.add('hidden'); return; }
  idle.classList.add('hidden'); active.classList.remove('hidden');
  $('corr-share').value = shareUrl(c.gid);
  $('corr-color').textContent = c.color;
  const turn = g ? (g.turn || (g.status, '')) : '';
  let msg;
  if (g && g.status === 'waiting') msg = 'waiting for an opponent to join…';
  else if (g && g.status === 'over') msg = 'game over · ' + (g.result || '');
  else if (g && g.turn === c.color) msg = 'your move — play it, then Submit';
  else if (g) msg = `waiting for ${c.color === 'white' ? (g.black || 'black') : (g.white || 'white')}…`;
  else msg = 'your move — play it, then Submit';
  $('corr-state').textContent = msg;
  const myTurn = !g || g.turn === c.color;
  $('corr-submit').disabled = !myTurn;
}

function esc(s) { return (s || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m])); }

// ---------- boot ----------
window.SG ? boot() : window.addEventListener('load', boot);
function boot() {
  const start = () => { initLadder(); initCorr(); };
  if (window.SG && window.SG.onReady) window.SG.onReady(start);
  else setTimeout(boot, 200);
}
