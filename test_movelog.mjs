// Validate chess.js move-log derivation against REAL emulator boards.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const factory = require('./web/spectral.js');
const { diffMove, toMovetext } = await import(pathToFileURL('/tmp/_c.mjs'));

const M = await factory();
const c = (n,r,a)=>M.cwrap(n,r,a);
const init=c('sg_init','number',[]), run=c('sg_run_frame','void',[]),
  key=c('sg_key','number',['string','number']), text=c('sg_screen_text','number',[]),
  board=c('sg_board','void',['number']);
const buf=M._malloc(128);
const frames=n=>{for(let i=0;i<n;i++)run();};
const press=n=>{key(n,1);frames(7);key(n,0);frames(8);};
const readBoard=()=>{board(buf);return Uint8Array.from(M.HEAPU8.subarray(buf,buf+128));};
const screen=()=>M.UTF8ToString(text());

init(); frames(900);
let prev=readBoard();
const log=[];
function settle(){ // run until engine done thinking, capture resulting ply
  let last=readBoard();
  for(let i=0;i<60;i++){ frames(50); const b=readBoard();
    if(JSON.stringify([...b])!==JSON.stringify([...last])){last=b;}
    if(/your move/i.test(screen())) break; }
  return last;
}
function playerMove(keys){
  for(const k of keys) press(k);
  const after=readBoard();
  const mv=diffMove(prev,after); if(mv){log.push(mv);} prev=after;
  const eng=settle();
  const emv=diffMove(prev,eng); if(emv){log.push(emv);} prev=eng;
}

// 1.e4 (ENTER Q Q ENTER from cursor home e2)
playerMove(['ENTER','Q','Q','ENTER']);
// 2.Bc4 (Italian): from f1 bishop to c4. cursor is on e4 now; navigate.
//   down to rank1 (A A A), right? f1 is file5. From e4(file4,rank3):
//   A A A -> e1; P -> f1; ENTER pick; Q Q Q -> f4; O O O -> c4; ENTER
playerMove(['A','A','A','P','ENTER','Q','Q','Q','O','O','O','ENTER']);

console.log('Derived move log:');
for(const m of log) console.log('  ', m.side===0?'W':'B', m.san, `(${m.from||''}-${m.to})`, m.capture?'x':'');
console.log('\nPGN:', toMovetext(log));

// assertions
const sans=log.map(m=>m.san);
const wantStart = sans[0]==='e4';
console.log('\n1st move is e4:', wantStart ? 'PASS':'FAIL ('+sans[0]+')');
console.log('engine replied (move 2 exists):', sans.length>=2?'PASS':'FAIL');
console.log('Bc4 present:', sans.includes('Bc4')?'PASS':'(got '+sans.join(' ')+')');
process.exit(0);
