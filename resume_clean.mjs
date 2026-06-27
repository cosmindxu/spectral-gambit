// Verify auto-resume: load a saved game right after init (frame 0, with
// autoload keys still scheduled), then run past frame 250 and confirm the
// position is NOT corrupted (sg_load_state must clear scheduled keys).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const factory = require('./web/spectral.js');
const same=(a,b)=>{for(let i=0;i<128;i++)if(a[i]!==b[i])return false;return true;};

function mk(M){const c=(n,r,a)=>M.cwrap(n,r,a);return{
  init:c('sg_init','number',[]),run:c('sg_run_frame','void',[]),key:c('sg_key','number',['string','number']),
  text:c('sg_screen_text','number',[]),board:c('sg_board','void',['number']),
  save:c('sg_save_state','number',['string']),load:c('sg_load_state','number',['string']),fc:c('sg_frame_counter','number',[]),M};}

// build a saved game (e4 + reply) in session A
const A=mk(await factory());const ba=A.M._malloc(128);
const ra=()=>{A.board(ba);return Uint8Array.from(A.M.HEAPU8.subarray(ba,ba+128));};
const fa=n=>{for(let i=0;i<n;i++)A.run();};const pa=n=>{A.key(n,1);fa(7);A.key(n,0);fa(8);};
A.init();fa(900);['ENTER','Q','Q','ENTER'].forEach(pa);fa(2500);
const saved=ra();A.save('/s.szx');const bytes=A.M.FS.readFile('/s.szx');

// session B = page load: init (schedules autoload @250), then immediately load
const B=mk(await factory());const bb=B.M._malloc(128);
const rb=()=>{B.board(bb);return Uint8Array.from(B.M.HEAPU8.subarray(bb,bb+128));};
const fb=n=>{for(let i=0;i<n;i++)B.run();};
B.init();
B.M.FS.writeFile('/s.szx', Buffer.from(bytes));
B.load('/s.szx');                       // <-- at frame 0, autoload still pending pre-fix
console.log('after load frame:', B.fc(), 'restored==saved?', same(rb(), saved));
fb(600);                                // run PAST frame 250 (where autoload would fire)
const after=rb();
console.log('after +600 frames (past autoload point):');
console.log('  board still == saved?', same(after, saved));
console.log('  screen top:'); console.log(B.M.UTF8ToString(B.text()).split('\n').slice(0,5).join('\n'));
const ok=same(after,saved);
console.log('\n=>', ok?'PASS: auto-resume is clean (no autoload corruption)':'FAIL: position corrupted');
process.exit(ok?0:1);
