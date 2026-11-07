"""Test-only: builds a realistic preview feed + placeholder 9:16 thumbs for local screenshots.

Writes into <out>/ (never into public/):
  <out>/episodes.json      12 episodes based on tests/fixtures/episodes.json
  <out>/media/thumbs/*.jpg placeholder 9:16 stills cropped from the ref sheets
Usage: python3 -I tests/preview/make-fixture.py <repo> <out>
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

repo, out = Path(sys.argv[1]), Path(sys.argv[2])
(out / 'media' / 'thumbs').mkdir(parents=True, exist_ok=True)
base = json.loads((repo / 'tests/fixtures/episodes.json').read_text())

titles = [
    ('The Lettuce Incident', ['nora', 'budy']),
    ('Keyboard Landlord', ['nora', 'luka']),
    ('The Rug Is Mine', ['caddy', 'budy']),
    ('Zoom Call Ambush 🙀', ['nora', 'luka', 'budy']),
    ('Who Opened the Drawer?', ['luka']),
    ('Breakfast Negotiations', ['budy', 'nora']),
    ('Sunbeam Real Estate', ['caddy']),
    ('The Box Was Not For You', ['luka', 'budy']),
    ('Caddy Has Feelings (Once) 😾', ['caddy', 'budy', 'nora']),
    ('Laptop Warm, Nora Cold', ['luka', 'nora']),
    ('Fridge Heist Part 2', ['budy', 'luka']),
    ('No Thumb Yet', ['nora', 'mystery-cat']),
]
# (sheet, crop box as fractions x0,y0,x1,y1) — 9:16 regions around a pose
crops = [
    ('budy', (0.08, 0.0, 0.30, 0.62)), ('luka', (0.03, 0.22, 0.25, 0.86)),
    ('caddy', (0.00, 0.02, 0.27, 0.58)), ('nora', (0.08, 0.0, 0.30, 1.0)),
    ('luka', (0.24, 0.25, 0.46, 0.86)), ('budy', (0.30, 0.0, 0.53, 0.62)),
    ('caddy', (0.27, 0.05, 0.53, 0.58)), ('luka', (0.75, 0.0, 0.97, 0.47)),
    ('caddy', (0.61, 0.55, 0.85, 1.0)), ('nora', (0.62, 0.0, 0.95, 1.0)),
    ('budy', (0.67, 0.56, 0.88, 1.0)), None,
]
tints = [(23, 50, 42), (168, 50, 43), (227, 162, 26), (31, 66, 54)]

eps = []
for i, ((title, cast), crop) in enumerate(zip(titles, crops)):
    src = base[i] if i < 3 else base[i % 3]
    eid = f'p{i:02d}'
    thumb = ''
    if crop:
        sheet, (x0, y0, x1, y1) = crop
        im = Image.open(repo / f'public/img/refs/{sheet}.webp').convert('RGB')
        w, h = im.size
        box = [int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)]
        im = im.crop(box)
        # force 9:16
        cw, ch = im.size
        tw = int(ch * 9 / 16)
        if tw <= cw:
            im = im.crop(((cw - tw) // 2, 0, (cw - tw) // 2 + tw, ch))
        else:
            th = int(cw * 16 / 9)
            pad = Image.new('RGB', (cw, th), (226, 226, 226))
            pad.paste(im, (0, (th - ch) // 2))
            im = pad
        im = im.resize((540, 960))
        # warm "living room" grade so tiles read like episode stills
        tint = Image.new('RGB', im.size, tints[i % len(tints)])
        im = Image.blend(im, tint, 0.28)
        im = ImageEnhance.Contrast(im).enhance(1.1)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 900, 540, 960], fill=(23, 50, 42))
        im.save(out / 'media' / 'thumbs' / f'{eid}.jpg', quality=78)
        thumb = f'/media/thumbs/{eid}.jpg'
    eps.append({
        **src,
        'id': eid,
        'slug': 'no-thumb-yet' if not crop else (src['slug'] if i < 3 else f'preview-{i}'),
        'title': title,
        'publishedAt': f'2026-{11 if i < 2 else 10}-{(5 - i) if i < 2 else (28 - i * 2):02d}T10:00:00Z',
        'thumbnailUrl': thumb,
        'heroMp4Path': '/data/hero/preview-hero.mp4' if i == 0 else None,
        'characters': cast,
    })
(out / 'episodes.json').write_text(json.dumps(eps, indent=2, ensure_ascii=False))
print(f'{len(eps)} episodes')
