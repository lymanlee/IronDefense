#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT_DIR / "output" / "imagegen" / "tank-upgrade"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "assets" / "resources" / "car_fx"
CAR_FRAMES_DIR = ROOT_DIR / "assets" / "resources" / "car_frames"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def crop_transparent(image: Image.Image, padding: int = 0, alpha_threshold: int = 1) -> Image.Image:
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


def split_grid(image: Image.Image, columns: int, rows: int) -> list[Image.Image]:
    cell_w = image.width // columns
    cell_h = image.height // rows
    cells: list[Image.Image] = []
    for row in range(rows):
        for col in range(columns):
            left = col * cell_w
            top = row * cell_h
            cells.append(image.crop((left, top, left + cell_w, top + cell_h)))
    return cells


def fit_to_canvas(image: Image.Image, size: tuple[int, int], alpha_threshold: int = 10, padding: int = 4) -> Image.Image:
    cropped = crop_transparent(image, padding=padding, alpha_threshold=alpha_threshold)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    scale = min(size[0] / cropped.width, size[1] / cropped.height)
    fitted_w = max(1, round(cropped.width * scale))
    fitted_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((fitted_w, fitted_h), Image.Resampling.LANCZOS)
    paste_x = (size[0] - fitted_w) // 2
    paste_y = (size[1] - fitted_h) // 2
    canvas.alpha_composite(resized, (paste_x, paste_y))
    return canvas


def save_resized(image: Image.Image, out_path: Path, size: tuple[int, int], alpha_threshold: int = 10) -> None:
    ensure_dir(out_path.parent)
    fitted = fit_to_canvas(image, size, alpha_threshold=alpha_threshold, padding=6)
    fitted.save(out_path)


def write_car_frames(body_cells: Iterable[Image.Image]) -> None:
    ensure_dir(CAR_FRAMES_DIR)
    source_cells = list(body_cells)
    frame_size = (144, 120)
    mapping = [0, 1, 0, 1, 0, 1, 0, 1]
    for frame_index, cell_index in enumerate(mapping):
        out_path = CAR_FRAMES_DIR / f"car_{frame_index}.png"
        save_resized(source_cells[cell_index], out_path, frame_size, alpha_threshold=10)


def write_effect_set(
    cells: Iterable[Image.Image],
    names: list[str],
    size: tuple[int, int],
    subdir: str,
    output_dir: Path,
) -> None:
    target_dir = output_dir / subdir
    ensure_dir(target_dir)
    for image, name in zip(cells, names):
        save_resized(image, target_dir / name, size, alpha_threshold=10)


def main() -> int:
    parser = argparse.ArgumentParser(description="Split and resize generated tank assets into project resource folders.")
    parser.add_argument("--input-dir", default=str(DEFAULT_INPUT_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)

    body_sheet = Image.open(input_dir / "tank-body-sheet-v1.png").convert("RGBA")
    muzzle_sheet = Image.open(input_dir / "tank-muzzle-flash-sheet-v1.png").convert("RGBA")
    thruster_sheet = Image.open(input_dir / "tank-thruster-sheet-v1.png").convert("RGBA")
    shadow_sheet = Image.open(input_dir / "tank-shadow-sheet-v1.png").convert("RGBA")

    body_cells = split_grid(body_sheet, columns=2, rows=2)
    write_car_frames(body_cells)

    muzzle_cells = split_grid(muzzle_sheet, columns=2, rows=3)
    write_effect_set(
        muzzle_cells,
        names=[
            "muzzle_flash_0.png",
            "muzzle_flash_1.png",
            "muzzle_flash_2.png",
            "muzzle_flash_3.png",
            "muzzle_flash_4.png",
            "muzzle_flash_5.png",
        ],
        size=(140, 140),
        subdir="muzzle",
        output_dir=output_dir,
    )

    thruster_cells = split_grid(thruster_sheet, columns=2, rows=2)
    write_effect_set(
        thruster_cells,
        names=[
            "thruster_0.png",
            "thruster_1.png",
            "thruster_2.png",
            "thruster_3.png",
        ],
        size=(92, 110),
        subdir="thruster",
        output_dir=output_dir,
    )

    shadow_cells = split_grid(shadow_sheet, columns=2, rows=2)
    write_effect_set(
        shadow_cells,
        names=[
            "shadow_0.png",
            "shadow_1.png",
            "shadow_2.png",
            "shadow_3.png",
        ],
        size=(132, 84),
        subdir="shadow",
        output_dir=output_dir,
    )

    print(f"Prepared tank assets into {CAR_FRAMES_DIR} and {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
