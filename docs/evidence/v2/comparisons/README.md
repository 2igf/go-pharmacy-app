# Canva references beside actual browser captures

These **18 lossless PNG comparison boards** place the supplied Canva raster reference on the left and the actual CUA browser capture on the right. This is visual evidence, **not a pixel-perfect acceptance claim**. No product source or captured screenshot was edited for this task.

## Primary comparisons

The five requested screens are compared at all three widths. At 430 pixels, the browser returned a 763-pixel image height although the requested viewport height was 764; the original browser report records that rounding. Each reference is resized to the **actual image width**, preserving its aspect ratio. Natural reference heights can differ slightly, and the remaining area is white padding.

| Screen | Reference and crop | 360 px | 393 px | 430 px |
| --- | --- | --- | --- | --- |
| Login | Original `1000073027.jpg`, `(24,163,552,1104)`; excludes the Canva editor | [Compare](primary-login-360.png) | [Compare](primary-login-393.png) | [Compare](primary-login-430.png) |
| Home | New `1000073171.jpg`, complete 719×1280 image | [Compare](primary-home-360.png) | [Compare](primary-home-393.png) | [Compare](primary-home-430.png) |
| Discovery | New `1000073162.jpg`, complete 720×1280 image | [Compare](primary-discovery-360.png) | [Compare](primary-discovery-393.png) | [Compare](primary-discovery-430.png) |
| Doctors | New `1000073159.jpg`, complete 720×1280 image | [Compare](primary-doctors-360.png) | [Compare](primary-doctors-393.png) | [Compare](primary-doctors-430.png) |
| Cart | New `1000073174.jpg`, complete 719×1280 image | [Compare](primary-cart-360.png) | [Compare](primary-cart-393.png) | [Compare](primary-cart-430.png) |

## Original-reference coverage

The original four supplied screen references remain represented: Login is the primary comparison above; the other three are additionally compared at 393 pixels.

| Original reference | Crop | Secondary board |
| --- | --- | --- |
| Home `1000073025.jpg` | `(5,3,723,1277)` | [Original Home / actual 393](secondary-home-393.png) |
| Discovery `1000073024.jpg` | `(0,0,724,1280)` | [Original Discovery / actual 393](secondary-discovery-393.png) |
| Cart `1000073026.jpg` | `(0,0,720,1280)` | [Original Cart / actual 393](secondary-cart-393.png) |

The fifth new reference, logo `1000073150.jpg`, is retained here at its complete original size and is already compared separately in [the launcher-source comparison](../launcher-source-comparison.png). It is not substituted into browser screenshots or redrawn.

## What visual inspection found

All five primary 393-pixel boards, all ten 360/430-pixel extreme-width boards, and the three original-reference secondary boards were inspected. No new blocking geometry defect was identified by this comparison pass. This does not mean every dimension or glyph matches the raster design.

- **Login:** the original header artwork, logo, green curve and main column align closely. Actual placeholders accurately say Email instead of promising username/mobile login. At 360 pixels, actual field/button heights are visibly taller than the scaled raster controls, and the registration/password safety notice adds text between the button and signup link. The signup link remains available. At 393/430 pixels the major vertical alignment is closer. Font metrics, letter spacing and anti-aliasing still differ.
- **Home:** category assets, doctor artwork, green header and section order follow the references. The authenticated fictional address replaces the reference's sample address. Arabic headings, category captions and call-to-action text appear thinner/smaller than the source raster. The doctor hero includes the truthful unavailable-service note. The current database provides one restricted DEMO medication in the first medication row rather than the reference's three photographed medicines, leaving visible empty row space. The medical-supplies placeholders follow real catalog contents. These captures do not assert that the reference's photographed medicines or prices exist in the application catalog.
- **Discovery:** the five brand marks, clinic specialty assets and original Dozova banner are present. The added knowledge-directory entry and catalog-status copy move the product/brand/clinic/banner stack downward relative to both reference generations. Consequently only the upper part of the Dozova artwork is above the fixed navigation in the captured first viewport at 360/393/430; the rest requires ordinary vertical scrolling. This is a remaining first-screen composition difference. Product images are explicit unavailable-image placeholders, and long fictional product names wrap/truncate differently from the short source names. The search/filter glyphs and Arabic typography are not exact raster reproductions.
- **Doctors:** the three source photographs, specialty strip, card/action arrangement and clinic marks are retained. Generic preview identities, unknown fee/wait/location/rating text, and the preview notice are intentional replacements for unverified doctor names, numerical fees and ratings. That notice and the longer factual labels increase the card stack's vertical extent: the clinic logos begin lower and are partially below the fixed navigation in the initial viewport, particularly at 360 pixels. The logos remain reachable by scrolling. Heading weight, icon shape, image crop/scale and button text metrics differ from the reference.
- **Cart:** the address header, rounded item area, saved-address section, delivery-address option, payment/total panel and green action button preserve the reference hierarchy. The captured real test basket contains **one** DEMO line totaling **0.10 JOD**, versus three reference medicines and a 14-JOD design total. The reduced item count moves the lower panels and action upward and leaves more grey space below. Quantity controls and the disabled card/location affordances differ from the purely visual reference because they reflect actual safe simulation behavior. The product name can truncate, and the additional simulation text changes line wrapping. No real medicine, delivery promise or payment capability was fabricated to make the screenshot match.
- **Across screens:** six-item fixed bottom navigation is present. The current-page highlight changes with the actual route, while a static reference may highlight a different tab. Text weights, icon strokes and raster softness vary. The original exact font name, editable vector layouts and higher-resolution exports were not supplied, so exact typography cannot be asserted. The browser validation separately measured no page-level horizontal overflow; vertical content below a fixed navigation bar is not evidence of missing content.

No raw pixel MAE/SSIM score is presented: real catalog data, product counts, safety messages, current-route highlights and unverified medical fields intentionally differ, so such a score would not establish implementation quality.

## Integrity and reproducibility

- `reference-originals/` contains byte-identical copies of **all nine supplied JPGs**: four original screen references plus five new references, including the logo. Original source files remain in `docs/design/canva/` and `docs/design/canva-v2/`.
- `reference-crops/` contains the exact documented crops, decoded to PNG. Crop boxes use Pillow's left/top-inclusive and right/bottom-exclusive convention.
- [manifest.json](manifest.json) records source/copy SHA-256, original dimensions, crop bounds and dimensions, cropped-PNG hashes, actual screenshot hashes/dimensions, proportional reference sizes and output hashes.
- [generate_comparisons.py](generate_comparisons.py) is the deterministic generator. It reads existing references/screenshots and writes only inside this comparison directory. Reference resampling uses Lanczos; **the actual screenshot pixels are pasted without resize, crop, retouching or interpolation**. Labels and white padding are outside the images. PNG encoding adds no new lossy compression; the underlying original references and CUA JPEG captures already have their original raster/compression limits.
- [verification.json](verification.json) records the byte-copy and pixel-preservation audit. Each actual panel was compared against its source screenshot pixels, and every retained JPG hash was checked against its source.

The browser screenshots precede the final profile-only privacy repair; their five core routes were not redesigned by that repair. The separate [browser report](../browser/browser-report.md) contains the actual successful post-fix logout/history and account-switch retest evidence.
