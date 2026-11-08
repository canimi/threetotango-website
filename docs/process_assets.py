"""Download the MEGICA renders and build every site asset from them.

Outputs (relative to the repo):
  public/img/scenes/<scene>.webp            800x1004 scene polaroids
  public/gift/preview/wall-<id>.webp         360x640 wallpaper previews
  public/gift/preview/react-<id>.webp        300x300 sticker previews
  public/gift/gifs/<id>.gif                  360x360 animated reaction stickers
  public/gift/three-to-tango.gif             400x400 all four reactions in one loop
  public/gift/wallpapers.zip                 3 full-size phone wallpapers (JPEG)
"""
import io, json, math, os, sys, urllib.request, zipfile
from PIL import Image

REPO = '/home/claude/ttw'
SRC = '/home/claude/assets_src'
ids = json.load(open('/home/claude/assets.json'))
os.makedirs(SRC, exist_ok=True)


def fetch(name):
    path = f'{SRC}/{name}.png'
    if not os.path.exists(path):
        url = f'https://g.tlcdn.com/gen/{ids[name]}.png'
        with urllib.request.urlopen(url, timeout=120) as r, open(path, 'wb') as f:
            f.write(r.read())
    return Image.open(path).convert('RGB')


def out(rel):
    p = os.path.join(REPO, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


# Scenes
for scene in ['kitchen-table', 'sofa-gang', 'fridge-heist', 'box-fort', 'window-birds', 'lettuce-crime']:
    im = fetch(f'scene-{scene}').resize((800, 1004), Image.LANCZOS)
    im.save(out(f'public/img/scenes/{scene}.webp'), 'WEBP', quality=80, method=6)

# Wallpapers: previews + zip of full-size JPEGs
zbuf = io.BytesIO()
with zipfile.ZipFile(zbuf, 'w', zipfile.ZIP_STORED) as z:
    for cid in ['luka', 'budy', 'caddy']:
        im = fetch(f'wall-{cid}')
        im.resize((360, 640), Image.LANCZOS).save(out(f'public/gift/preview/wall-{cid}.webp'), 'WEBP', quality=78, method=6)
        b = io.BytesIO()
        im.save(b, 'JPEG', quality=90, optimize=True, progressive=True)
        z.writestr(f'three-to-tango-{cid}-wallpaper.jpg', b.getvalue())
open(out('public/gift/wallpapers.zip'), 'wb').write(zbuf.getvalue())


# Reaction stickers: previews + animated GIFs (squash-and-bounce, wobble)
def bounce_frames(im, size, n=14):
    base = im.resize((size, size), Image.LANCZOS)
    bg = base.getpixel((4, 4))
    frames = []
    for i in range(n):
        t = i / n
        sy = 1 + 0.06 * math.sin(t * 2 * math.pi)          # breathe
        sx = 1 - 0.035 * math.sin(t * 2 * math.pi)
        ang = 3.0 * math.sin(t * 2 * math.pi + math.pi / 3)  # wobble
        w, h = int(size * sx), int(size * sy)
        f = base.resize((w, h), Image.LANCZOS).rotate(ang, resample=Image.BICUBIC, fillcolor=bg)
        canvas = Image.new('RGB', (size, size), bg)
        canvas.paste(f, ((size - w) // 2, size - h))        # anchored at the bottom (paws stay put)
        frames.append(canvas)
    return frames


def save_gif(frames, path, ms):
    pal = [f.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in frames]
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=ms, loop=0, optimize=True, disposal=1)


all_frames = []
for cid in ['luka', 'budy', 'caddy', 'nora']:
    im = fetch(f'react-{cid}')
    im.resize((300, 300), Image.LANCZOS).save(out(f'public/gift/preview/react-{cid}.webp'), 'WEBP', quality=80, method=6)
    save_gif(bounce_frames(im, 300, n=10), out(f'public/gift/gifs/{cid}.gif'), 90)
    all_frames += bounce_frames(im, 320, n=10)
save_gif(all_frames, out('public/gift/three-to-tango.gif'), 90)

for root, _, files in os.walk(os.path.join(REPO, 'public/gift')):
    for fn in files:
        p = os.path.join(root, fn)
        print(os.path.relpath(p, REPO), os.path.getsize(p))
for fn in sorted(os.listdir(os.path.join(REPO, 'public/img/scenes'))):
    print('scenes', fn, os.path.getsize(os.path.join(REPO, 'public/img/scenes', fn)))
