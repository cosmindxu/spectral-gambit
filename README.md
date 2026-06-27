# Spectral Gambit

**8-bit chess against an AI that wrote itself.** Play a chess engine
hand-written in Z80 assembly (by Fable), running on a faithful emulation of
the ICE Felix **HC-91** — a Romanian ZX Spectrum clone — compiled to
**WebAssembly** and running entirely in your browser.

> *Spectrum + the ghost in the machine = Spectral. Chess = Gambit.*

## What it does

- **The real machine, in your browser.** The hc91emu Z80 core + the actual
  `chess.tap` are compiled to WASM (`src/web.c` + Emscripten). Every move is
  the genuine 8-bit engine searching — alpha-beta, transposition tables,
  quiescence, the lot.
- **Put it down, come back hours later.** Full machine state auto-saves
  (`.szx`) to your browser after every move; a "Resume" banner restores the
  exact position. Named save slots + export/import too.
- **Live move log** derived by diffing the emulator's 0x88 board → PGN.
- **Compete** (`backend/`):
  - **Engine ladder** — beat the AI at rising strengths; ranked leaderboard.
  - **Play a friend** — correspondence chess: each side plays one ply in the
    emulator's two-player mode, then the `.szx` is passed on via the API.
    Hours or days between moves; the save-state holds everything.

## Layout

```
src/web.c            Emscripten entry point over the hc91emu core
build.sh             compile the WASM core (needs emcc)
web/                 the static front-end (this is what you deploy)
  index.html app.js compete.js chess.js config.js style.css
  spectral.js/.wasm  built core (embeds 48.rom + chess.tap)
backend/             Cloudflare Worker + D1 (worker.js, schema.sql, wrangler.toml)
  devserver.py       identical API in Python/SQLite for local testing
verify.mjs           headless node check: boot, render PNG, play e2-e4
test_movelog.mjs     move-log derivation test vs real emulator boards
DEPLOY.md            how to ship it
```

## Run locally

```sh
cd backend && python3 devserver.py 8100 &
cd ../web && python3 -m http.server 8099 &
# open http://localhost:8099/
```

Built on [hc91emu](https://github.com/cosmindxu/hc91emu) and its ZX-CHESS engine.
