// position.js — turn the running game into an accurate FEN + legal-move list
// for the AI Companion. Replays the move log (from board diffs) into chess.js,
// then cross-checks the result against the emulator's authoritative 0x88 board.
// On any mismatch it degrades to a placement-only FEN so we never lie to Claude.
import { Chess } from './vendor/chess.js';

const T2C = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };   // emu type -> chess.js type
const sqName = (rank, file) => String.fromCharCode(97 + file) + (rank + 1);

// history: [{side,san,from,to,capture,promo,castle}], board88: Uint8Array|Array(128)
export function buildPosition(history, board88) {
  const chess = new Chess();
  let desync = false;
  for (const ply of history || []) {
    let mv;
    if (ply.castle) {
      mv = { from: ply.side === 0 ? 'e1' : 'e8', to: ply.to };       // king move drives castling
    } else {
      mv = { from: ply.from, to: ply.to };
      const pm = /=([QRBN])/i.exec(ply.san || '');
      if (pm) mv.promotion = pm[1].toLowerCase();
      else if (ply.promo) mv.promotion = 'q';
    }
    try { chess.move(mv); } catch (e) { desync = true; break; }
  }
  if (!desync && board88) desync = !boardsMatch(chess, board88);
  if (desync) return fallbackFromBoard(history, board88);

  const verbose = chess.moves({ verbose: true });
  return {
    ok: true,
    fen: chess.fen(),
    pgn: chess.pgn(),
    side: chess.turn(),                 // 'w' | 'b'
    moveNumber: chess.moveNumber(),
    legal: chess.moves(),               // SAN list
    inCheck: chess.inCheck(),
    isOver: chess.isGameOver(),
    sanToMove: sanLookup(verbose),
  };
}

function sanLookup(verbose) {
  return (san) => {
    const clean = String(san).replace(/[+#]$/, '');
    const m = verbose.find(v => v.san === san || v.san.replace(/[+#]$/, '') === clean);
    return m ? { from: m.from, to: m.to, promotion: m.promotion || undefined } : null;
  };
}

function boardsMatch(chess, b) {
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const byte = b[rank * 16 + file], t = byte & 7, c = (byte >> 3) & 1;
      const cp = chess.get(sqName(rank, file));
      if (t === 0) { if (cp) return false; continue; }
      if (!cp || cp.type !== T2C[t] || (cp.color === 'w' ? 0 : 1) !== c) return false;
    }
  }
  return true;
}

// Authoritative placement from the emulator board; castling/ep unknown ('-').
function fallbackFromBoard(history, b) {
  const rows = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '', empty = 0;
    for (let file = 0; file < 8; file++) {
      const byte = b ? b[rank * 16 + file] : 0, t = byte & 7, c = (byte >> 3) & 1;
      if (t === 0) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const ch = T2C[t];
      row += c ? ch : ch.toUpperCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const side = (history || []).length % 2 === 0 ? 'w' : 'b';
  const num = Math.floor((history || []).length / 2) + 1;
  const fen = `${rows.join('/')} ${side} - - 0 ${num}`;
  let legal = [], sanToMove = () => null;
  try { const c = new Chess(fen); legal = c.moves(); sanToMove = sanLookup(c.moves({ verbose: true })); } catch (e) { /* illegal-ish */ }
  return { ok: false, degraded: true, fen, pgn: '', side, moveNumber: num, legal, sanToMove };
}
