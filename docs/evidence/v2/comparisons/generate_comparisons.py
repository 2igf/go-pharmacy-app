"""Deterministic comparison boards; never alters captured browser evidence."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path(__file__).resolve().parent
ROOT = OUTPUT.parents[3]
ORIGINALS = OUTPUT / "reference-originals"
CROPS = OUTPUT / "reference-crops"
for directory in (ORIGINALS, CROPS):
    directory.mkdir(parents=True, exist_ok=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path):
    return path.relative_to(ROOT).as_posix()


def font(size):
    return ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size)


references = {
    "login-original": ("docs/design/canva/1000073027.jpg", (24, 163, 552, 1104)),
    "home-new": ("docs/design/canva-v2/1000073171.jpg", None),
    "discovery-new": ("docs/design/canva-v2/1000073162.jpg", None),
    "doctors-new": ("docs/design/canva-v2/1000073159.jpg", None),
    "cart-new": ("docs/design/canva-v2/1000073174.jpg", None),
    "home-original": ("docs/design/canva/1000073025.jpg", (5, 3, 723, 1277)),
    "discovery-original": ("docs/design/canva/1000073024.jpg", (0, 0, 724, 1280)),
    "cart-original": ("docs/design/canva/1000073026.jpg", (0, 0, 720, 1280)),
    "logo-new": ("docs/design/canva-v2/1000073150.jpg", None),
}
manifest = {"method": "Reference resized proportionally to actual screenshot width with Lanczos. Actual screenshot pixels copied unchanged. White padding; PNG output. No quality score or pixel-perfect claim.", "references": {}, "comparisons": []}
images = {}
for key, (source_name, crop) in references.items():
    source = ROOT / source_name
    original_copy = ORIGINALS / source.name
    shutil.copy2(source, original_copy)
    original = Image.open(source).convert("RGB")
    bounds = crop or (0, 0, original.width, original.height)
    cropped = original.crop(bounds)
    crop_path = CROPS / f"{key}.png"
    cropped.save(crop_path)
    images[key] = cropped
    manifest["references"][key] = {
        "source": source_name,
        "originalSize": list(original.size),
        "sourceSha256": digest(source),
        "retainedFullImage": relative(original_copy),
        "retainedFullImageSha256": digest(original_copy),
        "cropBoxLeftTopRightBottom": list(bounds),
        "cropCoordinateConvention": "Pillow: left/top inclusive, right/bottom exclusive",
        "cropSize": list(cropped.size),
        "cropPng": relative(crop_path),
        "cropPngSha256": digest(crop_path),
    }

jobs = [(screen, width, f"{screen}-new" if screen != "login" else "login-original", "primary")
        for screen in ("login", "home", "discovery", "doctors", "cart")
        for width in (360, 393, 430)]
jobs += [(screen, 393, f"{screen}-original", "secondary")
         for screen in ("home", "discovery", "cart")]

for screen, requested_width, reference_key, priority in jobs:
    actual_path = ROOT / f"docs/evidence/v2/browser/{screen}-{requested_width}.png"
    actual = Image.open(actual_path).convert("RGB")
    reference = images[reference_key]
    scaled_height = round(reference.height * actual.width / reference.width)
    resized = reference.resize((actual.width, scaled_height), Image.Resampling.LANCZOS)
    margin, gap, header, footer = 16, 24, 76, 56
    board = Image.new("RGB", (2 * actual.width + margin * 2 + gap,
                              header + max(resized.height, actual.height) + footer), "white")
    x_actual = margin + actual.width + gap
    board.paste(resized, (margin, header))
    board.paste(actual, (x_actual, header))
    draw = ImageDraw.Draw(board)
    source_file = Path(references[reference_key][0]).name
    draw.text((margin, 8), f"REFERENCE | {screen.title()}", fill="#16382c", font=font(16))
    draw.text((margin, 31), f"{source_file} | {priority} reference", fill="#333333", font=font(12))
    draw.text((margin, 50), f"Proportional: {resized.width} x {resized.height} px", fill="#555555", font=font(12))
    draw.text((x_actual, 8), f"ACTUAL | {requested_width}px viewport", fill="#16382c", font=font(16))
    draw.text((x_actual, 31), f"{actual_path.name}", fill="#333333", font=font(12))
    draw.text((x_actual, 50), f"Unaltered capture: {actual.width} x {actual.height} px", fill="#555555", font=font(12))
    bottom = header + max(resized.height, actual.height)
    draw.text((margin, bottom + 10), "White areas below either image are padding, not product content.", fill="#555555", font=font(12))
    draw.text((margin, bottom + 29), "DEMO catalog and safety labels differ intentionally; exact font/vector exports unavailable.", fill="#555555", font=font(12))
    output = OUTPUT / f"{priority}-{screen}-{requested_width}.png"
    board.save(output)
    manifest["comparisons"].append({
        "screen": screen, "priority": priority, "requestedViewportWidth": requested_width,
        "referenceKey": reference_key, "referenceResizedSize": list(resized.size),
        "actual": relative(actual_path), "actualSize": list(actual.size),
        "actualSha256": digest(actual_path), "actualPixelsAltered": False,
        "composite": relative(output), "compositeSize": list(board.size), "compositeSha256": digest(output),
    })

manifest["logoComparison"] = "docs/evidence/v2/launcher-source-comparison.png (prepared separately by root; original logo retained here)"
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps({"comparisonCount": len(jobs), "referenceCount": len(references), "output": str(OUTPUT)}))
