import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
im = Image.open('/mnt/user-data/uploads/eae77e80-image.png').convert('RGBA')
a = np.array(im).astype(np.int32)
rgb = a[..., :3]
alpha_in = a[..., 3]
# Near-white or already transparent counts as background candidate.
white = ((rgb.min(axis=2) > 236) & (rgb.max(axis=2) - rgb.min(axis=2) < 18)) | (alpha_in < 10)
# Keep only background connected to the image border (so white shoes / teeth stay).
lab, n = ndimage.label(white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border)) | (alpha_in < 10)
# Enclosed gaps (like between an arm and the body) that are big and pure white are background too.
sz = ndimage.sum(white, lab, range(1, n + 1))
very = (rgb.min(axis=2) > 246) | (alpha_in < 10)
big = [i + 1 for i, v in enumerate(sz) if v > 250]
bg |= np.isin(lab, big) & very
fg = ~bg
fg = ndimage.binary_opening(fg, iterations=1)
# soft edge
alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
out = im.copy(); out.putalpha(alpha)
H, W = fg.shape
# Find the 4 characters: split into quadrants, take bounding box of foreground in each.
names = {(0, 0): 'red', (0, 1): 'blue', (1, 0): 'yellow', (1, 1): 'green'}
for (r, c), name in names.items():
    ys, xs = slice(r * H // 2, (r + 1) * H // 2), slice(c * W // 2, (c + 1) * W // 2)
    q = fg[ys, xs]
    lab2, n2 = ndimage.label(q)
    sizes = ndimage.sum(q, lab2, range(1, n2 + 1))
    keep = lab2 == (int(np.argmax(sizes)) + 1)
    yy, xx = np.where(keep)
    y0, y1, x0, x1 = yy.min() + ys.start, yy.max() + ys.start, xx.min() + xs.start, xx.max() + xs.start
    pad = 6
    crop = out.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    # mask out other blobs inside crop
    m = np.zeros((H, W), bool); m[ys, xs] = keep
    m = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    ca = np.array(crop); ca[..., 3] = np.minimum(ca[..., 3], np.array(m)); crop = Image.fromarray(ca)
    # Full body sprite: height 512
    h = 512; w = round(crop.width * h / crop.height)
    crop.resize((w, h), Image.LANCZOS).save(f'/home/claude/ludo/art/{name}.png', optimize=True)
    # Head avatar: top part, square
    head = crop.crop((0, 0, crop.width, int(crop.width * 1.0)))
    hs = min(head.width, head.height)
    cx = crop.width // 2
    hc = crop.crop((cx - hs // 2, 0, cx + hs // 2, hs)).resize((160, 160), Image.LANCZOS)
    hc.save(f'/home/claude/ludo/art/{name}-face.png', optimize=True)
    print(name, crop.size, (x0, y0, x1, y1))
# preview on dark bg
prev = Image.new('RGBA', (1100, 560), (22, 13, 61, 255)); x = 10
for name in ['red', 'green', 'yellow', 'blue']:
    s = Image.open(f'/home/claude/ludo/art/{name}.png'); prev.alpha_composite(s, (x, 20)); x += s.width + 10
x = 10
for name in ['red', 'green', 'yellow', 'blue']:
    pass
prev.save('/tmp/cut/preview.png')
faces = Image.new('RGBA', (700, 180), (22, 13, 61, 255))
for i, name in enumerate(['red', 'green', 'yellow', 'blue']):
    faces.alpha_composite(Image.open(f'/home/claude/ludo/art/{name}-face.png'), (10 + i * 170, 10))
faces.save('/tmp/cut/faces.png')
