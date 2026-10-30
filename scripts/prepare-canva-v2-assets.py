"""V2 exact-source assets. Pillow only resamples/sharpens the supplied JPG, no redrawing.
Run using bundled Python/Pillow; all crop and safe-zone decisions are recorded.
"""
from PIL import Image, ImageFilter, ImageDraw
from pathlib import Path
import json, hashlib, shutil
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT.parents[1]/'.codex-attachments/2fa1d47b-f8b1-4219-a504-2a87eef711c3'
REF=ROOT/'docs/design/canva-v2'; OUT=ROOT/'client/public/canva-v2'; RES=ROOT/'android/app/src/main/res'
REF.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
manifest=[]
for p in sorted(SRC.glob('*/*.jpg')):
 shutil.copy2(p,REF/p.name)
 manifest.append({'source':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions':Image.open(p).size})
crops={'doctor-preview-1':(545,224,682,405),'doctor-preview-2':(547,443,682,624),'doctor-preview-3':(550,672,685,847),'clinic-derma':(89,1000,293,1184),'clinic-grande':(438,987,655,1178)}
im=Image.open(REF/'1000073159.jpg').convert('RGB')
for name,box in crops.items():
 im.crop(box).save(OUT/(name+'.png'))
 manifest.append({'asset':'/canva-v2/'+name+'.png','source':'1000073159.jpg','crop':box,'use':'design preview only; no identity, clinical rating or fee claims'})
logo=Image.open(REF/'1000073150.jpg').convert('RGB')
# Use original green sampled from a quiet corner; modest sharpening after downsampling only.
bg=logo.getpixel((10,10)); color='#%02X%02X%02X'%bg
logo.save(OUT/'logo-source.png')
def scaled(size):
 return logo.resize((size,size),Image.Resampling.LANCZOS).filter(ImageFilter.UnsharpMask(radius=.45,percent=80,threshold=3))
for density,size,fgsize in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
 dest=RES/('mipmap-'+density);dest.mkdir(exist_ok=True)
 # Standard and round use a safe composition inset to preserve handwritten text.
 image=scaled(size);image.save(dest/'ic_launcher.png')
 roundim=Image.new('RGBA',(size,size),(*bg,255));inner=scaled(round(size*.80)).convert('RGBA');roundim.alpha_composite(inner,((size-inner.width)//2,(size-inner.height)//2));mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255);roundim.putalpha(mask);roundim.save(dest/'ic_launcher_round.png')
 # Entire source fits within adaptive icon safe circle (66dp of108dp).
 fg=Image.new('RGBA',(fgsize,fgsize),(0,0,0,0));art=scaled(round(fgsize*60/108)).convert('RGBA');fg.alpha_composite(art,((fgsize-art.width)//2,(fgsize-art.height)//2));fg.save(dest/'ic_launcher_foreground.png')
 for kind in ['ic_launcher.xml','ic_launcher_round.xml']:
  (RES/'mipmap-anydpi-v26'/kind).write_text('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/go_brand"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n',encoding='utf8')
# Android12 splash icon source inside safe mask; no invented monochrome alternate.
splash=Image.new('RGB',(288,288),bg);art=scaled(178);splash.paste(art,((288-178)//2,(288-178)//2));(RES/'drawable-nodpi').mkdir(exist_ok=True);splash.save(RES/'drawable-nodpi/go_logo_splash.png')
for dest in RES.glob('drawable*/splash.png'):
 old=Image.open(dest); canvas=Image.new('RGB',old.size,bg);n=min(old.size)//3;art=scaled(n);canvas.paste(art,((old.width-n)//2,(old.height-n)//2));canvas.save(dest)
(RES/'values/go_brand.xml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="go_brand">'+color+'</color></resources>\n',encoding='utf8')
p=RES/'values/styles.xml';s=p.read_text(encoding='utf8').replace('@drawable/go_pill','@drawable/go_logo_splash');p.write_text(s,encoding='utf8')
manifest.append({'launcher':'standard and round5densities; adaptive5foregrounds; Android12 splash; pre12 density splashes','source':'1000073150.jpg','green':color,'safeZone':'entire composition at60dp of108dp; no tracing/AI changes','limitation':'original JPG contains softness/compression, no original vector/font export'})
(REF/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Copied5reference JPGs; generated5preview crops and original-source launcher/splash assets; sampledgreen='+color)
