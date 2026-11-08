import sys,glob
from PIL import Image,ImageDraw
d=sys.argv[1]; fs=sorted(glob.glob(d+'/s_*.jpg')); n=len(fs); cols=4; rows=(n+cols-1)//cols
c=Image.new('RGB',(cols*360,rows*640))
for i,f in enumerate(fs):
  im=Image.open(f).resize((360,640)); dr=ImageDraw.Draw(im); dr.rectangle((0,618,140,640),fill=(0,0,0)); dr.text((6,622),f.split('/')[-1],fill=(255,255,0)); c.paste(im,((i%cols)*360,(i//cols)*640))
c.save(d+'/sheet.jpg',quality=86)
