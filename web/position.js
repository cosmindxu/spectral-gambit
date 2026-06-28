// position.js — build an accurate FEN + legal-move list for the AI Companion
// DIRECTLY from the emulator's authoritative state (board + side-to-move +
// castling + en-passant, all read from RAM), so the position can never drift
// from the board. chess.js is used only to derive legal moves and map SAN
// back to {from,to} for click-to-play.
import { Chess } from './vendor/chess.js';

const T2C = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };
const sq2alg = (sq) => String.fromCharCode(97 + (sq & 7)) + (((sq >> 4) & 7) + 1);

function placement(board) {
  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const byte = board[rank * 16 + file], t = byte & 7, c = (byte >> 3) & 1;
      if (t === 0) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const ch = T2C[t];
      row += c ? ch : ch.toUpperCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}
function castlingStr(v) { let s = ''; if (v & 1) s += 'K'; if (v & 2) s += 'Q'; if (v & 4) s += 'k'; if (v & 8) s += 'q'; return s || '-'; }
function toMovetext(history) { let out = '', n = 1; for (let i = 0; i < (history || []).length; i++) { if (i % 2 === 0) out += (n++) + '. '; out += history[i].san + ' '; } return out.trim(); }
function sanLookup(verbose) {
  return (san) => {
    const clean = String(san).replace(/[+#]$/, '');
    const m = verbose.find(v => v.san === san || v.san.replace(/[+#]$/, '') === clean);
    return m ? { from: m.from, to: m.to, promotion: m.promotion || undefined } : null;
  };
}

// st: {board, stm, castling, ep, halfmove, fullmove, gameState, history}
export function buildPosition(st) {
  const side = (st.stm & 8) ? 'b' : 'w';
  const cr = castlingStr(st.castling | 0);
  const ep = (st.ep === undefined || st.ep === 0xFF || (st.ep & 0x88)) ? '-' : sq2alg(st.ep);
  const board = placement(st.board);
  let fen = `${board} ${side} ${cr} ${ep} ${st.halfmove | 0} ${st.fullmove || 1}`;
  let chess = null, ok = true;
  try { chess = new Chess(fen); }
  catch (e) {                                   // RAM rights inconsistent for chess.js? retry minimal
    try { fen = `${board} ${side} - - 0 ${st.fullmove || 1}`; chess = new Chess(fen); ok = false; }
    catch (e2) { chess = null; ok = false; }
  }
  const verbose = chess ? chess.moves({ verbose: true }) : [];
  return {
    ok, fen, side, moveNumber: st.fullmove || 1,
    pgn: toMovetext(st.history),
    legal: chess ? chess.moves() : [],
    inCheck: chess ? chess.inCheck() : false,
    isOver: (st.gameState | 0) !== 0,
    sanToMove: sanLookup(verbose),
  };
}

// Read the authoritative state from the emulator (via the window.SG bridge).
export function readState(SG) {
  return {
    board: SG.board(),
    stm: SG.peek(0xE080),        // sideToMove (0=w, 8=b)
    castling: SG.peek(0xE081),   // bit0 WK,1 WQ,2 BK,3 BQ
    ep: SG.peek(0xE082),         // en-passant target 0x88 square, 0xFF none
    halfmove: SG.peek(0xE083),
    fullmove: SG.peek(0xE093) | (SG.peek(0xE094) << 8),
    gameState: SG.peek(0xE088),  // 0 play, else over
    history: SG.history(),
  };
}
