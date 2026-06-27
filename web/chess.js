// chess.js — derive a human move log by diffing successive 0x88 boards
// read out of the running emulator (sg_board). No chess rules engine
// here: the Z80 program is the rules. We only *describe* what changed.

export const PIECE = { 1:'P', 2:'N', 3:'B', 4:'R', 5:'Q', 6:'K' };

export function sq2alg(sq) {
  const file = sq & 7, rank = (sq >> 4) & 7;
  return String.fromCharCode(97 + file) + (rank + 1);
}
function typeOf(b)  { return b & 7; }
function colorOf(b) { return (b >> 3) & 1; } // 0 = white, 1 = black
function isEmpty(b) { return (b & 7) === 0; }

// Compare two 128-byte boards; return a move descriptor or null.
// Handles normal moves, captures, castling (O-O / O-O-O), en passant,
// and promotion (piece type on the destination differs from a pawn).
export function diffMove(prev, cur) {
  const changed = [];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    if (prev[sq] !== cur[sq]) changed.push(sq);
  }
  if (changed.length === 0) return null;

  // Castling: four squares change (king + rook).
  if (changed.length === 4) {
    // find the king's destination
    let kingTo = changed.find(sq => typeOf(cur[sq]) === 6 && !isEmpty(cur[sq]));
    if (kingTo !== undefined) {
      const file = kingTo & 7;
      const side = colorOf(cur[kingTo]);
      return { side, san: file === 6 ? 'O-O' : 'O-O-O',
               from: null, to: sq2alg(kingTo), capture: false, castle: true };
    }
  }

  // Vacated square(s): were occupied, now empty.
  const vacated = changed.filter(sq => !isEmpty(prev[sq]) && isEmpty(cur[sq]));
  // Arrival square: newly holds a piece that wasn't there (or changed owner).
  const arrived = changed.filter(sq => !isEmpty(cur[sq]) &&
                    (isEmpty(prev[sq]) || colorOf(prev[sq]) !== colorOf(cur[sq])
                     || typeOf(prev[sq]) !== typeOf(cur[sq])));

  if (arrived.length !== 1) return null;          // unexpected; skip
  const to = arrived[0];
  const moved = cur[to];
  const side = colorOf(moved);
  // 'from' is the vacated square of the SAME colour that moved.
  const from = vacated.find(sq => colorOf(prev[sq]) === side);
  if (from === undefined) return null;

  const wasPawn = typeOf(prev[from]) === 1;
  const promo = wasPawn && typeOf(moved) !== 1;
  // capture: destination had an enemy piece, OR en passant (an extra
  // enemy pawn vacated besides our origin).
  const enemyVacated = vacated.some(sq => colorOf(prev[sq]) !== side);
  const capture = (!isEmpty(prev[to]) && colorOf(prev[to]) !== side) || enemyVacated;

  let san;
  const pt = PIECE[typeOf(prev[from])];
  const fromAlg = sq2alg(from), toAlg = sq2alg(to);
  if (pt === 'P') {
    san = (capture ? fromAlg[0] + 'x' : '') + toAlg + (promo ? '=' + PIECE[typeOf(moved)] : '');
  } else {
    san = pt + (capture ? 'x' : '') + toAlg;
  }
  return { side, san, from: fromAlg, to: toAlg, capture, promo, castle: false };
}

// Build a pretty PGN-ish movetext from a list of half-move SANs.
export function toMovetext(history) {
  let out = '', n = 1;
  for (let i = 0; i < history.length; i++) {
    if (i % 2 === 0) out += (n++) + '. ';
    out += history[i].san + ' ';
  }
  return out.trim();
}
