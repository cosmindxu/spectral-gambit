// clock.js — optional REAL (wall-clock) chess clock, independent of the
// emulator's frame-based clock. Off by default; when on it gives a proper
// timed game for players who want to keep moving instead of pausing.
//
// It times whoever is to move in real seconds: White (you) while the status
// is "Your move", Black (engine) while it's "Thinking". An increment is added
// after each completed ply. Running out flags the game. It pauses when the
// tab is hidden and survives reloads (paused), so it composes with save-state.

const PRESETS = {                  // label -> [base seconds, increment seconds]
  off:    null,
  '3+2':  [180, 2],
  '5+0':  [300, 0],
  '10+5': [600, 5],
  '15+10':[900, 10],
};

let cfg = null;                    // {base, inc} or null when off
let wMs = 0, bMs = 0;              // remaining ms for White (you) / Black (engine)
let lastTs = null, over = false, lastHist = 0, tcKey = 'off';

const $ = (id) => document.getElementById(id);
const fmt = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss < 10 ? '0' : ''}${ss}`;
};

function save() {
  localStorage.setItem('sg_clock', JSON.stringify({ tcKey, wMs, bMs, over }));
}
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem('sg_clock') || 'null');
    if (s && PRESETS[s.tcKey]) { tcKey = s.tcKey; cfg = { base: PRESETS[s.tcKey][0], inc: PRESETS[s.tcKey][1] };
      wMs = s.wMs; bMs = s.bMs; over = !!s.over; }
  } catch (e) { /* ignore */ }
}

function applyTC(key, resetClocks) {
  tcKey = key;
  const p = PRESETS[key];
  cfg = p ? { base: p[0], inc: p[1] } : null;
  over = false;
  if (cfg && resetClocks) { wMs = cfg.base * 1000; bMs = cfg.base * 1000; }
  $('clocks').classList.toggle('hidden', !cfg);
  $('clockmsg').textContent = '';
  lastTs = null; save(); render();
}

function flag(side) {
  over = true;
  const msg = side === 'w' ? 'Flag — you lost on time' : 'Flag — engine lost on time, you win!';
  $('clockmsg').textContent = msg;
  if (window.SG) window.SG.flash(msg);
  save();
}

// `st` is the already-read status (avoids a second screen-text read per tick)
function render(st) {
  const you = $('clk-you'), eng = $('clk-eng');
  if (!you) return;
  you.querySelector('b').textContent = cfg ? fmt(wMs) : '--:--';
  eng.querySelector('b').textContent = cfg ? fmt(bMs) : '--:--';
  if (!cfg) { you.classList.remove('active', 'low'); eng.classList.remove('active', 'low'); return; }
  st = st || '';
  you.classList.toggle('active', !over && /your move/i.test(st));
  eng.classList.toggle('active', !over && /thinking/i.test(st));
  you.classList.toggle('low', wMs < 30000);
  eng.classList.toggle('low', bMs < 30000);
}

function tick() {
  const now = performance.now();
  const dt = lastTs == null ? 0 : now - lastTs;
  lastTs = now;
  // clock off (the default): do NO emulator reads — keep the main thread free
  if (!cfg) { render(); return; }
  if (over || document.hidden || !window.SG || !window.SG.isReady()) { render(''); return; }

  // reset clocks when a new game starts (move log returns to empty)
  const h = window.SG.history().length;
  if (h === 0 && lastHist > 0) { wMs = cfg.base * 1000; bMs = cfg.base * 1000; over = false; }
  lastHist = h;

  const st = window.SG.status();                  // single read, reused by render
  if (/your move/i.test(st)) wMs -= dt;
  else if (/thinking/i.test(st)) bMs -= dt;
  if (wMs <= 0) { wMs = 0; flag('w'); }
  else if (bMs <= 0) { bMs = 0; flag('b'); }
  render(st);
  if ((tick._n = (tick._n || 0) + 1) % 4 === 0) save();   // persist ~1/s
}

function init() {
  const sel = $('timecontrol');
  restore();
  sel.value = tcKey;
  $('clocks').classList.toggle('hidden', !cfg);
  sel.onchange = () => applyTC(sel.value, true);

  // add the increment to whoever just completed a move
  window.SG.onPly((mv) => {
    if (!cfg || over) return;
    if (mv.side === 0) wMs += cfg.inc * 1000; else bMs += cfg.inc * 1000;
    save();
  });

  setInterval(tick, 200);
  render();
}

window.SG ? boot() : window.addEventListener('load', boot);
function boot() {
  if (window.SG && window.SG.onReady) window.SG.onReady(init);
  else setTimeout(boot, 200);
}
