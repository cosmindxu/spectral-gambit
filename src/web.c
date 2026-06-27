/* web.c — Spectral Gambit: Emscripten entry point.
 *
 * Wraps the hc91emu core (z80 + machine + video + snapshot) for the
 * browser. The real Z80 runs the real chess.tap; JS drives frames,
 * reads the 320x240 RGBA framebuffer, injects live keys, and saves /
 * restores full machine state as .szx (the "put it down, come back
 * hours later" feature).
 *
 * 48.rom and chess.tap are embedded into MEMFS at build time
 * (--embed-file), so a fresh boot needs no network.
 */
#include <string.h>
#include <emscripten.h>
#include "machine.h"

static Machine M;
static uint32_t FB[HC91_FB_W * HC91_FB_H];
static uint8_t  LIVE[8];              /* live key matrix, OR'd each frame */
static char     TXT[24 * 33];         /* screen text snapshot */

/* Boot: init the machine, attach the tape, schedule LOAD"" autoload.
 * Mirrors main.c: type j""<enter> at frame 250, press PLAY at 320.
 * Returns 0 on success, -1 on failure. */
EMSCRIPTEN_KEEPALIVE
int sg_init(void)
{
    memset(LIVE, 0, sizeof LIVE);
    if (machine_init(&M, "/48.rom") != 0)
        return -1;
    if (machine_load_file(&M, "/chess.tap") != 0)
        return -1;
    M.play_at_frame = 320;
    keys_type(&M, "j\"\"\n", 250);
    return 0;
}

/* Run exactly one 50Hz frame: apply scheduled (boot) keys, OR in the
 * live key matrix, beam-paint so the framebuffer is observable. */
EMSCRIPTEN_KEEPALIVE
void sg_run_frame(void)
{
    int i;
    keys_apply(&M, (int)M.frame_counter);
    for (i = 0; i < 8; i++)
        M.keyrows[i] |= LIVE[i];
    M.fb_live = 1;
    machine_run_frame(&M);
}

/* Render the current frame to RGBA and hand back its address. */
EMSCRIPTEN_KEEPALIVE
uint32_t *sg_framebuffer(void)
{
    video_render(&M, FB);
    return FB;
}

EMSCRIPTEN_KEEPALIVE int sg_fb_w(void) { return HC91_FB_W; }
EMSCRIPTEN_KEEPALIVE int sg_fb_h(void) { return HC91_FB_H; }
EMSCRIPTEN_KEEPALIVE int sg_frame_counter(void) { return (int)M.frame_counter; }

/* Live key press/release by name (A-Z, 0-9, ENTER, SPACE, CAPS, SYM). */
EMSCRIPTEN_KEEPALIVE
int sg_key(const char *name, int down)
{
    int row, bit;
    if (keys_name_pos(name, (int)strlen(name), &row, &bit) != 0)
        return -1;
    if (down) LIVE[row] |= (1u << bit);
    else      LIVE[row] &= ~(1u << bit);
    return 0;
}

/* Clear every held key (e.g. on focus loss). */
EMSCRIPTEN_KEEPALIVE
void sg_keys_clear(void) { memset(LIVE, 0, sizeof LIVE); }

/* The 24x32 character screen as text, for move-log / status parsing.
 * Returns a pointer to a NUL-terminated 24*33 buffer (row-major, each
 * row 32 chars + '\n', last byte NUL). */
EMSCRIPTEN_KEEPALIVE
const char *sg_screen_text(void)
{
    char rows[24][33];
    int r;
    video_screen_text(&M, rows);
    char *o = TXT;
    for (r = 0; r < 24; r++) {
        memcpy(o, rows[r], 32);
        o += 32;
        *o++ = (r < 23) ? '\n' : '\0';
    }
    return TXT;
}

/* Save / load full machine state to a MEMFS path (.szx). JS reads /
 * writes the file bytes via Module.FS. Returns 0 on success. */
EMSCRIPTEN_KEEPALIVE
int sg_save_state(const char *path) { return snapshot_save_szx(&M, path); }

EMSCRIPTEN_KEEPALIVE
int sg_load_state(const char *path)
{
    int r = snapshot_load_szx(&M, path);
    if (r == 0) {
        /* a restored game must not inherit the fresh-boot autoload
         * keystrokes (j"" ENTER) still scheduled from sg_init, nor any
         * held keys — clear all pending input so the position is exact. */
        M.nkey_events = 0;
        M.njoy_events = 0;
        M.play_at_frame = -1;
        memset(LIVE, 0, sizeof LIVE);
    }
    return r;
}

/* Copy the 0x88 chess board (128 bytes at 0xE000) into `out` so JS can
 * diff successive positions into a real move log. square = rank*16+file
 * (a1=0x00); byte = type(bits0-2: 1=P..6=K) | colour(bit3) | 0=empty. */
EMSCRIPTEN_KEEPALIVE
void sg_board(uint8_t *out)
{
    int i;
    for (i = 0; i < 128; i++)
        out[i] = machine_peek(&M, (uint16_t)(0xE000 + i));
}

/* Read one byte of machine memory (no side effects) — used by the
 * front-end to find the UI cursor square (0xE086) and flip flag
 * (0xE095) for tap-to-move. */
EMSCRIPTEN_KEEPALIVE
int sg_peek(int addr) { return machine_peek(&M, (uint16_t)addr); }

/* Cold reboot back into a fresh game (re-attaches tape + autoload). */
EMSCRIPTEN_KEEPALIVE
int sg_reset(void) { return sg_init(); }
