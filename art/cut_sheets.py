# Cuts each turnaround sheet (3 rows x 5 views) into one atlas per character:
# rows = idle, walk A, walk B; columns = front, front 3/4, side, back 3/4, back (all facing right).
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
SHEETS = ['sheet-riya.png', 'sheet-arjun.png', 'sheet-dadaji.png', 'sheet-chotu.png']   # character 0..3
CW, CH, PAD_BOTTOM = 200, 280, 6
OUT = '/home/claude/ludo/app/src/main/assets/www/img/'
for ci, f in enumerate(SHEETS):
    im = Image.open(f).convert('RGBA'); a = np.array(im).astype(np.int32)
    rgb = a[..., :3]; H, W = rgb.shape[:2]
    white = (rgb.min(2) > 232) & (rgb.max(2) - rgb.min(2) < 20)
    lab, n = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    sz = ndimage.sum(white, lab, range(1, n + 1)); very = rgb.min(2) > 244
    bg |= np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 250]) & very
    fg = ndimage.binary_opening(~bg, iterations=1)
    alpha = np.array(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)))
    a[..., 3] = alpha
    lab2, n2 = ndimage.label(fg)
    objs = ndimage.find_objects(lab2); sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
    cells = {}
    for i, sl in enumerate(objs):
        if sizes[i] < 400: continue
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        key = (min(2, int(cy / (H / 3))), min(4, int(cx / (W / 5))))
        cells.setdefault(key, []).append(i + 1)
    assert len(cells) == 15, (f, sorted(cells))
    boxes = {}
    for k, ids in cells.items():
        m = np.isin(lab2, ids); ys, xs = np.where(m)
        boxes[k] = (ys.min(), ys.max(), xs.min(), xs.max(), m)
    tallest = max(b[1] - b[0] for b in boxes.values())
    widest = max(b[3] - b[2] for b in boxes.values())
    s = min((CH - PAD_BOTTOM - 4) / tallest, (CW - 6) / widest)
    atlas = Image.new('RGBA', (CW * 5, CH * 3), (0, 0, 0, 0))
    for (r, c), (y0, y1, x0, x1, m) in boxes.items():
        crop = a[y0:y1 + 1, x0:x1 + 1].copy()
        mm = ndimage.binary_dilation(m[y0:y1 + 1, x0:x1 + 1], iterations=2)
        crop[..., 3] = np.where(mm, crop[..., 3], 0)
        img = Image.fromarray(crop.astype(np.uint8), 'RGBA')
        w, h = max(1, round(img.width * s)), max(1, round(img.height * s))
        img = img.resize((w, h), Image.LANCZOS)
        ox = c * CW + (CW - w) // 2; oy = r * CH + CH - PAD_BOTTOM - h
        atlas.alpha_composite(img, (ox, oy))
    atlas.save(OUT + f'walk{ci}.webp', 'WEBP', quality=88, method=6)
    print(f, 'scale', round(s, 3))
