from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


SOURCE = Path("/Users/lymanli/Downloads/6961465de0d388fa3b0ed3b5089975fc.jpg")
OUTPUT = Path("/Users/lymanli/Cocos/cocos-first-game/FirstGame/output/video-icon-transparent-256.png")
WHITE_THRESHOLD = 235
ALPHA_CUTOFF = 10
SIZE = 256


def connected_components(mask: np.ndarray) -> list[tuple[bool, int, np.ndarray]]:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[bool, int, np.ndarray]] = []

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue

            queue = deque([(y, x)])
            visited[y, x] = True
            coords: list[tuple[int, int]] = []
            touches_border = False

            while queue:
                cy, cx = queue.popleft()
                coords.append((cy, cx))
                if cy == 0 or cx == 0 or cy == height - 1 or cx == width - 1:
                    touches_border = True

                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((ny, nx))

            component_mask = np.zeros_like(mask, dtype=bool)
            ys, xs = zip(*coords)
            component_mask[ys, xs] = True
            components.append((touches_border, len(coords), component_mask))

    return components


def main() -> None:
    image = Image.open(SOURCE).convert("L")
    gray = np.array(image, dtype=np.uint8)

    white_mask = gray >= WHITE_THRESHOLD
    components = connected_components(white_mask)
    enclosed_components = [component for component in components if not component[0]]
    keep_white = max(enclosed_components, key=lambda item: item[1])[2]

    alpha_black = 255 - gray.astype(np.uint16)
    alpha_black[alpha_black < ALPHA_CUTOFF] = 0
    alpha_black = alpha_black.astype(np.uint8)

    rgba = np.zeros((gray.shape[0], gray.shape[1], 4), dtype=np.uint8)
    rgba[..., 3] = alpha_black
    rgba[keep_white, :3] = 255
    rgba[keep_white, 3] = 255

    output = Image.fromarray(rgba, mode="RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output.save(OUTPUT)


if __name__ == "__main__":
    main()
