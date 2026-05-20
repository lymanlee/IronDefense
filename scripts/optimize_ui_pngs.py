#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Optional

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


TARGETS: dict[str, tuple[int, int] | None] = {
    "assets/resources/ui/common/icon-hp-v1.png": (256, 256),
    "assets/resources/ui/common/icon-wave-v1.png": (256, 256),
    "assets/resources/ui/common/icon-weapon-v1.png": (256, 256),
    "assets/resources/ui/common/icon-stage-v1.png": (256, 256),
    "assets/resources/ui/common/icon-warning-v1.png": (256, 256),
    "assets/resources/ui/common/btn-arrow-v1.png": (256, 256),
    "assets/resources/ui/common/btn-primary-v1.png": (768, 256),
    "assets/resources/ui/common/btn-secondary-v1.png": (640, 192),
    "assets/resources/ui/common/hud-bar-frame-v1.png": (512, 64),
    "assets/resources/ui/common/hud-bar-fill-hp-v1.png": (512, 64),
    "assets/resources/ui/common/hud-bar-fill-progress-v1.png": (512, 64),
    "assets/resources/ui/common/stage-card-v1.png": (1024, 320),
    "assets/resources/ui/hud-panel-top-v1.png": (1024, 256),
    "assets/resources/ui/start/start-bg-wasteland-v1.png": None,
    "assets/resources/ui/game/battle-bg-road-v1.png": None,
    "output/imagegen/third-batch/ui-icons-supply-sheet-v1.png": (1024, 768),
    "output/imagegen/third-batch/ui-icons-drop-sheet-v1.png": (1024, 768),
    "output/imagegen/third-batch/ui-fx-sheet-v1.png": (1024, 768),
    "output/imagegen/third-batch/supply-chest-sheet-v1.png": (1280, 768),
    "output/imagegen/fourth-batch/ui-icons-supply-sheet-v2.png": (1024, 768),
    "output/imagegen/fourth-batch/ui-icons-drop-sheet-v2.png": (1024, 768),
}


def file_size_kb(path: Path) -> float:
    return path.stat().st_size / 1024


def optimize_png(path: Path, target_size: Optional[tuple[int, int]]) -> tuple[tuple[int, int], tuple[int, int], float, float]:
    before_kb = file_size_kb(path)
    with Image.open(path) as image:
      image = image.convert("RGBA")
      old_size = image.size
      if target_size and image.size != target_size:
          image = image.resize(target_size, Image.Resampling.LANCZOS)
      new_size = image.size
      image.save(path, format="PNG", optimize=True, compress_level=9)
    after_kb = file_size_kb(path)
    return old_size, new_size, before_kb, after_kb


def main() -> int:
    for rel_path, target_size in TARGETS.items():
        path = ROOT / rel_path
        if not path.exists():
            print(f"skip missing: {rel_path}")
            continue
        old_size, new_size, before_kb, after_kb = optimize_png(path, target_size)
        print(
            f"{rel_path}: {old_size[0]}x{old_size[1]} -> {new_size[0]}x{new_size[1]}, "
            f"{before_kb:.1f}KB -> {after_kb:.1f}KB"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
