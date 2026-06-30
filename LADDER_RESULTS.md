# Spectral Gambit — autonomous LLM ladder results

Two subagents play the live HC‑91 ZX‑CHESS game end‑to‑end, with no human moves:

- **Agent B (the player):** Claude playing **White**, fully autonomous via the live **MCP** server.
- **Agent A (the "user"):** headless‑Chromium driver hosting the live game (crash‑survival + auto board‑screenshots), run through the `/spectral-gambit-autoplay` skill.
- **Method:** one game per engine level, **clock off**, played **all the way to a forced checkmate** (the engine never resigns, and the leaderboard only records a *terminal* position — see Notes). Each result is **server‑verified** from the final FEN.

## Opus / max — full ladder (levels 1–5)

| Level | Result | Decisive moment |
|------:|--------|-----------------|
| 1 | **WIN** ✅ | Italian Game miniature: 6.dxe5 Nxe4 **7.Qd5!** (double attack) … **9.Qf7#** |
| 2 | **Loss** ❌ | Balanced opening, then **12.Bf4??** hung the bishop to 12…exf4; never recovered, mated **35…Qf2#** |
| 3 | **WIN** ✅ | Giuoco Piano: engine blundered 6…Nxe4, **7.Qd5!**, **9.Qf7#** |
| 4 | **Loss** ❌ | Was better (≈+0.5) until **26.Bb3??** — a back‑rank gamble Black refuted with 26…Rxd3, winning the queen |
| 5 | **Loss** ❌ | Unsound, over‑aggressive sacrifices the strongest engine refuted (~20 moves) |

**Opus/max record: 2 wins (L1, L3), 3 losses (L2, L4, L5); best level reached with a win = 3.**

## Sonnet / max — level 2 (head‑to‑head with Opus)

| Level | Player | Result | Decisive moment |
|------:|--------|--------|-----------------|
| 2 | **Sonnet / max** | **WIN** ✅ | Italian Game: **13.Nd6+** (fork: check + hits the c4 queen) Kf8 **14.Re8#** back‑rank mate |

**Sonnet/max won the exact level Opus/max lost** — same engine strength, opposite outcome.

## Observations

- **It's about conversion, not raw strength.** The engine ladder is monotonic, but the *results* aren't: Opus beat L1 and L3 yet lost L2. Every loss traces to a single tactical miscalculation (12.Bf4??, 26.Bb3??), not to being strategically outplayed. The player reaches sound or better positions, then throws them away in one move.
- **Sonnet ≥ Opus here, on this sample.** At L2, Sonnet found a clean 14‑move mating attack while Opus hung a piece on move 12. One game each, so it's anecdotal — but striking.
- **The on‑screen "Eval" is from the engine's perspective.** Large "+" numbers mean the *engine* is better, not the player; the app/companion now negate it for display.
- **Infrastructure held up.** The skill drove every game; headless Chromium crashed mid‑game and auto‑recovered from the on‑disk autosave; games finished without manual intervention.

## Notes on recording (a real gotcha)

A result is **only recorded at a terminal position** (checkmate/stalemate; `gameState` = 1/2). If the player stops early in a lost‑but‑not‑mated position (e.g. hitting a self‑imposed time limit), the save is non‑terminal (`gs=0`), the server can't verify it, and **nothing is logged** even though the browser flashes "saved." Fix: instruct the player to **play on until an actual checkmate** — which is why the levels here were each played out to mate.

## Leaderboard (server‑verified, AI‑assisted 🤖)

- **Opus max** — 5 games, 2 wins, best level **3**.
- **Sonnet max** — 1 game, 1 win (level **2**).

*All games AI‑assisted (the companion played 100% of White's moves) and flagged accordingly. Move references above are from each game's PGN.*
