# Spectral Gambit — AI Companion (MCP) design

A **pure-MCP** advisor: the player's own Claude (claude.ai / Desktop / Code)
connects to the live game through a remote **MCP server** and proposes candidate
moves. The conversation happens in the player's Claude app; the chess page shows
Claude's suggestions as click-to-play cards and a read-only log. **No API key**,
**off by default**, zero LLM cost to us (it's the user's own Claude).

## Why pure MCP (and what it means)
MCP connects an LLM-bearing **client** (Claude apps) to tool/data **servers**.
A web page can't borrow a Claude subscription, so:
- The **chat + the 3 alternatives are produced in the user's Claude app**, not the page.
- The page **mirrors** what Claude proposes (cards) and can **play** moves Claude picks.
- The page **cannot auto-trigger** Claude; the user prompts Claude (and can tell it
  "advise me after every move" — Claude re-reads the position via the connector each time).

## Topology
```
Browser (companion ON)                         User's Claude (claude.ai / Desktop / Code)
  • POST game state after each move                 • adds our remote MCP connector (one-time)
  • shows connector URL + pairing code              • the chat + 3 alternatives happen HERE
  • renders Claude's candidates as cards            • calls our MCP tools:
  • polls for suggestions / play commands               pair, get_position, get_history,
        │   /api/companion/*                              propose_candidates, play_move
        ▼                                                       ▲  MCP (Streamable HTTP)
   Cloudflare Worker  ── D1 (companion_* tables) ──  MCP server at /mcp  ┘
```

## MCP tools (exposed to the user's Claude)
| tool | args | effect |
|------|------|--------|
| `pair` | `code` | bind this Claude connection to the game session shown on the page |
| `get_position` | – | FEN, PGN, side to move, move number, engine eval, level, **legal moves (SAN)** |
| `get_history` | – | full move log / PGN |
| `propose_candidates` | `candidates:[{san,rationale}], comment?` | page shows the cards; server validates SAN vs legal moves |
| `play_move` | `san` | queues a move; page confirms + plays it (via the cursor/tap-to-move path) |

(Optional later: `board_ascii` to let Claude "see" the board; `set_level`, `new_game`.)

## Backend (Worker + D1) — extends the existing API
New D1 tables (keyed by an opaque `session_id`):
- `companion_sessions(id, code, mcp_bound, created_at, last_seen)`
- `companion_state(session_id, fen, pgn, side, eval, level, legal_moves, updated_at)`
- `companion_suggestions(session_id, candidates_json, comment, created_at)`
- `companion_commands(session_id, id, type, san, status, created_at)`

Page-facing endpoints:
- `POST /api/companion/open` → `{sessionId, code}` (new pairing code)
- `POST /api/companion/state` `{sessionId, fen, pgn, side, eval, level, legalMoves}`
- `GET  /api/companion/poll?sessionId=` → `{connected, suggestions, commands}`
- `POST /api/companion/ack` `{sessionId, commandId, result}`

MCP tools read/write the same tables for the **paired** session only.

## Position encoding (in the page)
Bundle **chess.js**: replay the move log (`{from,to,promotion}`) from the start to
get accurate **FEN / PGN / side / legal moves (SAN)**, and to map a clicked card's
SAN back to `{from,to}` for the existing `navTo` play path. After each replay,
**consistency-check** chess.js's placement against `SG.board()`; on mismatch, fall
back to building FEN from emulator RAM (castling/EP read via `sg_peek`) or flag.

## Page UI — "AI Companion (MCP)" panel (off by default)
- **Enable** toggle.
- **Connect card**: connector URL, a short **pairing code**, tabbed setup for
  claude.ai / Desktop / Code, and a live **status** ("Waiting for Claude…" →
  "Claude connected ✓").
- **Suggestion cards**: Claude's 3 candidates (move + rationale) with **Play** buttons;
  plus Claude's free-text `comment`.
- **Companion log**: read-only feed mirroring recent suggestions/comments.
- **Play command**: when Claude calls `play_move`, show "Claude wants to play Nf3 —
  [Play] [Dismiss]" (confirm by default; an optional "auto-play Claude's moves" switch).
- **Privacy note**: "Your board position is shared with your Claude via the connector."

## Auth / pairing (v1 recommendation)
**No-auth Streamable-HTTP MCP server + a `pair(code)` gate.** The connector itself
needs no login; the first tool call must be `pair` with the code from the page, which
binds that MCP session to the game. Codes are short-lived and rotate on new game; chess
positions are low-sensitivity. *Risk:* if claude.ai's custom-connector flow requires
OAuth, add a minimal OAuth layer (Cloudflare `workers-oauth-provider`). Verify during P3.

## Implementation phases
1. **Position** — add chess.js + `position.js` (FEN/PGN/legal/SAN↔from-to) + consistency check.
2. **Backend** — D1 tables + `/api/companion/*`; page open/push/poll plumbing.
3. **MCP server** — hand-rolled minimal Streamable-HTTP JSON-RPC at `/mcp`
   (initialize / tools/list / tools/call) backed by D1; deploy. (Hand-rolled to stay
   node-18 / wrangler-3 friendly and dependency-light.)
4. **Page UI** — the Companion panel (toggle, connect card, status, cards, log, play-confirm).
5. **Docs** — in-page + `COMPANION.md`: claude.ai connector, Desktop (`mcp-remote`), Code (`claude mcp add`).
6. **Tests** — headless: off-by-default, open/pair (drive tools directly), cards render,
   click-to-play, play-command confirm; + an MCP client integration test against `/mcp`.

## Defaults I'll use unless told otherwise
- Auth: **no-auth + pairing code** (escalate to OAuth only if claude.ai requires it).
- Claude's moves: **confirm before playing** (with an opt-in auto-play switch).
- Candidates: **3** (Claude may send more; page shows all, highlights top 3).
- MCP server: **hand-rolled** minimal JSON-RPC (no heavy SDK) for toolchain compatibility.

## Costs / footprint
- LLM: **$0 to us** (user's Claude). Worker + D1 stay within free tier.
- New deps: chess.js (small, client-side). No new server deps if MCP is hand-rolled.
