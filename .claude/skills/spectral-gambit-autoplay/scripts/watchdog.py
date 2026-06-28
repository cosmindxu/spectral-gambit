#!/usr/bin/env python3
# Read-only watchdog for the autonomous Spectral Gambit game. Pairs a monitor
# session to the live MCP server (using the code agent A published in
# code.txt) and polls the authoritative position every 30s. Exits (which
# notifies the parent) on: result saved, game over, or a real B-stall
# (White to move but no move for >5 min). Long Black-to-move thinks are just
# the engine and are NOT flagged. Logs to $SG_DIR/watchdog.log.
#
# Gotcha baked in: Cloudflare 403s urllib's default User-Agent — we set a
# curl-like UA so the requests get through.
import json, time, os, urllib.request
DIR = os.environ.get('SG_DIR', '/tmp/sg_game')
MCP = os.environ.get('SG_MCP', 'https://spectral-gambit-api.cosmindxu.workers.dev/mcp')
LOG = DIR + '/watchdog.log'
def w(m):
    open(LOG, 'a').write(time.strftime('%H:%M:%S ') + m + '\n')
def rpc(method, params=None, call=False, sid=None):
    body = {'jsonrpc': '2.0', 'id': 1, 'method': ('tools/call' if call else method),
            'params': ({'name': method, 'arguments': params or {}} if call else (params or {}))}
    h = {'Content-Type': 'application/json', 'User-Agent': 'curl/8.0 spectral-gambit-watchdog'}
    if sid: h['Mcp-Session-Id'] = sid
    req = urllib.request.Request(MCP, data=json.dumps(body).encode(), headers=h)
    r = urllib.request.urlopen(req, timeout=25)
    return json.loads(r.read() or b'{}'), r.headers.get('Mcp-Session-Id')

res, sid = rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'wd', 'version': '1'}})
code = open(DIR + '/code.txt').read().strip()
rpc('pair', {'code': code}, True, sid)
w('watchdog started, paired code=' + code)

prev, stall = None, time.time()
reason = 'max-time'
for i in range(360):                      # 360 * 30s = 3h ceiling
    if os.path.exists(DIR + '/result.json'):
        reason = 'RESULT SAVED (driver finished)'; break
    try:
        res, _ = rpc('get_position', {}, True, sid)
        d = json.loads(res['result']['content'][0]['text'])
        side, fen, lc = d['sideToMove'], d['fen'], len(d['legalMoves'])
    except Exception as e:
        w('poll error ' + str(e)); time.sleep(30); continue
    now = time.time()
    if fen != prev:
        prev, stall = fen, now
        w(f'progress side={side} legal={lc} {fen}')
    el = now - stall
    if lc == 0:
        reason = 'GAME OVER (no legal moves) ' + fen; break
    if side == 'white' and el > 300:
        reason = f'STALL: White to move but no move for {int(el)}s - agent B not proceeding. fen={fen}'; break
    if side == 'black' and int(el) % 120 < 30 and el > 180:
        w(f'engine still thinking {int(el)}s (deep search; not a B stall)')
    time.sleep(30)
w('WATCHDOG EXIT: ' + reason)
print(reason)
