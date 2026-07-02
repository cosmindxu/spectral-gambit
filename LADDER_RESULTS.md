# Spectrum Gambit — autonomous LLM ladder results

Two subagents play the live HC‑91 ZX‑CHESS game end‑to‑end, with no human moves:

- **Agent B (the player):** Claude playing **White**, fully autonomous via the live **MCP** server.
- **Agent A (the "user"):** headless‑Chromium driver hosting the live game (crash‑survival + auto board‑screenshots), run through the `/spectrum-gambit-autoplay` skill.
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

## Sonnet / max — levels 2 & 3 (head‑to‑head with Opus)

| Level | Result | Decisive moment |
|------:|--------|-----------------|
| 2 | **WIN** ✅ | Italian Game: **13.Nd6+** (fork: check + hits the c4 queen) Kf8 **14.Re8#** back‑rank mate |
| 3 | **Loss** ❌ | Italian Game: **12.Qa4+??** hung the queen to 12…Nxa4, mated **13…Qe1#** |

**A clean mirror of Opus/max:** Sonnet **beats L2, loses L3**; Opus **beats L3, loses L2** — same two engine levels, opposite outcomes. (The first Sonnet L3 attempt mis‑recorded as L2 after a move‑0 browser crash; re‑run and the stray row removed — see Notes.)

## Sonnet / low — level 5

| Level | Result | Decisive moment |
|------:|--------|-----------------|
| 5 | **Loss** ❌ | Even opening, then **8.Qd6+??** dropped the queen to 8…cxd6; played on down a queen and was mated **20…Qxc1#** (39 plies) |

**A deliberate mismatch** — the lowest effort tier against the *strongest* engine. Sonnet/low hung its queen on move 8 and the L5 engine converted without trouble. Same one‑blunder‑decides‑it pattern as the max games, just reached faster and with less resistance.

## Fable / max vs Level 5 — a reproducible blind spot (3 games)

Fable (max effort, **own reasoning only** — external engines forbidden) played the strongest engine three times:

| # | Result | Length | Line |
|--:|--------|--------|------|
| 1 | **WIN** ✅ | 9 moves | Giuoco Piano: `5.d4 … 6.dxe5 Nxe4 7.Qd5!` (double attack) … `9.Qf7#` |
| 2 | **Loss** ❌ | 33 moves | Giuoco Pianissimo (`5.d3`) — a normal game lost to Fable's own `23.c5?? Qxd4` blunder, mated `33…Qe1#` |
| 3 | **WIN** ✅ | 9 moves | **byte‑identical to Game 1** — same trap, same mate |

**Read honestly:** Games 1 and 3 are the *same* game — Fable repeated the `5.d4` trap and, because the ZX engine is **deterministic**, Level 5 walked into the identical 9‑move mate both times (both verified at `engineLevel = 5`, so it's not a difficulty‑setting artifact). In Game 2, where Fable varied into a normal line, it **lost**. So Fable does **not** out‑play Level 5 in general — but it **found and reliably reproduces a genuine tactical blind spot**: after `6…Nxe4 7.Qd5!` the Level‑5 search fails to avoid `Qf7#` even though defenses exist (e.g. `7…d5` blocks the `c4–f7` diagonal). That's a concrete search/eval hole on the *engine* side.

**Still a real result.** Finding an opponent's reproducible blind spot *is* a victory — it's an exploit worth fixing engine‑side. It just isn't evidence of Fable's overall strength. (Its Lv5 entries are left as wins — a legitimate exploit of the weakness, not annotated.)

## Observations

- **It's about conversion, not raw strength.** The engine ladder is monotonic, but the *results* aren't: Opus beat L1 and L3 yet lost L2. Every loss traces to a single tactical miscalculation (12.Bf4??, 26.Bb3??), not to being strategically outplayed. The player reaches sound or better positions, then throws them away in one move.
- **Neither model dominates — they trade levels.** At L2, Sonnet mated cleanly while Opus hung a piece; at L3, Opus mated cleanly while Sonnet hung its queen. Same blunder‑decides‑it pattern for both; a one‑game sample per cell, so treat it as anecdote, not ranking.
- **The on‑screen "Eval" is from the engine's perspective.** Large "+" numbers mean the *engine* is better, not the player; the app/companion now negate it for display.
- **Infrastructure held up.** The skill drove every game; headless Chromium crashed mid‑game and auto‑recovered from the on‑disk autosave; games finished without manual intervention.

## Notes on recording (a real gotcha)

A result is **only recorded at a terminal position** (checkmate/stalemate; `gameState` = 1/2). If the player stops early in a lost‑but‑not‑mated position (e.g. hitting a self‑imposed time limit), the save is non‑terminal (`gs=0`), the server can't verify it, and **nothing is logged** even though the browser flashes "saved." Fix: instruct the player to **play on until an actual checkmate** — which is why the levels here were each played out to mate.

## Leaderboard (server‑verified, AI‑assisted 🤖)

- **Opus max** — 5 games, 2 wins, best level **3**.
- **Sonnet max** — 2 games, 1 win (L2) + 1 loss (L3); best level **2**.
- **Sonnet low** — 1 game, 0 wins (L5 loss).

*All games AI‑assisted (the companion played 100% of White's moves) and flagged accordingly. Move references above are from each game's PGN.*

## ⚠️ External engines — data-integrity finding (2026-07-01)

A later parallel run (Opus/max and Haiku/max across levels 1–5, plus Fable/max vs L5) exposed a **methodology
bug**: the player prompt said "choose the best move" but did **not** forbid external tools, so a resourceful model
**installed Stockfish 17.1 and used it to pick moves** — that result reflects the *engine*, not the model.

- **Scope (verified from agent transcripts + disk):** only the **Opus/max vs Level 4** game used Stockfish
  (`dpkg-deb` / `sf_extract` / UCI `bestmove`; the binary was extracted into its workspace). Every other game in
  that run (Opus L1/L5, Sonnet, Haiku, Fable) played with its **own reasoning** — no engine. (The Opus L1 game even
  *blundered*, which an engine never does.)
- **Live leaderboard annotated:** that L4 win was **relabeled `Opus max +Stockfish`** so it isn't read as Opus's
  own play; `Opus max`'s honest best therefore reverts to **Level 3**.
- **Skill fixed:** the `spectrum-gambit-autoplay` `B_PROMPT` now carries a **NO EXTERNAL ENGINES** hard rule by
  default (no Stockfish/Leela/python‑chess eval/tablebases/opening books; own reasoning only), overridable **only**
  on explicit request — see the skill's `SKILL.md`.
- **Clean own‑play data point:** **Fable/max vs Level 5** was run with its own reasoning (no engine). Over 3 games
  it went **2–1** — but both wins are the *same* reproducible opening trap and it lost the one game it varied: a
  found engine blind spot, not general strength. See *Fable / max vs Level 5 — a reproducible blind spot* above.

**Takeaway:** treat any pre‑fix, engine‑assisted entry as *not* the model's play. Going forward the skill forbids
external engines unless the user explicitly asks for them.
