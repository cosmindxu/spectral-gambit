// Spectral Gambit — Cloudflare Worker API (D1-backed).
//
// Routes (all JSON unless noted):
//   POST /api/games            {mode,name}            -> {id,color,token,join}
//   POST /api/games/:id/join   {name}                 -> {id,color,token}
//   GET  /api/games/:id                               -> game meta + movelog
//   GET  /api/games/:id/state                         -> {szx}
//   POST /api/games/:id/move   {token,szx,movelog,result?} -> {ok,turn,status}
//   POST /api/ladder           {name,level,result,moves}  -> {ok,rank}
//   GET  /api/leaderboard                             -> {ladder,recent}
//
// Async human-vs-human is correspondence chess: each side plays one ply
// in the emulator's two-player mode, then POSTs the new .szx; the server
// flips the turn. Turns are enforced by the per-side token.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const bad = (m, s = 400) => json({ error: m }, s);
const now = () => Date.now();
const id6 = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const tok = () => crypto.randomUUID().replace(/-/g, '');

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '');
    const db = env.DB;
    try {
      if (req.method === 'POST' && p === '/api/games')      return createGame(req, db);
      let m;
      if ((m = p.match(/^\/api\/games\/([\w-]+)\/join$/)) && req.method === 'POST')  return joinGame(req, db, m[1]);
      if ((m = p.match(/^\/api\/games\/([\w-]+)\/state$/)) && req.method === 'GET')  return getState(db, m[1]);
      if ((m = p.match(/^\/api\/games\/([\w-]+)\/move$/))  && req.method === 'POST') return postMove(req, db, m[1]);
      if ((m = p.match(/^\/api\/games\/([\w-]+)$/))        && req.method === 'GET')  return getGame(db, m[1]);
      if (p === '/api/ladder'      && req.method === 'POST') return postLadder(req, db);
      if (p === '/api/leaderboard' && req.method === 'GET')  return leaderboard(db);
      return bad('not found', 404);
    } catch (e) {
      return bad('server error: ' + e.message, 500);
    }
  },
};

async function createGame(req, db) {
  const { mode = 'h2h', name = 'White' } = await req.json().catch(() => ({}));
  const id = id6(), wt = tok(), t = now();
  await db.prepare(
    `INSERT INTO games (id,mode,status,turn,white_name,white_token,movelog,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(id, mode, 'waiting', 'white', name.slice(0, 24), wt, '[]', t, t).run();
  return json({ id, color: 'white', token: wt });
}

async function joinGame(req, db, id) {
  const { name = 'Black' } = await req.json().catch(() => ({}));
  const g = await db.prepare('SELECT * FROM games WHERE id=?').bind(id).first();
  if (!g) return bad('game not found', 404);
  if (g.black_token) return bad('game already has two players', 409);
  const bt = tok();
  await db.prepare('UPDATE games SET black_name=?,black_token=?,status=?,updated_at=? WHERE id=?')
    .bind(name.slice(0, 24), bt, 'active', now(), id).run();
  return json({ id, color: 'black', token: bt });
}

async function getGame(db, id) {
  const g = await db.prepare('SELECT * FROM games WHERE id=?').bind(id).first();
  if (!g) return bad('game not found', 404);
  return json({
    id: g.id, mode: g.mode, status: g.status, turn: g.turn,
    white: g.white_name, black: g.black_name,
    movelog: JSON.parse(g.movelog || '[]'), hasState: !!g.szx,
    result: g.result, updated_at: g.updated_at,
  });
}

async function getState(db, id) {
  const g = await db.prepare('SELECT szx FROM games WHERE id=?').bind(id).first();
  if (!g) return bad('game not found', 404);
  return json({ szx: g.szx || null });
}

async function postMove(req, db, id) {
  const body = await req.json().catch(() => ({}));
  const { token, szx, movelog, result } = body;
  const g = await db.prepare('SELECT * FROM games WHERE id=?').bind(id).first();
  if (!g) return bad('game not found', 404);
  const side = token === g.white_token ? 'white' : token === g.black_token ? 'black' : null;
  if (!side) return bad('invalid token', 403);
  if (g.status === 'over') return bad('game is over', 409);
  if (g.turn !== side) return bad('not your turn', 409);
  if (typeof szx !== 'string' || szx.length > 400000) return bad('bad state');
  const next = side === 'white' ? 'black' : 'white';
  const status = result ? 'over' : (g.black_token ? 'active' : 'active');
  await db.prepare('UPDATE games SET szx=?,movelog=?,turn=?,status=?,result=?,updated_at=? WHERE id=?')
    .bind(szx, JSON.stringify(movelog || JSON.parse(g.movelog || '[]')), next, status,
          result || g.result || null, now(), id).run();
  return json({ ok: true, turn: next, status });
}

async function postLadder(req, db) {
  const { name, level, result, moves } = await req.json().catch(() => ({}));
  if (!name || !level || !result) return bad('name, level, result required');
  await db.prepare('INSERT INTO ladder (name,level,result,moves,created_at) VALUES (?,?,?,?,?)')
    .bind(String(name).slice(0, 24), level | 0, result, moves | 0, now()).run();
  const rows = await leaderRows(db);
  const rank = rows.findIndex(r => r.name === String(name).slice(0, 24)) + 1;
  return json({ ok: true, rank });
}

async function leaderRows(db) {
  // Rank by highest level beaten, then total wins.
  const { results } = await db.prepare(`
    SELECT name,
           MAX(CASE WHEN result='win' THEN level ELSE 0 END) AS best,
           SUM(CASE WHEN result='win' THEN 1 ELSE 0 END)     AS wins,
           COUNT(*)                                          AS games
    FROM ladder GROUP BY name
    ORDER BY best DESC, wins DESC, games ASC LIMIT 100`).all();
  return results || [];
}

async function leaderboard(db) {
  const ladder = await leaderRows(db);
  const recent = (await db.prepare(
    'SELECT name,level,result,moves,created_at FROM ladder ORDER BY created_at DESC LIMIT 12').all()).results || [];
  return json({ ladder, recent });
}
