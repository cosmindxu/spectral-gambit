// Simulate a page refresh: play a move, save .szx, then a FRESH module
// instance boots and loads it back. Asserts the position is restored.
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const factory = require('./web/spectral.js');

function mk(M){const c=(n,r,a)=>M.cwrap(n,r,a);return{
  init:c('sg_init','number',[]),run:c('sg_run_frame','void',[]),
  key:c('sg_key','number',['string','number']),text:c('sg_screen_text','number',[]),
  board:c('sg_board','void',['number']),save:c('sg_save_state','number',['string']),
  load:c('sg_load_state','number',['string']),fc:c('sg_frame_counter','number',[]),M};}
const startBoard=()=>{const b=new Uint8Array(128);const bk=[4,2,3,5,6,3,2,4];
  for(let f=0;f<8;f++){b[f]=bk[f];b[16+f]=1;b[96+f]=9;b[112+f]=bk[f]|8;}return b;};
const same=(a,b)=>{for(let i=0;i<128;i++)if(a[i]!==b[i])return false;return true;};

// ---- session 1: boot, play e4, save ----
const A=mk(await factory());
const bufA=A.M._malloc(128);
const readA=()=>{A.board(bufA);return Uint8Array.from(A.M.HEAPU8.subarray(bufA,bufA+128));};
const frA=n=>{for(let i=0;i<n;i++)A.run();};
const pressA=n=>{A.key(n,1);frA(7);A.key(n,0);frA(8);};
A.init(); frA(900);
['ENTER','Q','Q','ENTER'].forEach(pressA); frA(2500);
const boardAfterMove=readA();
console.log('session1 frame_counter at save:', A.fc());
console.log('session1 board == start position?', same(boardAfterMove, startBoard()));
if(A.save('/s.szx')!==0){console.log('SAVE FAILED');process.exit(1);}
const szx=A.M.FS.readFile('/s.szx');
writeFileSync('/tmp/refresh.szx', Buffer.from(szx));
console.log('saved szx bytes:', szx.length);

// ---- session 2: FRESH module (= page refresh), boot, then load ----
const B=mk(await factory());
const bufB=B.M._malloc(128);
const readB=()=>{B.board(bufB);return Uint8Array.from(B.M.HEAPU8.subarray(bufB,bufB+128));};
const frB=n=>{for(let i=0;i<n;i++)B.run();};
B.init(); frB(900);
console.log('\nsession2 fresh boot board == start?', same(readB(), startBoard()));
console.log('session2 fresh frame_counter:', B.fc());

// write the saved bytes into MEMFS and load (what writeSzx does)
B.M.FS.writeFile('/s.szx', readFileSync('/tmp/refresh.szx'));
if(B.load('/s.szx')!==0){console.log('LOAD FAILED');process.exit(1);}
const restored=readB();
console.log('session2 AFTER load frame_counter:', B.fc());
console.log('session2 restored board == saved board?', same(restored, boardAfterMove));
console.log('session2 restored board == start position?', same(restored, startBoard()));

// does running more frames after load corrupt it (e.g. autoload keys refire)?
frB(400);
const after=readB();
console.log('session2 board stable 400f after load?', same(after, boardAfterMove));
console.log('session2 screen after load+run:');
console.log(B.M.UTF8ToString(B.text()).split('\n').slice(0,6).join('\n'));

const ok = same(restored, boardAfterMove) && !same(restored, startBoard());
console.log('\n=>', ok ? 'CORE SAVE/RESTORE WORKS' : 'CORE BROKEN');
process.exit(ok?0:1);
