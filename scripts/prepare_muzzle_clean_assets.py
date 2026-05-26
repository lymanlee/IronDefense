#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "output" / "imagegen" / "tank-muzzle-clean" / "tank-muzzle-clean-sheet-v1.png"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "assets" / "resources" / "car_fx" / "muzzle_v2"
OUTPUT_SIZE = (116, 116)
ALPHA_THRESHOLD = 28
MIN_COMPONENT_PIXELS = 5000


def fit_to_canvas(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    scale = min(size[0] / image.width, size[1] / image.height)
    fitted_w = max(1, round(image.width * scale))
    fitted_h = max(1, round(image.height * scale))
    resized = image.resize((fitted_w, fitted_h), Image.Resampling.LANCZOS)
    paste_x = (size[0] - fitted_w) // 2
    paste_y = (size[1] - fitted_h) // 2
    canvas.alpha_composite(resized, (paste_x, paste_y))
    return canvas


def extract_components(image: Image.Image) -> list[tuple[int, int, int, int]]:
    alpha = image.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[tuple[int, int, int, int]] = []

    def index(x: int, y: int) -> int:
        return y * width + x

    for y in range(height):
        for x in range(width):
            idx = index(x, y)
            if visited[idx] or pixels[x, y] < ALPHA_THRESHOLD:
                visited[idx] = 1
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[idx] = 1
            count = 0
            min_x = max_x = x
            min_y = max_y = y

            while queue:
                cx, cy = queue.popleft()
                count += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)

                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nidx = index(nx, ny)
                    if visited[nidx]:
                        continue
                    visited[nidx] = 1
                    if pixels[nx, ny] >= ALPHA_THRESHOLD:
                        queue.append((nx, ny))

            if count >= MIN_COMPONENT_PIXELS:
                padding = 16
                components.append((
                    max(0, min_x - padding),
                    max(0, min_y - padding),
                    min(width, max_x + padding + 1),
                    min(height, max_y + padding + 1),
                ))

    components.sort(key=lambda box: (box[1], box[0]))
    return components


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract independent muzzle sprites from tank-muzzle-clean sheet.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sheet = Image.open(input_path).convert("RGBA")
    boxes = extract_components(sheet)
    if not boxes:
        raise RuntimeError("No muzzle components found")

    filtered_boxes = [box for box in boxes if (box[2] - box[0]) >= 120 and (box[3] - box[1]) >= 160]
    for i, box in enumerate(filtered_boxes):
        cropped = sheet.crop(box)
        fitted = fit_to_canvas(cropped, OUTPUT_SIZE)
        fitted.save(output_dir / f"muzzle_flash_{i}.png")

    print(f"Extracted {len(filtered_boxes)} muzzle sprites into {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
