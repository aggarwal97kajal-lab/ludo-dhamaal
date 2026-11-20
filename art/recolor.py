# Makes every character in every team colour by recolouring only the clothes.
import numpy as np, colorsys
from PIL import Image
IMG = '/home/claude/ludo/app/src/main/assets/www/img/'
SRC = '/home/claude/ludo/art/'
CHARS = ['red', 'green', 'yellow', 'blue']           # source pictures (Riya, Arjun, Dadaji, Chotu)
TEAM = [(224, 16, 58), (0, 200, 83), (255, 208, 0), (30, 94, 240)]
# clothing hue band (degrees) + start of clothes (fraction of height) for each source picture
CLOTH = {'red': ((345, 8), 0.40), 'green': ((70, 150), 0.36), 'yellow': ((30, 68), 0.34), 'blue': ((175, 212), 0.40)}

def hsv(a):
    r, g, b = [a[..., i] / 255.0 for i in range(3)]
    mx, mn = np.max(a[..., :3], axis=2) / 255.0, np.min(a[..., :3], axis=2) / 255.0
    d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-6), 0)
    return h, s, mx

def recolor(src, ci, team, top_override=None):
    a = np.array(src).astype(np.float32)
    h, s, v = hsv(a)
    (h0, h1), top = CLOTH[CHARS[ci]]
    if top_override is not None: top = top_override
    band = ((h >= h0) | (h <= h1)) if h0 > h1 else ((h >= h0) & (h <= h1))
    H = a.shape[0]
    rows = np.arange(H)[:, None] / H
    mask = band & (s > (0.55 if ci == 0 else 0.35)) & (v > 0.18) & (rows > top) & (a[..., 3] > 0)
    # grow the mask a little into the soft edge of the clothes, staying inside the same hue band
    from scipy import ndimage
    edge = ndimage.binary_dilation(mask, iterations=2) & band & (s > 0.22) & (rows > top) & (a[..., 3] > 0)
    mask = mask | edge
    if not mask.any() or ci == team:
        return src
    lum = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2])
    med = np.median(lum[mask])
    shade = np.clip(lum / max(med, 1), 0.25, 1.45)[..., None]
    tgt = np.array(TEAM[team], np.float32)
    new = np.clip(tgt * shade, 0, 255)
    # bright highlights blend toward white so folds still look soft
    hi = np.clip((shade - 1.0) / 0.45, 0, 1)
    new = new * (1 - hi * 0.35) + 255 * hi * 0.35
    out = a.copy()
    m = mask[..., None]
    out[..., :3] = np.where(m, new, a[..., :3])
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

for ci, name in enumerate(CHARS):
    body = Image.open(SRC + name + '.png').convert('RGBA')
    face = Image.open(SRC + name + '-face.png').convert('RGBA')
    for t in range(4):
        b2 = recolor(body, ci, t)
        b2 = b2.resize((round(b2.width * 420 / b2.height), 420), Image.LANCZOS)
        b2.save(IMG + f'c{ci}-{t}.png', optimize=True)
        # faces: recolour using the same rule on the face crop (collar area only)
        # faces: only the collar at the very bottom is clothing; lips and hair must stay as they are
        f2 = recolor(face, ci, t, top_override=0.78) if ci != t else face
        f2.resize((128, 128), Image.LANCZOS).save(IMG + f'c{ci}-{t}-face.png', optimize=True)
print('done')
