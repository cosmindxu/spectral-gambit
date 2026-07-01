#!/usr/bin/env python3
"""Render a faithful preview of the Spectrum Gambit page (chrome + panel
+ the real emulator screenshot composited in), matching style.css."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1000
BG=(10,10,20); PANEL=(19,19,31); INK=(232,232,240); DIM=(138,138,160)
LINE=(38,38,54); ACC=(255,208,0); CARD=(14,14,24)
ZX=[(216,0,0),(255,208,0),(0,192,0),(0,192,192)]
F=lambda s,b=False: ImageFont.truetype(
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf"%("-Bold" if b else ""), s)

img=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(img)

def rr(xy,r,fill=None,outline=None,wd=1):
    d.rounded_rectangle(xy,radius=r,fill=fill,outline=outline,width=wd)
def text(x,y,s,f,fill=INK,anchor="la"):
    d.text((x,y),s,font=f,fill=fill,anchor=anchor)

# rainbow stripe
for i,c in enumerate(ZX):
    d.rectangle([i*W//4,0,(i+1)*W//4,6],fill=c)

# title (approx gradient by per-letter colour ramp)
title="SPECTRUM  GAMBIT"; fT=F(46,True)
tw=d.textlength(title,font=fT); x=(W-tw)/2;
ramp=[(216,0,0),(255,160,0),(255,208,0),(120,200,0),(0,192,120),(0,192,192)]
for i,ch in enumerate(title):
    col=ramp[int(i/len(title)*(len(ramp)-1))]
    text(x,26,ch,fT,fill=col); x+=d.textlength(ch,font=fT)
text(W/2,90,"chess from inside the machine · 48K · Z80 · woven by Fable",F(15),fill=DIM,anchor="ma")

# resume banner
rr([(W-560)/2,120,(W+560)/2,158],10,fill=(26,26,10),outline=ACC)
text(W/2,139,"You have a game in progress (today 16:40)   [ Resume ]  [ Start fresh ]",
     F(14),fill=INK,anchor="mm")

# ---- stage (left) ----
SX,SY=24,180; SW=636
rr([SX,SY,SX+SW,SY+470],12,fill=(0,0,0),outline=LINE)
# composite the real screenshot
try:
    shot=Image.open("web/assets/boot.png").convert("RGB")
    sw=SW-28; sh=int(sw*shot.height/shot.width)
    shot=shot.resize((sw,sh),Image.NEAREST)
    img.paste(shot,(SX+14,SY+14))
    cy=SY+14+sh
except Exception as e:
    cy=SY+360
# dpad
dx,dy=SX+SW/2-66, cy+30
def key(cx,cy_,lab,col=INK):
    rr([cx,cy_,cx+44,cy_+44],9,fill=(28,28,44),outline=LINE)
    text(cx+22,cy_+22,lab,F(16,True),fill=col,anchor="mm")
key(dx+50,dy,"▲"); key(dx,dy+50,"◀"); key(dx+50,dy+50,"●",ACC); key(dx+100,dy+50,"▶"); key(dx+50,dy+100,"▼")
text(SX+SW/2,dy+165,"Arrow keys move the cursor · Enter picks up / drops a piece",
     F(12),fill=DIM,anchor="ma")

# ---- panel (right) ----
PX=SX+SW+20; PW=W-PX-24
rr([PX,SY,PX+PW,SY+700],14,fill=PANEL,outline=LINE)
ix=PX+18; iw=PW-36; y=SY+18
# status row
rr([ix,y,ix+150,y+30],15,fill=(12,42,12)); text(ix+75,y+15,"Your move",F(14,True),fill=(125,255,125),anchor="mm")
text(PX+PW-18,y+15,"2 moves",F(12),fill=DIM,anchor="ra"); y+=46
# readout
cw=(iw-16)/3
for i,(lab,val) in enumerate([("LEVEL","2"),("EVAL","+0.00"),("MATERIAL","0")]):
    cx=ix+i*(cw+8); rr([cx,y,cx+cw,y+54],9,fill=CARD,outline=LINE)
    text(cx+cw/2,y+14,lab,F(10),fill=DIM,anchor="ma")
    text(cx+cw/2,y+30,val,F(17,True),anchor="ma")
y+=70
# strength
text(ix,y+8,"Strength",F(13),fill=DIM)
for i in range(5):
    bx=ix+iw-34*(5-i)-6*(5-i)
    rr([bx,y,bx+34,y+34],8,fill=(28,28,44) if i!=1 else ACC,outline=LINE)
    text(bx+17,y+17,str(i+1),F(14,True),fill=(0,0,0) if i==1 else INK,anchor="mm")
y+=50
# actions
for i,lab in enumerate(["New game","Take back","Flip","Colour"]):
    bw=(iw-24)/4; bx=ix+i*(bw+8)
    rr([bx,y,bx+bw,y+38],9,fill=(28,28,44),outline=LINE)
    text(bx+bw/2,y+19,lab,F(11),anchor="mm")
y+=58
# move log
text(ix,y,"MOVE LOG",F(12),fill=DIM); y+=22
rr([ix,y,ix+iw,y+150],9,fill=CARD,outline=LINE)
log=[("1.","e4","e5"),("2.","Bc4","Nf6")]
ly=y+10
for n,wm,bm in log:
    text(ix+12,ly,n,F(14),fill=DIM); text(ix+56,ly,wm,F(14)); text(ix+150,ly,bm,F(14)); ly+=22
y+=164
rr([ix,y,ix+iw,y+34],9,fill=PANEL,outline=LINE); text(ix+iw/2,y+17,"Copy PGN",F(12),anchor="mm"); y+=50
# saved games
text(ix,y,"SAVED GAMES",F(12),fill=DIM); y+=20
text(ix,y,"Auto-saves after every move — close the tab, come back whenever.",F(11),fill=DIM); y+=24
for name in ["italian-vs-l2","blitz-test"]:
    rr([ix,y,ix+iw,y+34],8,fill=CARD,outline=LINE)
    text(ix+12,y+17,name,F(13),anchor="lm")
    rr([ix+iw-120,y+5,ix+iw-58,y+29],6,fill=(28,28,44),outline=LINE); text(ix+iw-89,y+17,"load",F(11),anchor="mm")
    rr([ix+iw-50,y+5,ix+iw-8,y+29],6,fill=(28,28,44),outline=LINE); text(ix+iw-29,y+17,"✕",F(11),fill=(255,128,128),anchor="mm")
    y+=42
rr([ix,y,ix+iw-90,y+38],8,fill=CARD,outline=LINE); text(ix+12,y+19,"name this game",F(12),fill=DIM,anchor="lm")
rr([ix+iw-82,y,ix+iw,y+38],8,fill=ACC); text(ix+iw-41,y+19,"Save",F(12,True),fill=(0,0,0),anchor="mm")

# footer
text(W/2,SY+700+30,"The opponent is a real alpha-beta engine hand-written in Z80 assembly by Fable,",
     F(12),fill=DIM,anchor="ma")
text(W/2,SY+700+48,"running on an emulated ICE Felix HC-91 compiled to WebAssembly.",
     F(12),fill=DIM,anchor="ma")

img.save("web/assets/mockup.png")
print("wrote web/assets/mockup.png")
