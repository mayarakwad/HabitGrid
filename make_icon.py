"""Draws assets/icon.png (macOS) and assets/icon.ico (Windows). Run after changing the design:
    .venv\\Scripts\\python make_icon.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).parent / "assets"
BLUE = (35, 131, 226, 255)


def draw(size=1024):
    s = size / 512  # the design is laid out on a 512 grid
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=112 * s, fill=BLUE)
    # Faint rows of days above and below the check, like the tracker grid.
    faint = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fd = ImageDraw.Draw(faint)
    for y in (88, 328):
        for x in (88, 208, 328):
            fd.rounded_rectangle((x * s, y * s, (x + 96) * s, (y + 96) * s), radius=22 * s, fill=(255, 255, 255, 46))
    img = Image.alpha_composite(img, faint)
    d = ImageDraw.Draw(img)
    points = [(150 * s, 262 * s), (222 * s, 334 * s), (364 * s, 184 * s)]
    width = round(54 * s)
    d.line(points, fill="white", width=width, joint="curve")
    for x, y in (points[0], points[-1]):  # round line caps
        d.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill="white")
    return img


def main():
    ASSETS.mkdir(exist_ok=True)
    big = draw()
    big.resize((512, 512), Image.LANCZOS).save(ASSETS / "icon.png")
    big.save(ASSETS / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("Wrote", ASSETS / "icon.png", "and", ASSETS / "icon.ico")


if __name__ == "__main__":
    main()
