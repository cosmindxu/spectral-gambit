// Verify tap-to-move: square mapping + cursor navigation produce a real
// move on the board, driving the actual emulator (no browser needed).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const factory = require('./web/spectral.js');
const M = await factory();
const c=(n,r,a)=>M.cwrap(n,r,a);
const init=c('sg_init','number',[]),run=c('sg_run_frame','void',[]),
  key=c('sg_key','number',['string','number']),board=c('sg_board','void',['number']),
  peek=c('sg_peek','number',['number']),text=c('sg_screen_text','number',[]);
const CURSOR=0xE086, FLIP=0xE095, B={x0:64,y0:40,sq:16};
const buf=M._malloc(128);
const frames=n=>{for(let i=0;i<n;i++)run();};
const rd=()=>{board(buf);return Uint8Array.from(M.HEAPU8.subarray(buf,buf+128));};
const alg=s=>String.fromCharCode(97+(s&7))+(((s>>4)&7)+1);

// pulse one key (HOLD/GAP) — same timing as the front-end
const press=n=>{key(n,1);frames(7);key(n,0);frames(8);};

function clickToSquare(fx,fy){
  const col=Math.floor((fx-B.x0)/B.sq), row=Math.floor((fy-B.y0)/B.sq);
  if(col<0||col>7||row<0||row>7)return null;
  const flip=peek(FLIP)&1, file=flip?7-col:col, rank=flip?row:7-row;
  return rank*16+file;
}
function navTo(sq){           // drive cursor (live peek) then ENTER
  let cur=peek(CURSOR), cf=cur&7, cr=(cur>>4)&7, tf=sq&7, tr=(sq>>4)&7;
  while(cf<tf){press('P');cf++;} while(cf>tf){press('O');cf--;}
  while(cr<tr){press('Q');cr++;} while(cr>tr){press('A');cr--;}
  press('ENTER');
}

init(); frames(900);
let pass=true, log=[];
function ok(name,cond){log.push((cond?'PASS ':'FAIL ')+name);if(!cond)pass=false;}

// 1) geometry: centres of known squares map correctly
ok('e2 centre (136,144) -> e2', alg(clickToSquare(136,144))==='e2');
ok('a8 centre (72,48) -> a8',   alg(clickToSquare(72,48))==='a8');
ok('h1 centre (184,160) -> h1', alg(clickToSquare(184,160))==='h1');
ok('off-board (10,10) -> null', clickToSquare(10,10)===null);

// 2) cursor starts on e2
ok('cursor starts e2', alg(peek(CURSOR))==='e2');

// 3) tap d2 then d4 => white pawn d2->d4
navTo(0x13);                   // tap d2 (pick up the d-pawn)
navTo(0x33);                   // tap d4 (drop)
frames(2500);                  // engine replies
const b=rd();
ok('d2 now empty', (b[0x13]&7)===0);
ok('d4 has white pawn', (b[0x33]&7)===1 && ((b[0x33]>>3)&1)===0);

console.log(log.join('\n'));
console.log('\nscreen:'); console.log(M.UTF8ToString(text()).split('\n').slice(2,12).join('\n'));
console.log('\n=>', pass?'TAP-TO-MOVE OK':'TAP-TO-MOVE FAIL');
process.exit(pass?0:1);
