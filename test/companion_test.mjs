// AI Companion integration test: drives the browser UI (pointed at the local
// wrangler worker) while simulating the player's Claude over MCP via direct
// HTTP. Verifies enable→pair→connected, suggestion cards, click-to-play, and
// the play-command confirm.
import puppeteer from 'puppeteer-core';
const SITE = 'http://127.0.0.1:8099/';
const WORKER = 'http://127.0.0.1:8787';

// --- MCP client (simulates Claude) ---
let SID = null;
async function rpc(method, params, isCall) {
  const body = isCall
    ? { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: method, arguments: params } }
    : { jsonrpc: '2.0', id: Date.now(), method, params };
  const r = await fetch(`${WORKER}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(SID ? { 'Mcp-Session-Id': SID } : {}) }, body: JSON.stringify(body) });
  const sid = r.headers.get('mcp-session-id'); if (sid) SID = sid;
  return r.json();
}
const toolText = (res) => res.result?.content?.[0]?.text;

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage(); await page.bringToFront();
// point the page's config at the LOCAL worker (config.js otherwise hardcodes prod)
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().endsWith('/config.js')) return req.respond({ status: 200, contentType: 'application/javascript', body: `window.SG_API_BASE='${WORKER}';` });
  req.continue();
});
const ev = (f, ...a) => page.evaluate(f, ...a);
const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push(e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const type = s => s & 7;
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n); } };

try {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 40000 });
  await page.waitForFunction('window.SG&&window.SG.isReady&&window.SG.isReady()', { timeout: 30000 });
  await ev(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction('window.SG&&window.SG.isReady()', { timeout: 30000 });

  // 1. enable companion
  await page.click('#companion-enable');
  await page.waitForFunction('document.getElementById("companion-code") && !/^…?$/.test(document.getElementById("companion-code").textContent)', { timeout: 8000 });
  const code = await ev(() => document.getElementById('companion-code').textContent);
  const url = await ev(() => document.getElementById('companion-url').textContent);
  ok('enable populates pairing code', /^[A-Z0-9]{6}$/.test(code));
  ok('connector URL is the worker /mcp', url === WORKER + '/mcp');

  // 2. Claude connects + pairs
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  const paired = await rpc('pair', { code }, true);
  ok('pair succeeds', /Paired/.test(toolText(paired)));
  await page.waitForFunction('/connected/i.test(document.getElementById("companion-status").textContent)', { timeout: 8000 }).catch(() => {});
  ok('page shows connected', /connected/i.test(await ev(() => document.getElementById('companion-status').textContent)));

  // 3. Claude reads the position
  const pos = JSON.parse(toolText(await rpc('get_position', {}, true)));
  ok('get_position returns startpos FEN', pos.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'));
  ok('get_position lists 20 legal moves', pos.legalMoves.length === 20);

  // 4. Claude proposes 3 candidates -> page renders cards
  await rpc('propose_candidates', { candidates: [
    { san: 'e4', rationale: 'classical center' }, { san: 'd4', rationale: 'queen-pawn' },
    { san: 'Nf3', rationale: 'flexible' }], comment: 'Three solid openings' }, true);
  await page.waitForFunction('document.querySelectorAll("#companion-suggestions .comp-card").length===3', { timeout: 8000 });
  ok('page shows 3 suggestion cards', (await ev(() => document.querySelectorAll('#companion-suggestions .comp-card').length)) === 3);

  // 5. click the e4 card's Play -> board plays e4
  await ev(() => { for (const c of document.querySelectorAll('#companion-suggestions .comp-card')) if (/^e4/.test(c.querySelector('.comp-move').textContent)) c.querySelector('.comp-play').click(); });
  await page.waitForFunction('(window.SG.board()[0x34]&7)===1', { timeout: 12000 });
  ok('click-to-play played e4', type((await ev(() => window.SG.board()))[0x34]) === 1);
  await page.waitForFunction('/your move/i.test(window.SG.status())', { timeout: 15000 }).catch(() => {});

  // 6. Claude asks to play a move -> page shows confirm box -> Play
  await rpc('play_move', { san: 'Nf3' }, true);
  await page.waitForFunction('document.getElementById("companion-cmd").textContent.length>0', { timeout: 8000 });
  ok('play command shows a confirm box', /Nf3/.test(await ev(() => document.getElementById('companion-cmd').textContent)));
  await ev(() => { const b = [...document.querySelectorAll('#companion-cmd button')].find(x => x.textContent === 'Play'); if (b) b.click(); });
  await page.waitForFunction('(window.SG.board()[0x25]&7)===2', { timeout: 12000 });
  ok('confirmed play put a knight on f3', type((await ev(() => window.SG.board()))[0x25]) === 2);

  ok('no console/page errors', errs.filter(e => !/favicon/i.test(e)).length === 0);
} catch (e) { console.log('ERR', e.message); fail++; }
finally { await browser.close(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
