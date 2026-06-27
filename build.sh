#!/usr/bin/env bash
# Build the Spectral Gambit WASM core from the hc91emu sources.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
EMU="$ROOT/../hc91emu"
SRC="$EMU/src"
OUT="$ROOT/web"
mkdir -p "$OUT" "$ROOT/build_assets"

# Embed the ROM and the assembled chess tape into MEMFS.
cp "$EMU/roms/48.rom"        "$ROOT/build_assets/48.rom"
cp "$EMU/chess/chess.tap"    "$ROOT/build_assets/chess.tap"

# Core sources (everything except main.c, sdl.c, zexrun.c).
CORE="z80 machine video tape snapshot keys png wav disasm debug inflate ay fdc rzx"
SRCS="$ROOT/src/web.c"
for f in $CORE; do SRCS="$SRCS $SRC/$f.c"; done

EXPORTS='["_sg_init","_sg_run_frame","_sg_framebuffer","_sg_fb_w","_sg_fb_h","_sg_frame_counter","_sg_key","_sg_keys_clear","_sg_screen_text","_sg_save_state","_sg_load_state","_sg_board","_sg_peek","_sg_reset","_malloc","_free"]'
RT='["ccall","cwrap","FS","UTF8ToString","stringToUTF8","lengthBytesUTF8","HEAPU8","HEAPU32"]'

emcc -O2 -std=c99 -I"$SRC" $SRCS \
  -s MODULARIZE=1 -s EXPORT_NAME=SpectralGambit \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web,node \
  -s EXPORTED_FUNCTIONS="$EXPORTS" \
  -s EXPORTED_RUNTIME_METHODS="$RT" \
  --embed-file "$ROOT/build_assets/48.rom"@/48.rom \
  --embed-file "$ROOT/build_assets/chess.tap"@/chess.tap \
  -o "$OUT/spectral.js"

echo "built $OUT/spectral.js + spectral.wasm"
