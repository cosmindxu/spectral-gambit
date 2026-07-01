# Deploying Spectrum Gambit

The site is **static** (WASM + JS + assets) plus a small **API** (leaderboard +
correspondence games). Two moving parts:

| Part | What | Host |
|------|------|------|
| Front-end | `web/` — the game, runs entirely in the browser | GitHub Pages (or any static host / the Worker itself) |
| API | `backend/worker.js` + D1 | Cloudflare Workers + D1 |

Single-player + local save-states need **no backend** — only the compete
features (ladder, leaderboard, play-a-friend) call the API.

---

## 1. Backend — Cloudflare Worker + D1

```sh
cd backend
npm i -g wrangler            # if not installed
wrangler login              # opens browser OAuth (run via `! wrangler login`)

# create the database, then paste its id into wrangler.toml
wrangler d1 create spectrum-gambit
#   -> copy database_id into wrangler.toml [[d1_databases]]

# apply the schema (remote = the live D1)
wrangler d1 execute spectrum-gambit --remote --file=schema.sql

wrangler deploy             # prints https://spectrum-gambit-api.<you>.workers.dev
```

Test it:
```sh
curl https://spectrum-gambit-api.<you>.workers.dev/api/leaderboard
```

## 2. Front-end

Point the site at the Worker by editing **`web/config.js`**:
```js
window.SG_API_BASE = 'https://spectrum-gambit-api.<you>.workers.dev';
```

### Option A — GitHub Pages (matches your existing repo)
```sh
# from a checkout that has web/ at the root of a gh-pages branch, or use /docs
cp -r web/* <pages-publish-dir>/
git add . && git commit -m "Spectrum Gambit" && git push
# enable Pages -> branch -> /(root) or /docs in repo settings
```
Make sure `spectrum.wasm`, `spectrum.js`, `chess.tap` (embedded) ship too.

### Option B — one Cloudflare Worker for everything (no CORS, no config)
Serve `web/` as static assets from the same Worker that hosts `/api`, then
leave `SG_API_BASE = ''`. Add to `wrangler.toml`:
```toml
[assets]
directory = "../web"
```
and `wrangler deploy`. Site and API share an origin.

---

## 3. Rebuild the WASM core (only if the emulator/chess changes)
```sh
./build.sh            # needs emcc (apt install emscripten)
```

## Local development
```sh
cd backend && python3 devserver.py 8100 &   # API on :8100 (sqlite)
cd ../web && python3 -m http.server 8099 &   # site on :8099
# open http://<lan-ip>:8099/  — compete.js auto-targets :8100
```
