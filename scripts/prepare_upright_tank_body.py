#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "output" / "imagegen" / "tank-upright" / "tank-body-upright-sheet-v1.png"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "assets" / "resources" / "car_frames_v3"
FRAME_SIZE = (144, 120)


def crop_transparent(image: Image.Image, padding: int = 0, alpha_threshold: int = 10) -> Image.Image:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda p: 255 if p >= alpha_threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return image.copy()
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def fit_to_canvas(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    cropped = crop_transparent(image, padding=6, alpha_threshold=10)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    scale = min(size[0] / cropped.width, size[1] / cropped.height)
    fitted_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(fitted_size, Image.Resampling.LANCZOS)
    paste_x = (size[0] - fitted_size[0]) // 2
    paste_y = (size[1] - fitted_size[1]) // 2
    canvas.alpha_composite(resized, (paste_x, paste_y))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare 2-frame upright tank body sprites.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sheet = Image.open(input_path).convert("RGBA")
    cell_w = sheet.width // 2
    cell_h = sheet.height // 2

    idle_cells = [
        sheet.crop((0, 0, cell_w, cell_h)),
        sheet.crop((cell_w, 0, cell_w * 2, cell_h)),
    ]

    for index, cell in enumerate(idle_cells):
        fitted = fit_to_canvas(cell, FRAME_SIZE)
        fitted.save(output_dir / f"car_{index}.png")

    print(f"Prepared upright tank body into {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
