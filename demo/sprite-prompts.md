# Sprite prompts for GPT Image

Paste the **style block** first in every request, then one **asset line**. Generate each asset as its own image so they stay consistent and can be animated separately. Save each PNG to `public/sprites/<file>.png` with the exact file name given.

## Style block (prepend to every prompt)

```
Pixel-art sticker, neo-noir Blade Runner 2049 mood, crisp 64x64 pixel grid upscaled with hard nearest-neighbor edges (no blur, no anti-aliasing, no gradients inside pixels), limited palette ONLY: protocol navy #1B3158, validator blue #2F578C, cipher violet #412C5C, quantum plum #664C88, blockstream gold #E9A13F, token sand #FFCC6F, sky sync #ACC6E9, hash cloud #DDD6DD, burnt block #702718, near-black #0B0F1A. 2-pixel near-black outline around the subject, then a 3-pixel hash-cloud sticker border with a subtle 2-pixel drop shadow. Subtle neon rim light in sky sync or gold on one side. Centered subject, 1024x1024 canvas, fully transparent background, no text unless specified, no real brand logos, no watermark.
```

## Characters and nodes

| File | Asset line |
|---|---|
| `agent.png` | A lone android trading agent in a long dark coat with a raised collar, a glowing sky-sync visor across the eyes, holding a small data slate; three-quarter view, standing pose. Rim light in sky sync. |
| `merchant.png` | A cramped neo-noir street kiosk selling data: a hooded vendor behind a counter of glowing monitor tiles showing tiny bar charts, a hanging neon sign with the word "ODDS" in gold pixel letters. |
| `gateway.png` | A monumental arched gate made of stacked gold and navy blocks, a glowing gold archway in the middle, small light beams going through it, like a tollgate at the edge of a megacity. |
| `mint.png` | A blindfolded robot notary with a heavy stamping press, the blindfold in cipher violet, a stack of sealed violet tickets beside it; it is stamping without looking. |
| `oracle.png` | A twin-screen street terminal with two glowing faces (one gold, one sky sync) showing probability bars and a candlestick chart, cables trailing down. |
| `human.png` | A gloved hand holding a rubber stamp hovering over a paper slip, warm gold desk-lamp light from above. |
| `whale.png` | A glitching holographic whale made of scanlines and broken pixels in burnt block red and plum, flickering and partially corrupted, clearly untrustworthy. |

## Props and tokens

| File | Asset line |
|---|---|
| `coin.png` | A thick gold pixel coin with a simple "$" engraved, slight shine highlight, seen slightly from the side. Small subject filling 60% of the canvas. |
| `credit.png` | A sealed cipher-violet ticket with a sky-sync wax seal shaped like a closed eye, faint glow. Small subject filling 60% of the canvas. |
| `blinded.png` | A small cube of scrambled glyphs in plum and sky sync, edges dissolving into fog pixels, representing an encrypted blinded value. |
| `stamp-approved.png` | A rectangular rubber-stamp imprint reading "APPROVED" in token sand pixel letters, slightly rotated, ink texture made of pixels. |
| `stamp-denied.png` | A rectangular rubber-stamp imprint reading "DENIED" in burnt block red pixel letters, slightly rotated, ink texture made of pixels. |
| `mask.png` | A sleek anonymous face mask in hash cloud with sky-sync eye slits, floating, representing "payer: anonymous". |
| `shield.png` | A heraldic pixel shield in validator blue with a gold padlock in the center, representing spend guardrails. |
| `lightning-off.png` | A gold lightning bolt crossed out by a thin sky-sync slash, representing "gasless". |

## Backgrounds (no sticker border for these two)

Replace the sticker sentence of the style block with: "No outline, no sticker border, full-bleed scene."

| File | Asset line |
|---|---|
| `city-far.png` | 3840x1080 wide parallax layer: distant megacity skyline at night in navy and violet, thick fog, a few giant gold billboard glows with no readable text, rain haze. Tileable horizontally. |
| `city-near.png` | 3840x1080 wide parallax layer with transparent sky: close rooftops, antennas, vents and wet ledges in near-black and protocol navy, small gold and sky-sync window lights. Tileable horizontally. |

## Optional: arrows

The connecting lines, moving packets, rain and glow are drawn in code (sharper and animatable), so arrows are optional. If you want pixel arrowheads anyway:

| File | Asset line |
|---|---|
| `arrow-gold.png` | A single chunky pixel arrowhead pointing right in blockstream gold with a 2-pixel near-black outline. Small subject filling 40% of the canvas. |
| `arrow-violet.png` | The same chunky pixel arrowhead pointing right in cipher violet with a sky-sync inner highlight. |
