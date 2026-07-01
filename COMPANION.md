# Spectrum Gambit — AI Companion (MCP) setup

Let **your own Claude** advise your live game. It's **off by default** and uses
**no API key** — it connects to a remote **MCP** server that exposes the position,
and the conversation happens in your Claude app. The chess page shows Claude's
three suggestions as click-to-play cards.

- **Connector URL:** `https://spectrum-gambit-api.cosmindxu.workers.dev/mcp`
- **Pairing code:** shown on the page after you toggle **AI Companion → Enable**
  (a 6-character code like `MLX3ZJ`).

The pairing code is the access gate: Claude can only see *your* game after you
tell it to `pair` with that code. Codes are per-session.

## Set up in claude.ai (Pro / Max / Team)
1. **Settings → Connectors → Add custom connector.**
2. Paste the **Connector URL**. No authentication is required.
3. In any chat, say: **"pair with code `XXXXXX`"** (the code from the page).
4. Ask: **"What are my best three moves?"** — Claude reads the position and replies;
   its three candidates also appear as **Play** cards on the page.

## Set up in Claude Desktop
Add the server to `claude_desktop_config.json` (Settings → Developer → Edit Config),
using the `mcp-remote` bridge:
```json
{
  "mcpServers": {
    "spectrum-gambit": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://spectrum-gambit-api.cosmindxu.workers.dev/mcp"]
    }
  }
}
```
Restart Claude Desktop, then tell it to **pair** with the code on the page.

## Set up in Claude Code
```sh
claude mcp add --transport http spectrum-gambit \
  https://spectrum-gambit-api.cosmindxu.workers.dev/mcp
```
Then, in a session, tell it to **pair** with the code and ask for advice.

## What Claude can do (MCP tools)
| tool | what it does |
|------|--------------|
| `pair` | bind to your game using the page's 6-char code (call first) |
| `get_position` | FEN, PGN, side to move, engine eval, level, and the legal moves |
| `get_history` | the move list so far (PGN) |
| `propose_candidates` | show up to 5 candidate moves (ideally 3) + rationales as cards on your page |
| `play_move` | ask the page to play a move (you confirm on the board, unless you enable auto-play) |

## How it plays together
- After **every** move you make, the page re-shares the new position, so Claude is
  always current the next time you ask it.
- Suggested moves are **validated** against the real legal moves; an illegal
  suggestion is flagged on the card.
- **Play** on a card (or confirming a `play_move`) plays it on the real emulated
  board via the normal cursor path.

## Privacy & notes
- Your board position (FEN/PGN) is shared with **your** Claude through the connector.
  Nothing else about you is sent; there's no account or key.
- The page can't auto-trigger Claude — Claude advises when **you** ask it. To get
  advice each move, just tell Claude once: *"advise me after every move,"* and ask
  it to re-check when you've moved.
- Turn the companion off any time with the **Enable** toggle.
