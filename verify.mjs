// Headless verification of the WASM core under node.
// Boots chess.tap, renders a PNG, reads the screen text, plays e2-e4,
// and confirms the engine replies. Mirrors the native `make test`.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const factory = require('./web/spectral.js');

// --- minimal PNG encoder (RGBA, no filtering) ---
function crc32(buf) {
  let c, table = crc32.t || (crc32.t = (() => {
    const t = []; for (let n = 0; n < 256; n++) { c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0; } return t; })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crc32.t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(path, rgba, w, h) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; // 8-bit, RGBA
  const raw = Buffer.alloc((w*4+1)*h);
  for (let y=0;y<h;y++){ raw[y*(w*4+1)]=0; rgba.copy(raw, y*(w*4+1)+1, y*w*4, (y+1)*w*4); }
  writeFileSync(path, Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',deflateSync(raw)), chunk('IEND',Buffer.alloc(0))]));
}

const M = await factory();
const sg_init = M.cwrap('sg_init','number',[]);
const sg_run = M.cwrap('sg_run_frame','void',[]);
const sg_fb = M.cwrap('sg_framebuffer','number',[]);
const sg_w = M.cwrap('sg_fb_w','number',[]);
const sg_h = M.cwrap('sg_fb_h','number',[]);
const sg_key = M.cwrap('sg_key','number',['string','number']);
const sg_text = M.cwrap('sg_screen_text','number',[]);
const sg_save = M.cwrap('sg_save_state','number',['string']);
const sg_fc = M.cwrap('sg_frame_counter','number',[]);

function frames(n){ for(let i=0;i<n;i++) sg_run(); }
function screen(){ return M.UTF8ToString(sg_text()); }
function snap(path){ const w=sg_w(),h=sg_h(); const p=sg_fb(); const rgba=Buffer.from(M.HEAPU8.buffer, p, w*h*4); writePNG(path, Buffer.from(rgba), w,h); }
function press(name){ sg_key(name,1); frames(7); sg_key(name,0); frames(8); }

if (sg_init()!==0){ console.error('sg_init FAILED'); process.exit(1); }
frames(900);                          // boot + autoload + LOAD ""
console.log('after boot, frame', sg_fc());
snap('/home/dcosmin/spectral-gambit/web/assets/boot.png');
const boot = screen();
console.log('--- screen after boot ---');
console.log(boot);

// e2-e4: cursor home is e2 -> ENTER(pick up), Q,Q (up two ranks), ENTER(drop)
press('ENTER'); press('Q'); press('Q'); press('ENTER');
frames(2500);                          // let the engine think + reply
const after = screen();
console.log('--- screen after 1.e4 + engine reply ---');
console.log(after);
snap('/home/dcosmin/spectral-gambit/web/assets/move1.png');

const ok = /your move/i.test(after);
console.log(ok ? 'PASS: engine replied, status back to "Your move"' : 'FAIL: no "Your move" after 1.e4');

// state save round-trip
if (sg_save('/state.szx')===0){ const b=M.FS.readFile('/state.szx'); console.log('save_state OK, szx bytes =', b.length); }
else console.log('save_state FAILED');
process.exit(ok?0:1);
