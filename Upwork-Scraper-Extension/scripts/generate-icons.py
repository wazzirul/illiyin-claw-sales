from PIL import Image, ImageDraw, ImageFilter
from urllib.request import urlopen
import os, math, random

SOURCE_URL = 'https://play-lh.googleusercontent.com/OtMKLcIcl_wNIhmuXUZT0L72ysVsdekDomOnhIjqAppwqix3wl3iniGGE9xY8AKEqhN9'
OUT_DIR = 'icons'
BASE_SIZE = 1024

random.seed(7)
os.makedirs(OUT_DIR, exist_ok=True)

src = Image.open(urlopen(SOURCE_URL)).convert('RGBA').resize((BASE_SIZE, BASE_SIZE), Image.Resampling.LANCZOS)
# Extract white logo as mask from source.
mask = Image.new('L', (BASE_SIZE, BASE_SIZE), 0)
pix = src.load()
mp = mask.load()
for y in range(BASE_SIZE):
    for x in range(BASE_SIZE):
        r, g, b, a = pix[x, y]
        whiteness = max(0, min(255, int((r + g + b) / 3) - 150) * 3)
        if a and r > 180 and g > 180 and b > 180:
            mp[x, y] = max(whiteness, 220)
mask = mask.filter(ImageFilter.GaussianBlur(0.5))

# Abstract scraped-data background: Upwork green with scraped-card strips, data scratches, and page fragments.
bg = Image.new('RGBA', (BASE_SIZE, BASE_SIZE), (18, 160, 34, 255))
d = ImageDraw.Draw(bg, 'RGBA')

# Diagonal page/card fragments.
for i in range(18):
    y = -160 + i * 78
    xoff = random.randint(-120, 120)
    color = random.choice([(255,255,255,28), (0,80,25,34), (117,230,110,35)])
    d.rounded_rectangle([xoff, y, BASE_SIZE + 170 + xoff, y + random.randint(18, 34)], radius=12, fill=color)

# Scraped result rows behind logo.
for i in range(10):
    x = random.randint(40, 170)
    y = random.randint(60, BASE_SIZE - 120)
    w = random.randint(420, 820)
    h = random.randint(34, 62)
    d.rounded_rectangle([x, y, min(BASE_SIZE-45, x+w), y+h], radius=14, fill=(255,255,255,26))
    for j in range(random.randint(2, 4)):
        yy = y + 10 + j*14
        d.line([x+26, yy, min(BASE_SIZE-75, x+w-random.randint(80, 240)), yy], fill=(255,255,255,42), width=5)

# Fine scrape marks.
for i in range(95):
    x = random.randint(0, BASE_SIZE)
    y = random.randint(0, BASE_SIZE)
    length = random.randint(40, 170)
    angle = random.uniform(-0.8, 0.8)
    x2 = x + int(math.cos(angle) * length)
    y2 = y + int(math.sin(angle) * length)
    d.line([x, y, x2, y2], fill=(255,255,255,random.randint(12, 38)), width=random.randint(2, 5))

# Subtle dark vignette for contrast.
v = Image.new('L', (BASE_SIZE, BASE_SIZE), 0)
vd = ImageDraw.Draw(v)
for r in range(BASE_SIZE//2, 0, -8):
    alpha = int(90 * (1 - r/(BASE_SIZE/2))**1.8)
    vd.ellipse([BASE_SIZE//2-r, BASE_SIZE//2-r, BASE_SIZE//2+r, BASE_SIZE//2+r], fill=255-alpha)
v = Image.eval(v, lambda p: 70 - p//4)
shadow = Image.new('RGBA', (BASE_SIZE, BASE_SIZE), (0, 55, 18, 0))
shadow.putalpha(v)
bg = Image.alpha_composite(bg, shadow)

# Add logo with soft lifted shadow.
logo_shadow = Image.new('RGBA', (BASE_SIZE, BASE_SIZE), (0,0,0,0))
sm = mask.filter(ImageFilter.GaussianBlur(16))
logo_shadow.putalpha(sm.point(lambda p: int(p * 0.22)))
bg = Image.alpha_composite(bg, logo_shadow)
logo = Image.new('RGBA', (BASE_SIZE, BASE_SIZE), (255,255,255,255))
logo.putalpha(mask)
icon = Image.alpha_composite(bg, logo)

# Rounded-square clipping, transparent corners for modern extension stores.
corner = Image.new('L', (BASE_SIZE, BASE_SIZE), 0)
cd = ImageDraw.Draw(corner)
cd.rounded_rectangle([0,0,BASE_SIZE,BASE_SIZE], radius=190, fill=255)
icon.putalpha(corner)

for size in [16, 32, 48, 128]:
    resized = icon.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(OUT_DIR, f'icon{size}.png'))
icon.save(os.path.join(OUT_DIR, 'icon1024-preview.png'))
print('generated icons/icon16.png icon32.png icon48.png icon128.png icons/icon1024-preview.png')
