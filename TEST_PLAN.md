# Spectrum Gambit — UI test plan

Exhaustive, automated coverage of every button, text field and input, plus
two-consecutive-input sequences. Executed in a **real headless Chromium**
(`test/run.mjs`, puppeteer-core) against the live emulator, DOM, and the
correspondence/leaderboard API. Each case runs on a clean reload and fails
if it triggers any console/page error.

Run it:

```sh
# needs the static site on :8099 and the dev API on :8100
cd test && node run.mjs            # full suite
ONLY=B3,J2 node run.mjs            # a subset by id
```

## Coverage

### A — boot & rendering
| id | case | assertion |
|----|------|-----------|
| A1 | first load | boots to "Your move", zero console errors |
| A2 | canvas paints | board region has multiple distinct colours (not blank) |
| A3 | panel readout | Level 2, Material 0.00 at start |

### B — tap-to-move (canvas clicks, the new feature)
| id | case | assertion |
|----|------|-----------|
| B1 | tap e2 then e4 | pawn moves e2→e4, engine replies (log +2) |
| B2 | tap g1 then f3 | knight develops to f3 |
| B3 | **Flip → tap e2,e4** | flipped board still maps clicks to the right squares; move plays |
| B4 | toggle OFF → tap board | no cursor movement, no move |
| B5 | toggle off/on | preference persists in localStorage |

### C — D-pad & physical keyboard
| id | case | assertion |
|----|------|-----------|
| C1 | D-pad ENTER,▲,▲,ENTER | plays e2–e4 |
| C2 | keyboard arrows + Enter | plays a move |
| C3 | **move → keyboard "N"** | new game resets the board |

### D — control buttons
| id | case | assertion |
|----|------|-----------|
| D1 | Strength 1/5/3 | Level readout follows each press |
| D2 | **move → New game** | board reset, move log cleared |
| D3 | **move → Take back** | last move undone |
| D4 | Flip ×2 | orientation toggles back and forth |
| D5 | Colour | scheme name on screen changes |
| D6 | **move → Copy PGN** | clipboard holds the move text |

### E — save / load / import / export
| id | case | assertion |
|----|------|-----------|
| E1 | name + Save | named slot stored & listed |
| E2 | **save → New game → Load slot** | saved position restored |
| E3 | save → Delete slot | slot removed |
| E4 | Export | produces >1 KB of .szx, no error |
| E5 | **move → export → New game → Import** | imported file restores the position |

### F — resume flow (the "long pause" feature)
| id | case | assertion |
|----|------|-----------|
| F1 | **move → reload** | auto-resumes; banner shows a real timestamp (no empty parens) |
| F2 | reload → Dismiss | banner hides; game continues |
| F3 | reload → Start a new game | save wiped, fresh board |

### G — input-field safety (the iOS bug we fixed)
| id | case | assertion |
|----|------|-----------|
| G1 | type "Nf3test" in slot name | text enters the field; cursor/board untouched (no stray "N"=new game) |
| G2 | type in player name | board untouched |
| G3 | **type name → Save** | slot saved under the sanitised name |

### H — compete: engine ladder
| id | case | assertion |
|----|------|-----------|
| H1 | enter player name | persists to localStorage |
| H2 | leaderboard | renders rows from the API |
| H3 | report a win | posts to API; player appears on the leaderboard |

### I — compete: async correspondence (human vs human)
| id | case | assertion |
|----|------|-----------|
| I1 | Create game | active panel + share link `?g=…`; creator is White |
| I2 | **Submit before moving** | warned; server move count stays 0 |
| I3 | **move → Submit** | server records the move; turn passes to Black |
| I4 | Copy link | share URL on the clipboard |
| I5 | Leave | returns to the create state; local game cleared |

### J — extra two-input sequences
| id | case | assertion |
|----|------|-----------|
| J1 | **Strength change → move** | new level retained through the move |
| J2 | **move → move** | two moves build a 4-ply log |
| J3 | **Flip → New game** | consistent, no errors |
| J4 | tap same square twice | pick-up then put-down leaves the board intact |

### K — real (wall-clock) chess clock
| id | case | assertion |
|----|------|-----------|
| K1 | default | no clock shown (pause-anytime mode) |
| K2 | pick a time control | both clocks appear at the base time |
| K3 | your turn | your clock ticks down in real seconds |
| K4 | reload | time-control choice persists |
| K5 | **move** | increment is added to your clock after your move |

(Bold = a two-consecutive-different-input sequence.)

## Bugs this suite found and fixed
1. **Stale "Level" readout** — strength change set the engine depth (`aiDepth`)
   but the on-screen label only repainted on a full redraw. Fixed: the panel
   now reads `aiDepth` from RAM directly (always current).
2. **Test-harness reset leak** — the auto-save-on-unload re-created a game
   during reset, leaking position/flip between cases. Fixed with a test-only
   `__sgNoSave` guard.

Two environmental notes (test infra, not app bugs): node-18 resolves
`localhost`→IPv6 so the API client uses `127.0.0.1`; and headless Chromium
must be kept foregrounded (`bringToFront` + occlusion flag) or it throttles
`requestAnimationFrame` and starves the emulator loop.
