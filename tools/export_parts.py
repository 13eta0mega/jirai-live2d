"""Export conservative reference crops from the supplied PNGs.

The crops are deliberately small and source-derived. They are not a finished
Cubism PSD; `manual_cleanup: true` in the manifest calls out the places where
an artist should paint underlay/mesh overscan before importing to Cubism.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "source"
PARTS = ROOT / "assets" / "parts"


def keep_dark(r: int, g: int, b: int, a: int) -> bool:
    return a > 10 and max(r, g, b) < 135


def keep_mouth(r: int, g: int, b: int, a: int) -> bool:
    if a <= 10:
        return False
    # Keep the pink/red mouth pixels and dark inner mouth pixels, not skin.
    return (r > g + 45 and r > b + 25 and g < 170 and b < 185) or max(r, g, b) < 115


def crop_masked(source: str, box: tuple[int, int, int, int], predicate: Callable[[int, int, int, int], bool]) -> Image.Image:
    image = Image.open(SRC / source).convert("RGBA")
    crop = image.crop(box)
    pixels = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b, a = pixels[x, y]
            if not predicate(r, g, b, a):
                pixels[x, y] = (0, 0, 0, 0)
    return crop


def crop_eye_component(source: str, box: tuple[int, int, int, int], seed: tuple[int, int], x_limits: tuple[int, int] | None = None) -> Image.Image:
    """Keep dark connected components around the supplied eye seed.

    Hair and eyebrow pixels are also dark, so a color threshold alone is not
    enough. Restricting to components touching a small seed window removes the
    long hair strokes that otherwise become black rectangles in the overlay.
    """
    image = Image.open(SRC / source).convert("RGBA")
    crop = image.crop(box)
    width, height = crop.size
    mask = [[False] * width for _ in range(height)]
    pixels = crop.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            global_x = x + box[0]
            mask[y][x] = keep_dark(r, g, b, a) and (x_limits is None or x_limits[0] <= global_x <= x_limits[1])
    components: list[list[tuple[int, int]]] = []
    visited = [[False] * width for _ in range(height)]
    for sy in range(height):
        for sx in range(width):
            if not mask[sy][sx] or visited[sy][sx]:
                continue
            stack = [(sx, sy)]
            visited[sy][sx] = True
            component: list[tuple[int, int]] = []
            while stack:
                x, y = stack.pop()
                component.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and not visited[ny][nx]:
                        visited[ny][nx] = True
                        stack.append((nx, ny))
            components.append(component)
    seed_x, seed_y = seed[0] - box[0], seed[1] - box[1]
    kept: set[tuple[int, int]] = set()
    for component in components:
        if any((x - seed_x) ** 2 + (y - seed_y) ** 2 <= 13 ** 2 for x, y in component):
            kept.update(component)
    for y in range(height):
        for x in range(width):
            if (x, y) not in kept:
                pixels[x, y] = (0, 0, 0, 0)
    return crop


def crop_mouth_component(source: str, box: tuple[int, int, int, int], seed: tuple[int, int]) -> Image.Image:
    image = Image.open(SRC / source).convert("RGBA")
    crop = image.crop(box)
    width, height = crop.size
    pixels = crop.load()
    mask = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            mask[y][x] = keep_mouth(r, g, b, a)
    visited = [[False] * width for _ in range(height)]
    components: list[list[tuple[int, int]]] = []
    for sy in range(height):
        for sx in range(width):
            if not mask[sy][sx] or visited[sy][sx]:
                continue
            stack = [(sx, sy)]
            visited[sy][sx] = True
            component: list[tuple[int, int]] = []
            while stack:
                x, y = stack.pop()
                component.append((x, y))
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny][nx] and not visited[ny][nx]:
                        visited[ny][nx] = True
                        stack.append((nx, ny))
            components.append(component)
    seed_x, seed_y = seed[0] - box[0], seed[1] - box[1]
    kept: set[tuple[int, int]] = set()
    for component in components:
        if any((x - seed_x) ** 2 + (y - seed_y) ** 2 <= 18 ** 2 for x, y in component):
            kept.update(component)
    for y in range(height):
        for x in range(width):
            if (x, y) not in kept:
                pixels[x, y] = (0, 0, 0, 0)
    return crop


PART_DEFS = [
    {"id": "eye_open_l", "source": "jirai_haku.png", "box": (70, 96, 104, 131), "out": "eyes/eye_open_l.png", "kind": "eye", "seed": (87, 112), "x_limits": (75, 100)},
    {"id": "eye_open_r", "source": "jirai_haku.png", "box": (122, 96, 154, 131), "out": "eyes/eye_open_r.png", "kind": "eye", "seed": (138, 112), "x_limits": (128, 151)},
    {"id": "eye_closed_l", "source": "jirai_stand.png", "box": (90, 103, 117, 123), "out": "eyes/eye_closed_l.png", "kind": "eye", "seed": (102, 111), "x_limits": (92, 115)},
    {"id": "eye_closed_r", "source": "jirai_stand.png", "box": (145, 103, 172, 123), "out": "eyes/eye_closed_r.png", "kind": "eye", "seed": (159, 111), "x_limits": (147, 170)},
    {"id": "eye_wink_r", "source": "jirai_peace.png", "box": (147, 103, 174, 123), "out": "eyes/eye_wink_r.png", "kind": "eye", "seed": (160, 111), "x_limits": (149, 172)},
    {"id": "eye_uruuru_l", "source": "jirai_uruuru.png", "box": (78, 92, 119, 137), "out": "eyes/eye_uruuru_l.png", "kind": "eye", "predicate": lambda r, g, b, a: a > 10 and ((r < 150 and g < 170 and b < 180) or (r > 210 and g > 210 and b > 210))},
    {"id": "eye_uruuru_r", "source": "jirai_uruuru.png", "box": (151, 92, 192, 137), "out": "eyes/eye_uruuru_r.png", "kind": "eye", "predicate": lambda r, g, b, a: a > 10 and ((r < 150 and g < 170 and b < 180) or (r > 210 and g > 210 and b > 210))},
    {"id": "mouth_closed", "source": "jirai_stand.png", "box": (112, 116, 145, 141), "out": "mouth/mouth_closed.png", "kind": "mouth", "seed": (128, 130)},
    {"id": "mouth_small", "source": "jirai_peace.png", "box": (110, 115, 142, 145), "out": "mouth/mouth_small.png", "kind": "mouth", "seed": (126, 131)},
    {"id": "mouth_a", "source": "jirai_jump.png", "box": (130, 144, 165, 179), "out": "mouth/mouth_a.png", "kind": "mouth", "seed": (147, 160)},
    {"id": "mouth_wide", "source": "jirai_jump.png", "box": (126, 140, 170, 180), "out": "mouth/mouth_wide.png", "kind": "mouth", "seed": (147, 160)},
    {"id": "mouth_uruuru", "source": "jirai_uruuru.png", "box": (118, 120, 149, 141), "out": "mouth/mouth_uruuru.png", "kind": "mouth", "seed": (133, 130)},
    {"id": "torso_stand", "source": "jirai_stand.png", "box": (73, 150, 190, 254), "out": "body/torso_stand.png", "kind": "body", "predicate": lambda r, g, b, a: a > 10},
    {"id": "arms_jump", "source": "jirai_jump.png", "box": (34, 128, 278, 235), "out": "arms/arms_jump.png", "kind": "arms", "predicate": lambda r, g, b, a: a > 10},
    {"id": "legs_stand", "source": "jirai_stand.png", "box": (84, 210, 176, 257), "out": "legs/legs_stand.png", "kind": "legs", "predicate": lambda r, g, b, a: a > 10},
    {"id": "rainbow_haku", "source": "jirai_haku.png", "box": (75, 120, 184, 226), "out": "effects/rainbow_haku.png", "kind": "effect", "predicate": lambda r, g, b, a: a > 10},
]


def main() -> None:
    manifest: list[dict] = []
    for definition in PART_DEFS:
        if definition.get("seed") and definition["kind"] == "eye":
            image = crop_eye_component(definition["source"], definition["box"], definition["seed"], definition.get("x_limits"))
        elif definition.get("seed") and definition["kind"] == "mouth":
            image = crop_mouth_component(definition["source"], definition["box"], definition["seed"])
        else:
            image = crop_masked(definition["source"], definition["box"], definition["predicate"])
        destination = PARTS / definition["out"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination)
        manifest.append({
            "id": definition["id"],
            "source": definition["source"],
            "source_box": list(definition["box"]),
            "output": definition["out"].replace("\\", "/"),
            "kind": definition["kind"],
            "manual_cleanup": definition["kind"] in {"eye", "mouth"},
            "underpaint_required": definition["kind"] in {"body", "arms", "legs"},
            "notes": "Source-derived crop; validate mask and paint overscan in Cubism before production export.",
        })
    output = PARTS / "parts_manifest.json"
    output.write_text(json.dumps({"parts": manifest}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"manifest": str(output), "count": len(manifest)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

