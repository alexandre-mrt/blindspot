"""Extract individual transparent sprites from the generated sprite sheet."""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ALPHA_ON = 16
ALPHA_FLOOR = 8
MARGIN = 8
NEIGHBOR_SLIVER_RATIO = 0.3
MIN_FRAGMENT_PX = 4
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "sprites"

ROW1 = (20, 342)
ROW2 = (400, 603)
CUTS = {"mint|oracle": 885, "human|whale": 1307}

BOXES = {
    "agent": (20, 183, *ROW1),
    "merchant": (183, 415, *ROW1),
    "gateway": (415, 666, *ROW1),
    "mint": (666, CUTS["mint|oracle"], *ROW1),
    "oracle": (CUTS["mint|oracle"], 1111, *ROW1),
    "human": (1111, CUTS["human|whale"], *ROW1),
    "whale": (CUTS["human|whale"], 1530, *ROW1),
    "coin": (10, 196, *ROW2),
    "credit": (196, 421, *ROW2),
    "blinded": (421, 613, *ROW2),
    "stamp-approved": (613, 825, *ROW2),
    "stamp-denied": (825, 1027, *ROW2),
    "mask": (1027, 1181, *ROW2),
    "shield": (1181, 1361, *ROW2),
    "lightning-off": (1361, 1522, *ROW2),
    "arrow-gold": (1340, 1536, 680, 780),
    "arrow-violet": (1340, 1536, 828, 932),
}
CUT_EDGES = {
    "mint": {"right"},
    "oracle": {"left"},
    "human": {"right"},
    "whale": {"left"},
}


def touches(labels, idx, edge):
    region = labels == idx
    return {"left": region[:, 0].any(), "right": region[:, -1].any()}[edge]


def extract(sheet, name, box):
    x0, x1, y0, y1 = box
    crop = sheet[y0:y1, x0:x1].copy()
    mask = crop[:, :, 3] > ALPHA_ON
    labels, count = ndimage.label(mask, structure=np.ones((3, 3)))
    if count == 0:
        return None, {"error": "no opaque pixels in box"}
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    keep = np.zeros_like(mask)
    dropped = 0
    for idx in range(1, count + 1):
        size = sizes[idx - 1]
        sliver = any(touches(labels, idx, e) for e in CUT_EDGES.get(name, ()))
        if idx != main and (size < MIN_FRAGMENT_PX or (sliver and size < sizes[main - 1] * NEIGHBOR_SLIVER_RATIO)):
            dropped += 1
            continue
        keep |= labels == idx
    soft = ndimage.binary_dilation(keep, iterations=2) & (crop[:, :, 3] > 0)
    crop[~soft, 3] = 0
    crop[crop[:, :, 3] < ALPHA_FLOOR, 3] = 0
    ys, xs = np.where(crop[:, :, 3] > 0)
    t, b, l, r = ys.min(), ys.max(), xs.min(), xs.max()
    edge_risk = [
        side
        for side, hit in {"top": t == 0, "bottom": b == crop.shape[0] - 1, "left": l == 0, "right": r == crop.shape[1] - 1}.items()
        if hit and side not in CUT_EDGES.get(name, ())
    ]
    body = crop[t : b + 1, l : r + 1]
    out = np.zeros((body.shape[0] + 2 * MARGIN, body.shape[1] + 2 * MARGIN, 4), dtype=np.uint8)
    out[MARGIN : MARGIN + body.shape[0], MARGIN : MARGIN + body.shape[1]] = body
    info = {"components": int(count), "dropped": dropped, "edge_risk": edge_risk}
    return Image.fromarray(out, "RGBA"), info


def contact_sheet(images):
    cell, cols = 220, 6
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * (cell + 24)), (11, 15, 26, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate(images):
        cx, cy = (i % cols) * cell, (i // cols) * (cell + 24)
        for yy in range(cy, cy + cell, 16):
            for xx in range(cx, cx + cell, 16):
                if ((xx - cx) // 16 + (yy - cy) // 16) % 2 == 0:
                    draw.rectangle([xx, yy, xx + 15, yy + 15], fill=(27, 49, 88, 255))
        scale = min((cell - 20) / img.width, (cell - 20) / img.height, 1)
        thumb = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.NEAREST)
        sheet.alpha_composite(thumb, (cx + (cell - thumb.width) // 2, cy + (cell - thumb.height) // 2))
        draw.text((cx + 8, cy + cell + 4), name, fill=(221, 214, 221, 255))
    return sheet


def main(src):
    sheet = np.array(Image.open(src).convert("RGBA"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    done = []
    for name, box in BOXES.items():
        img, info = extract(sheet, name, box)
        if img is None:
            print(f"FLAG {name}: {info['error']}")
            continue
        img.save(OUT_DIR / f"{name}.png")
        done.append((name, img))
        status = "FLAG possible clipping on " + ",".join(info["edge_risk"]) if info["edge_risk"] else "ok"
        print(f"{name:16s} {img.width:4d}x{img.height:<4d} components={info['components']:<3d} dropped={info['dropped']:<3d} {status}")
    contact_sheet(done).save(OUT_DIR / "contact-sheet.png")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/extract_sprites.py <sprite-sheet.png>")
    main(sys.argv[1])
