#!/usr/bin/env python3
"""Preview of the Spectrum Gambit compete section (ladder + leaderboard,
play-a-friend correspondence)."""
from PIL import Image, ImageDraw, ImageFont
W,H=1080,560
BG=(10,10,20);PANEL=(19,19,31);INK=(232,232,240);DIM=(138,138,160);LINE=(38,38,54)
ACC=(255,208,0);CARD=(14,14,24)
F=lambda s,b=False: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf"%("-Bold" if b else ""),s)
img=Image.new("RGB",(W,H),BG);d=ImageDraw.Draw(img)
def rr(xy,r,fill=None,outline=None,wd=1): d.rounded_rectangle(xy,radius=r,fill=fill,outline=outline,width=wd)
def t(x,y,s,f,fill=INK,anchor="la"): d.text((x,y),s,font=f,fill=fill,anchor=anchor)

# two cards
cards=[(24,20,520),(560,20,520)]
# --- ladder card ---
cx,cy,cw=24,20,512
rr([cx,cy,cx+cw,cy+520],14,fill=PANEL,outline=LINE)
ix=cx+18;iw=cw-36;y=cy+18
t(ix,y,"⚔ Engine ladder",F(19,True));y+=30
t(ix,y,"Beat the AI at rising strengths. Win, log it — ranked by",F(12),fill=DIM);y+=16
t(ix,y,"the highest level you've cleared.",F(12),fill=DIM);y+=24
rr([ix,y,ix+iw,y+38],8,fill=CARD,outline=LINE);t(ix+12,y+19,"Cosmin",F(13),anchor="lm");y+=52
# report box
rr([ix,y,ix+iw,y+78],10,fill=CARD,outline=ACC)
t(ix+12,y+14,"Game over: checkmate — White wins",F(12),fill=DIM)
bw=(iw-40)/3
for i,(lab,sg) in enumerate([("I won",True),("I lost",False),("Draw",False)]):
    bx=ix+12+i*(bw+8)
    rr([bx,y+38,bx+bw,y+68],7,fill=ACC if sg else (28,28,44),outline=LINE)
    t(bx+bw/2,y+53,lab,F(12,True if sg else False),fill=(0,0,0) if sg else INK,anchor="mm")
y+=94
t(ix,y,"Leaderboard",F(13,True));y+=24
# header
for lab,xx in [("#",ix),("Player",ix+40),("Best",ix+iw-150),("Wins",ix+iw-70)]:
    t(xx,y,lab,F(11),fill=DIM)
y+=18;d.line([ix,y,ix+iw,y],fill=LINE);y+=6
rows=[("1","Cosmin","Lv 4","2W",True),("2","Ada","Lv 2","1W",False),("3","Guest","Lv 1","1W",False)]
for n,nm,bst,w,me in rows:
    col=ACC if me else INK
    t(ix,y,n,F(13),fill=DIM);t(ix+40,y,nm,F(13),fill=col)
    t(ix+iw-150,y,bst,F(13),fill=col);t(ix+iw-70,y,w,F(13),fill=col);y+=24

# --- play a friend card ---
cx,cy,cw=560,20,496
rr([cx,cy,cx+cw,cy+520],14,fill=PANEL,outline=LINE)
ix=cx+18;iw=cw-36;y=cy+18
t(ix,y,"👥 Play a friend",F(19,True));y+=30
for ln in ["Correspondence chess: each side plays one move, then","sends the board on. Put it down, come back whenever —","just like a save-state, but shared."]:
    t(ix,y,ln,F(12),fill=DIM);y+=16
y+=12
# active state
rr([ix,y,ix+iw,y+40],8,fill=CARD,outline=LINE)
t(ix+12,y+20,"You are ",F(13),anchor="lm")
t(ix+12+d.textlength("You are ",font=F(13)),y+20,"White",F(13,True),fill=ACC,anchor="lm")
t(ix+12+d.textlength("You are White ",font=F(13)),y+20," · your move — play it, then Submit",F(12),fill=DIM,anchor="lm")
y+=52
# share row
rr([ix,y,ix+iw-110,y+38],8,fill=CARD,outline=LINE)
t(ix+12,y+19,"spectrumgambit.com/?g=qvp5zu5m5x",F(12),fill=DIM,anchor="lm")
rr([ix+iw-100,y,ix+iw,y+38],8,fill=(28,28,44),outline=LINE);t(ix+iw-50,y+19,"Copy link",F(11),anchor="mm")
y+=52
for i,(lab,pri) in enumerate([("Submit move",True),("Refresh",False),("Leave",False)]):
    bw=(iw-16)/3;bx=ix+i*(bw+8)
    rr([bx,y,bx+bw,y+40],8,fill=ACC if pri else (28,28,44),outline=None if pri else LINE)
    t(bx+bw/2,y+20,lab,F(12,True if pri else False),fill=(0,0,0) if pri else INK,anchor="mm")
y+=60
t(ix,y,"How it works",F(13,True));y+=22
for n,ln in [("1.","Create a game → share the link with a friend."),
             ("2.","They open it, join as Black."),
             ("3.","Play your move on the board, hit Submit."),
             ("4.","They get your move, reply, send it back."),
             ("5.","Hours or days between moves — the .szx holds it all.")]:
    t(ix,y,n,F(12),fill=ACC);t(ix+28,y,ln,F(12),fill=DIM);y+=20

img.save("web/assets/mockup_compete.png");print("wrote web/assets/mockup_compete.png")
