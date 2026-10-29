"""Deterministic crops of user supplied JPGs; no generated or stock replacement art.
Run with Pillow. Coordinates are recorded for review and repeatability.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / 'docs/design/canva'
OUT = ROOT / 'client/public/canva'
OUT.mkdir(parents=True, exist_ok=True)
# source filename, bounding box in original pixels (left, top, right, bottom)
CROPS = {
    'scan': ('1000073025.jpg', (21, 24, 73, 73)),
    'pin': ('1000073025.jpg', (653, 26, 684, 62)),
    'login-header': ('1000073027.jpg', (24, 163, 552, 538)),
    'logo': ('1000073027.jpg', (212, 300, 370, 441)),
    'doctor': ('1000073025.jpg', (435, 301, 678, 560)),
    'banner-dozova': ('1000073024.jpg', (53, 893, 675, 1151)),
    'category-medications': ('1000073025.jpg', (633, 161, 707, 234)),
    'category-natural': ('1000073025.jpg', (508, 161, 581, 234)),
    'category-skincare': ('1000073025.jpg', (382, 161, 455, 234)),
    'category-baby': ('1000073025.jpg', (263, 161, 336, 234)),
    'category-supplies': ('1000073025.jpg', (141, 161, 214, 234)),
    'category-pets': ('1000073025.jpg', (24, 161, 97, 234)),
    'clinic-skin': ('1000073024.jpg', (593, 722, 707, 835)),
    'clinic-teeth': ('1000073024.jpg', (443, 722, 558, 835)),
    'clinic-bones': ('1000073024.jpg', (306, 722, 423, 835)),
    'clinic-child': ('1000073024.jpg', (173, 722, 287, 835)),
    'clinic-internal': ('1000073024.jpg', (20, 722, 136, 835)),
    'brand-beesline': ('1000073024.jpg', (591, 501, 706, 616)),
    'brand-gillette': ('1000073024.jpg', (446, 501, 563, 616)),
    'brand-dove': ('1000073024.jpg', (304, 501, 420, 616)),
    'brand-pampers': ('1000073024.jpg', (159, 501, 276, 616)),
    'brand-babyjoy': ('1000073024.jpg', (19, 501, 135, 616)),
    'product-panadol': ('1000073025.jpg', (549, 640, 663, 788)),
    'product-votrex': ('1000073025.jpg', (318, 638, 378, 792)),
    'product-melatonin': ('1000073025.jpg', (51, 636, 176, 790)),
    'nav-home': ('1000073024.jpg', (612, 1206, 649, 1244)),
    'nav-search': ('1000073024.jpg', (504, 1206, 546, 1246)),
    'nav-cart': ('1000073024.jpg', (391, 1204, 437, 1247)),
    'nav-doctor': ('1000073024.jpg', (280, 1204, 327, 1247)),
    'nav-reminder': ('1000073024.jpg', (176, 1204, 219, 1247)),
    'nav-profile': ('1000073024.jpg', (68, 1204, 108, 1247)),
}
manifest = []
for name, (source, box) in CROPS.items():
    image = Image.open(REF / source)
    image.crop(box).save(OUT / f'{name}.png')
    manifest.append({'asset': f'/canva/{name}.png', 'source': source, 'box': box})
for name, source, box in [
    ('login', '1000073027.jpg', (24, 163, 552, 1104)),
    ('discovery', '1000073024.jpg', (0, 0, 724, 1280)),
    ('home', '1000073025.jpg', (5, 3, 723, 1277)),
    ('cart', '1000073026.jpg', (0, 0, 720, 1280)),
]:
    Image.open(REF / source).crop(box).save(REF / f'{name}-reference.png')
(REF / 'asset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Extracted {len(manifest)} original raster elements and 4 app-only references.')
