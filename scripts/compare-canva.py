"""Side-by-side evidence only: different live catalog content is not a pixel pass.
Keep the real screenshot unchanged; resize only the comparison copies to equivalent
aspect ratios. Requires Pillow, not a browser or image generation service.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageStat, ImageChops

root = Path(__file__).resolve().parents[1]
evidence = root / 'docs/evidence/canva'
reference = root / 'docs/design/canva'
metrics = []
for name in ['login', 'home', 'discovery', 'cart']:
    actual = Image.open(evidence / f'{name}.jpg').convert('RGB')
    original = Image.open(reference / f'{name}-reference.png').convert('RGB')
    size = (393, round(original.height * 393 / original.width))
    left = original.resize(size, Image.Resampling.LANCZOS)
    right = actual.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (size[0] * 2 + 14, size[1] + 34), '#ddd')
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 9), f'{name}: Canva reference', fill='#111')
    draw.text((size[0] + 24, 9), 'Actual customer UI / real API data', fill='#111')
    canvas.paste(left, (0, 34))
    canvas.paste(right, (size[0] + 14, 34))
    canvas.save(evidence / f'compare-{name}.png')
    delta = ImageStat.Stat(ImageChops.difference(left, right))
    metrics.append({'screen': name, 'referenceSize': list(original.size), 'browserScreenshotSize': list(actual.size), 'comparisonSize': list(size), 'meanAbsoluteRgbDifference': round(sum(delta.mean)/3, 3), 'pixelPerfect': False})
(evidence / 'visual-comparison.json').write_text(json.dumps({'note': 'Descriptive raw image difference, not an acceptance score. Text/fonts/live product counts, prices, imagery and safety notices differ. See discrepancy report.', 'screens': metrics}, indent=2)+'\n')
print('Created four side-by-side comparisons. No pixel-perfect pass claimed.')
