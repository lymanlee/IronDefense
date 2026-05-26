#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class CropSpec:
    name: str
    row: int
    col: int


CHEST_SHEET = ROOT / "output/imagegen/chest-map-refresh/supply-chest-sheet-v3.png"
BG_SOURCE = ROOT / "output/imagegen/chest-map-refresh/battle-bg-road-supply-lane-v3.png"
DIVIDER_SOURCE = ROOT / "output/imagegen/chest-map-refresh/battle-divider-lane-v2.png"

CHEST_OUT_DIR = ROOT / "assets/resources/ui/game/chests_v2"
BG_OUTPUT = ROOT / "assets/resources/ui/game/battle-bg-road-supply-lane-v3.png"
DIVIDER_OUTPUT = ROOT / "assets/resources/ui/game/battle-divider-lane-v2.png"

CHEST_TARGET_SIZE = (320, 220)
BG_TARGET_SIZE = (720, 1280)
DIVIDER_TARGET_SIZE = (180, 1280)

CHEST_SPECS = (
    CropSpec("chest_firepower_v2", 0, 0),
    CropSpec("chest_control_v2", 0, 1),
    CropSpec("chest_elite_v2", 1, 0),
    CropSpec("chest_rare_v2", 1, 1),
)


def crop_alpha(image: Image.Image, padding: int = 8) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return rgba
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(rgba.width, bbox[2] + padding)
    bottom = min(rgba.height, bbox[3] + padding)
    return rgba.crop((left, top, right, bottom))


def fit_into(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    target_w, target_h = target_size
    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    scale = min(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = (target_w - resized.width) // 2
    y = (target_h - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True, compress_level=9)
    print(f"wrote {path}")


def prepare_chests() -> None:
    with Image.open(CHEST_SHEET) as image:
        cell_w = image.width // 2
        cell_h = image.height // 2
        for spec in CHEST_SPECS:
            left = spec.col * cell_w
            top = spec.row * cell_h
            tile = image.crop((left, top, left + cell_w, top + cell_h))
            tile = crop_alpha(tile, padding=10)
            tile = fit_into(tile, CHEST_TARGET_SIZE)
            save_png(tile, CHEST_OUT_DIR / f"{spec.name}.png")


def prepare_battle_bg() -> None:
    with Image.open(BG_SOURCE) as image:
        rgba = image.convert("RGBA")
        target_aspect = BG_TARGET_SIZE[0] / BG_TARGET_SIZE[1]
        crop_w = min(rgba.width, round(rgba.height * target_aspect))
        # Keep the left-side supply lane intact and crop from the right side first.
        cropped = rgba.crop((0, 0, crop_w, rgba.height))
        resized = cropped.resize(BG_TARGET_SIZE, Image.Resampling.LANCZOS)
        save_png(resized, BG_OUTPUT)


def prepare_divider() -> None:
    with Image.open(DIVIDER_SOURCE) as image:
        divider = crop_alpha(image, padding=0)
        divider = fit_into(divider, DIVIDER_TARGET_SIZE)
        save_png(divider, DIVIDER_OUTPUT)


def main() -> int:
    prepare_chests()
    prepare_battle_bg()
    prepare_divider()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
