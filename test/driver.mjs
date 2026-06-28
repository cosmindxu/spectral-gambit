// Browser driver for subagent A ("the user"): opens the LIVE Spectral Gambit
// page in Chromium, starts a new game at strength 5, enables the AI Companion
// + auto-play, publishes the pairing code, then keeps the page alive so the
// LLM's moves auto-play. On game over it saves the verified result.
//
// Files written under /tmp/sg_game/: code.txt (pairing code), status.txt
// (live heartbeat), result.json (final saved result).
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const SITE = 'https://cosmindxu.github.io/spectral-gambit/';
const DIR = '/tmp/sg_game';
const NAME = 'Opus max-effort';
const SETUP_ONLY = process.env.SETUP_ONLY === '1';
const MAX_MIN = 90;
const log = (m) => { const s = new Date().toISOString().slice(11, 19) + ' ' + m; console.log(s); try { writeFileSync(DIR + '/status.txt', s + '\n', { flag: 'a' }); } catch {} };

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'] });
const page = await browser.newPage();
// anti-throttle: make the page ALWAYS report visible so the headless renderer
// never throttles the requestAnimationFrame loop that drives the emulator.
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(document, 'webkitHidden', { configurable: true, get: () => false });
  document.hasFocus = () => true;
});
await page.setViewport({ width: 1100, height: 1400 });
await page.bringToFront();
const ev = (f, ...a) => page.evaluate(f, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

try {
  log('opening ' + SITE);
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('window.SG&&window.SG.isReady&&window.SG.isReady()', { timeout: 40000 });
  await ev(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction('window.SG&&window.SG.isReady()', { timeout: 40000 });

  // set player name (model + effort, for the leaderboard) and persist it
  await page.click('#playername'); await page.type('#playername', NAME);
  await ev(() => document.getElementById('playername').blur());

  // new game
  await page.click('#newgame'); await sleep(800);
  // strength 5 (maximum)
  await page.click('[data-level="5"]'); await sleep(500);
  const lvl = await ev(() => document.getElementById('lvl').textContent);
  log('strength set, level reads ' + lvl);

  // enable the AI companion (autonomous mode)
  await page.click('#companion-enable');
  await page.waitForFunction('!/^…?$/.test(document.getElementById("companion-code").textContent)', { timeout: 15000 });
  const code = await ev(() => document.getElementById('companion-code').textContent);
  // enable auto-play so the LLM's moves play without manual confirmation
  const apChecked = await ev(() => document.getElementById('companion-autoplay').checked);
  if (!apChecked) await page.click('#companion-autoplay');
  const ap = await ev(() => document.getElementById('companion-autoplay').checked);
  log(`companion enabled, autoplay=${ap}, level=${lvl}, name="${NAME}"`);

  writeFileSync(DIR + '/code.txt', code + '\n');
  log('PAIRING CODE = ' + code + '  (written to code.txt)');
  log('READY — waiting for the LLM (Opus) to pair and play.');

  if (SETUP_ONLY) { log('SETUP_ONLY done'); await browser.close(); process.exit(0); }

  // keep the page alive; auto-play executes the LLM's moves; watch for game over.
  const deadline = Date.now() + MAX_MIN * 60000;
  let lastMoves = -1, connectedSeen = false, jig = 0, recoveries = 0;
  while (Date.now() < deadline) {
    try {
      // keep the page active every tick so rAF (the emulator loop) stays at full speed
      await page.bringToFront().catch(() => {});
      await page.mouse.move(40 + (jig++ % 12), 40).catch(() => {});
      const st = await ev(() => ({
        gs: window.SG.peek(0xE088),               // 0 in play; 1 white-mated; 2 black-mated; 3 stalemate; 4 fifty-move
        moves: window.SG.history().length,
        stm: (window.SG.peek(0xE080) & 8) ? 'black' : 'white',
        conn: /connected/i.test(document.getElementById('companion-status').textContent),
      }));
      if (st.conn && !connectedSeen) { connectedSeen = true; log('LLM connected ✓'); }
      if (st.moves !== lastMoves) { lastMoves = st.moves; log(`plies=${st.moves} toMove=${st.stm} connected=${st.conn} gameState=${st.gs}`); }
      if (st.gs !== 0) { log('GAME OVER detected (gameState=' + st.gs + ')'); break; }
    } catch (e) {
      // renderer/frame likely crashed — reload to recover. The game auto-resumes
      // from localStorage and the companion reuses its saved session, so Claude
      // reconnects with the same pairing code and play continues.
      if (++recoveries > 5) { log('too many recoveries — giving up: ' + e.message.slice(0, 50)); break; }
      log('page error #' + recoveries + ' (' + e.message.slice(0, 40) + ') — reloading to recover');
      try {
        await page.reload({ waitUntil: 'networkidle2', timeout: 35000 });
        await page.waitForFunction('window.SG&&window.SG.isReady&&window.SG.isReady()', { timeout: 35000 });
        connectedSeen = false; lastMoves = -1;
        log('recovered after reload — game resumed from autosave');
      } catch (e2) { log('reload recovery failed: ' + e2.message.slice(0, 50)); break; }
    }
    await sleep(2500);
  }

  // capture + save the verified result
  const fin = await ev(async () => {
    const { buildPosition, readState } = await import('./position.js');
    const p = buildPosition(readState(window.SG));
    return { gs: window.SG.peek(0xE088), fen: p.fen, assisted: window.SG.wasAssisted(),
             plies: window.SG.history().length, label: (document.getElementById('reportstatus') || {}).textContent || '' };
  });
  log('final: ' + JSON.stringify(fin));
  // the report box should be showing; save via the single button
  await page.waitForFunction('!document.getElementById("reportbox").classList.contains("hidden")', { timeout: 8000 }).catch(() => log('reportbox not auto-shown'));
  let saved = '';
  try { await page.click('#report-save'); await sleep(1500); saved = await ev(() => document.getElementById('flash').textContent); } catch (e) { saved = 'save-click-failed:' + e.message; }
  log('save result flash: ' + JSON.stringify(saved));
  const result = { ...fin, savedFlash: saved, name: NAME, finishedAt: new Date().toISOString() };
  writeFileSync(DIR + '/result.json', JSON.stringify(result, null, 2));
  log('RESULT SAVED — ' + JSON.stringify(result));
} catch (e) {
  log('DRIVER ERROR: ' + e.message);
  writeFileSync(DIR + '/result.json', JSON.stringify({ error: e.message }, null, 2));
} finally {
  await browser.close();
}
