from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source"
ANALYSIS = ROOT / "qa" / "source_analysis.json"
EXPECTED = [
    "jirai_stand.png", "jirai_jump.png", "jirai_peace.png", "jirai_uruuru.png",
    "jirai_gorogoro.png", "jirai_haku.png",
]


def main() -> None:
    analysis = json.loads(ANALYSIS.read_text(encoding="utf-8"))
    records = {record["file"]: record for record in analysis["sources"]}
    checks: list[dict] = []
    for name in EXPECTED:
        path = SOURCE / name
        ok = path.exists()
        detail = "missing"
        if ok:
            image = Image.open(path).convert("RGBA")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            ok = digest == records[name]["source_sha256"] and image.mode == "RGBA" and image.getchannel("A").getbbox() is not None
            detail = f"{image.width}x{image.height} RGBA sha256={'ok' if digest == records[name]['source_sha256'] else 'mismatch'}"
        checks.append({"file": name, "ok": ok, "detail": detail})
    forbidden = [str(path.relative_to(ROOT)) for path in ROOT.rglob("*.svg")]
    fake_cubism = [str(path.relative_to(ROOT)) for path in ROOT.rglob("*.cmo3")] + [str(path.relative_to(ROOT)) for path in ROOT.rglob("*.moc3")] + [str(path.relative_to(ROOT)) for path in ROOT.rglob("*.model3.json")]
    result = {
        "ok": all(item["ok"] for item in checks) and not forbidden and not fake_cubism,
        "source_checks": checks,
        "forbidden_svg_files": forbidden,
        "unverified_cubism_files": fake_cubism,
        "note": "Cubism files are intentionally absent until manual Cubism Editor mesh/underpaint QA is complete.",
    }
    output = ROOT / "qa" / "validation_report.json"
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()

