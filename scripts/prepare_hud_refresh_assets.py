#!/usr/bin/env python3
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from statistics import median

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class AssetSpec:
    source: Path
    output: Path
    target_size: tuple[int, int]
    tolerance: int
    sample_size: int
    left_cap_ratio: float
    right_cap_ratio: float
    padding: int


SPECS: tuple[AssetSpec, ...] = (
    AssetSpec(
        source=ROOT_DIR / "output/imagegen/hud-refresh/hud-top-strip-v2.png",
        output=ROOT_DIR / "assets/resources/ui/hud-panel-top-v2.png",
        target_size=(1200, 180),
        tolerance=16,
        sample_size=24,
        left_cap_ratio=0.22,
        right_cap_ratio=0.22,
        padding=8,
    ),
    AssetSpec(
        source=ROOT_DIR / "output/imagegen/hud-refresh/hud-bar-bg-v2.png",
        output=ROOT_DIR / "assets/resources/ui/common/hud-bar-frame-v2.png",
        target_size=(560, 50),
        tolerance=20,
        sample_size=24,
        left_cap_ratio=0.16,
        right_cap_ratio=0.16,
        padding=8,
    ),
)


def sample_background(image: Image.Image, sample_size: int) -> tuple[int, int, int]:
    width, height = image.size
    boxes = (
        (0, 0, sample_size, sample_size),
        (width - sample_size, 0, width, sample_size),
        (0, height - sample_size, sample_size, height),
        (width - sample_size, height - sample_size, width, height),
    )
    pixels: list[tuple[int, int, int, int]] = []
    for box in boxes:
        pixels.extend(image.crop(box).getdata())
    red_values = [pixel[0] for pixel in pixels]
    green_values = [pixel[1] for pixel in pixels]
    blue_values = [pixel[2] for pixel in pixels]
    return (
        int(median(red_values)),
        int(median(green_values)),
        int(median(blue_values)),
    )


def color_distance(pixel: tuple[int, int, int, int], background: tuple[int, int, int]) -> int:
    return sum(abs(channel - bg) for channel, bg in zip(pixel[:3], background))


def remove_edge_background(image: Image.Image, tolerance: int, sample_size: int) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    background = sample_background(rgba, sample_size)
    background_mask = Image.new("L", (width, height), 255)
    mask_pixels = background_mask.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index]:
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if color_distance(pixels[x, y], background) > tolerance:
            continue
        mask_pixels[x, y] = 0
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    rgba.putalpha(background_mask)
    return rgba


def crop_to_alpha_bounds(image: Image.Image, padding: int) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("Unable to find visible pixels after background removal.")
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def stretch_horizontal(image: Image.Image, target_size: tuple[int, int], left_cap_ratio: float, right_cap_ratio: float) -> Image.Image:
    target_width, target_height = target_size
    scaled_width = max(target_width, round(image.width * target_height / image.height))
    scaled = image.resize((scaled_width, target_height), Image.Resampling.LANCZOS)

    left_cap = max(1, round(scaled.width * left_cap_ratio))
    right_cap = max(1, round(scaled.width * right_cap_ratio))
    max_cap = max(1, target_width // 3)
    left_cap = min(left_cap, max_cap)
    right_cap = min(right_cap, max_cap)

    center_source_width = scaled.width - left_cap - right_cap
    center_target_width = target_width - left_cap - right_cap
    if center_source_width <= 0 or center_target_width <= 0:
        raise RuntimeError("Invalid cap ratios for target size.")

    result = Image.new("RGBA", target_size, (0, 0, 0, 0))
    left_slice = scaled.crop((0, 0, left_cap, target_height))
    center_slice = scaled.crop((left_cap, 0, scaled.width - right_cap, target_height))
    right_slice = scaled.crop((scaled.width - right_cap, 0, scaled.width, target_height))

    result.alpha_composite(left_slice, (0, 0))
    stretched_center = center_slice.resize((center_target_width, target_height), Image.Resampling.LANCZOS)
    result.alpha_composite(stretched_center, (left_cap, 0))
    result.alpha_composite(right_slice, (target_width - right_cap, 0))
    return result


def build_asset(spec: AssetSpec) -> None:
    if not spec.source.exists():
        raise FileNotFoundError(f"Missing source image: {spec.source}")

    with Image.open(spec.source) as image:
        isolated = remove_edge_background(image, tolerance=spec.tolerance, sample_size=spec.sample_size)
        cropped = crop_to_alpha_bounds(isolated, padding=spec.padding)
        stretched = stretch_horizontal(
            cropped,
            target_size=spec.target_size,
            left_cap_ratio=spec.left_cap_ratio,
            right_cap_ratio=spec.right_cap_ratio,
        )
        spec.output.parent.mkdir(parents=True, exist_ok=True)
        stretched.save(spec.output, format="PNG", optimize=True, compress_level=9)
        print(f"wrote {spec.output} ({stretched.width}x{stretched.height})")


def main() -> int:
    for spec in SPECS:
        build_asset(spec)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
