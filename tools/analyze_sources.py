from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "source"
ALIGNED_DIR = ROOT / "assets" / "aligned"
QA_DIR = ROOT / "qa"

NAMES = [
    "jirai_stand.png",
    "jirai_jump.png",
    "jirai_peace.png",
    "jirai_uruuru.png",
    "jirai_gorogoro.png",
    "jirai_haku.png",
]


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.getbbox()


def alpha_stats(image: Image.Image) -> dict[str, float | int]:
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    pixels = image.width * image.height
    nonzero = pixels - histogram[0]
    opaque = histogram[255]
    weighted = sum(index * count for index, count in enumerate(histogram))
    return {
        "nonzero_pixels": nonzero,
        "opaque_pixels": opaque,
        "coverage": round(nonzero / pixels, 6) if pixels else 0,
        "mean_alpha": round(weighted / pixels / 255, 6) if pixels else 0,
    }


def center_of_alpha(image: Image.Image) -> tuple[float, float] | None:
    alpha = image.getchannel("A")
    total = sum(alpha.getdata())
    if total == 0:
        return None
    xs = 0.0
    ys = 0.0
    for y in range(image.height):
        for x in range(image.width):
            weight = alpha.getpixel((x, y))
            xs += x * weight
            ys += y * weight
    return (round(xs / total, 2), round(ys / total, 2))


def normalized_point(point: tuple[float, float], image: Image.Image) -> tuple[float, float]:
    return (round(point[0] / image.width, 4), round(point[1] / image.height, 4))


def add_label(canvas: Image.Image, text: str, x: int, y: int) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((x, y, x + 290, y + 26), fill=(20, 18, 24, 220))
    draw.text((x + 8, y + 5), text, fill=(255, 240, 248, 255))


def make_reference_sheet(records: Iterable[dict]) -> Path:
    ALIGNED_DIR.mkdir(parents=True, exist_ok=True)
    cols = 3
    cell_w, cell_h = 320, 340
    rows = 2
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (36, 31, 42, 255))
    for index, record in enumerate(records):
        image = Image.open(SOURCE_DIR / record["file"]).convert("RGBA")
        bbox = record["alpha_bbox"]
        if bbox:
            cropped = image.crop(tuple(bbox))
        else:
            cropped = image
        scale = min((cell_w - 34) / cropped.width, (cell_h - 54) / cropped.height)
        size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
        rendered = cropped.resize(size, Image.Resampling.LANCZOS)
        left = (cell_w - rendered.width) // 2
        top = 34 + (cell_h - 54 - rendered.height) // 2
        x = (index % cols) * cell_w
        y = (index // cols) * cell_h
        checker = Image.new("RGBA", (cell_w - 20, cell_h - 44), (255, 255, 255, 12))
        sheet.alpha_composite(checker, (x + 10, y + 32))
        sheet.alpha_composite(rendered, (x + left, y + top))
        add_label(sheet, record["file"], x + 15, y + 5)
    output = ALIGNED_DIR / "reference_sheet.png"
    sheet.save(output)
    # A second sheet uses the stand alpha-bounds as a shared working frame.
    # It is intentionally a comparison aid, never a replacement for the source PNGs.
    stand = next(record for record in records if record["file"] == "jirai_stand.png")
    target_h = stand["alpha_bbox_size"]["height"] if stand["alpha_bbox_size"] else 241
    aligned_sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (36, 31, 42, 255))
    for index, record in enumerate(records):
        image = Image.open(SOURCE_DIR / record["file"]).convert("RGBA")
        bbox = record["alpha_bbox"]
        cropped = image.crop(tuple(bbox)) if bbox else image
        scale = target_h / cropped.height
        size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
        rendered = cropped.resize(size, Image.Resampling.LANCZOS)
        x = (index % cols) * cell_w
        y = (index // cols) * cell_h
        left = x + (cell_w - rendered.width) // 2
        top = y + 48 + (cell_h - 64 - rendered.height) // 2
        aligned_sheet.alpha_composite(Image.new("RGBA", (cell_w - 20, cell_h - 44), (255, 255, 255, 12)), (x + 10, y + 32))
        aligned_sheet.alpha_composite(rendered, (left, top))
        # Shared guides: centerline, baseline and target alpha-bounds box.
        draw = ImageDraw.Draw(aligned_sheet)
        draw.line((x + cell_w // 2, y + 32, x + cell_w // 2, y + cell_h - 10), fill=(255, 118, 190, 110), width=1)
        draw.line((x + 12, y + 48 + target_h, x + cell_w - 12, y + 48 + target_h), fill=(118, 218, 255, 110), width=1)
        add_label(aligned_sheet, record["file"], x + 15, y + 5)
    aligned_output = ALIGNED_DIR / "aligned_comparison.png"
    aligned_sheet.save(aligned_output)
    return output


def main() -> None:
    records: list[dict] = []
    for name in NAMES:
        path = SOURCE_DIR / name
        if not path.exists():
            raise FileNotFoundError(path)
        image = Image.open(path).convert("RGBA")
        bbox = alpha_bbox(image)
        center = center_of_alpha(image)
        record = {
            "file": name,
            "size": {"width": image.width, "height": image.height},
            "mode": image.mode,
            "alpha_bbox": list(bbox) if bbox else None,
            "alpha_bbox_size": {
                "width": bbox[2] - bbox[0],
                "height": bbox[3] - bbox[1],
            }
            if bbox
            else None,
            "alpha_center": list(center) if center else None,
            "alpha_center_normalized": list(normalized_point(center, image)) if center else None,
            "alpha": alpha_stats(image),
            "source_sha256": __import__("hashlib").sha256(path.read_bytes()).hexdigest(),
        }
        records.append(record)
    out = QA_DIR / "source_analysis.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"sources": records}, indent=2, ensure_ascii=False), encoding="utf-8")
    sheet = make_reference_sheet(records)
    print(json.dumps({"analysis": str(out), "reference_sheet": str(sheet), "aligned_comparison": str(ALIGNED_DIR / 'aligned_comparison.png')}, ensure_ascii=False))


if __name__ == "__main__":
    main()

