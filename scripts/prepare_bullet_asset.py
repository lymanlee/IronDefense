#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "output" / "imagegen" / "bullet-upgrade" / "bullet-energy-white-v1.png"
DEFAULT_OUTPUT = ROOT_DIR / "assets" / "textures" / "bullet_white.png"
OUTPUT_SIZE = (128, 128)


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
    cropped = crop_transparent(image, padding=8, alpha_threshold=10)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    scale = min(size[0] / cropped.width, size[1] / cropped.height)
    fitted_w = max(1, round(cropped.width * scale))
    fitted_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((fitted_w, fitted_h), Image.Resampling.LANCZOS)
    paste_x = (size[0] - fitted_w) // 2
    paste_y = (size[1] - fitted_h) // 2
    canvas.alpha_composite(resized, (paste_x, paste_y))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare bullet sprite asset for in-engine tinting.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    image = Image.open(input_path).convert("RGBA")
    fitted = fit_to_canvas(image, OUTPUT_SIZE)
    fitted.save(output_path)
    print(f"Prepared bullet asset at {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
