#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


def crop_grid(src: Path, out_dir: Path, cols: int, rows: int, names: list[str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        w, h = im.size
        cell_w = w / cols
        cell_h = h / rows
        idx = 0
        for row in range(rows):
            for col in range(cols):
                if idx >= len(names):
                    return
                left = round(col * cell_w)
                top = round(row * cell_h)
                right = round((col + 1) * cell_w)
                bottom = round((row + 1) * cell_h)
                tile = im.crop((left, top, right, bottom))
                tile.save(out_dir / f"{names[idx]}.png", format="PNG", optimize=True, compress_level=9)
                idx += 1


def main() -> int:
    supply_sheet = ROOT / "output/imagegen/fourth-batch/ui-icons-supply-sheet-v2.png"
    reward_sheet = ROOT / "output/imagegen/fourth-batch/ui-icons-drop-sheet-v2.png"

    supply_names = [
        "icon_supply_damage",
        "icon_supply_fire_rate",
        "icon_supply_multishot",
        "icon_supply_spread_count",
        "icon_supply_knockback",
        "icon_supply_slow",
        "icon_supply_explode_radius",
        "icon_supply_pierce_up",
        "icon_supply_chain_up",
        "icon_supply_chain_range",
    ]
    reward_names = [
        "icon_coin",
        "icon_parts",
        "icon_rare_chip",
        "icon_supply_token",
        "icon_rare_chest_token",
        "icon_energy_core",
    ]

    supply_out = ROOT / "assets/resources/ui/common/icons_supply_v2"
    reward_out = ROOT / "assets/resources/ui/common/icons_reward_v2"

    crop_grid(supply_sheet, supply_out, 5, 2, supply_names)
    crop_grid(reward_sheet, reward_out, 3, 2, reward_names)

    # Duplicate the fire rate icon for the stronger variant so it has a file to bind to.
    fire_rate = supply_out / "icon_supply_fire_rate.png"
    if fire_rate.exists():
        (supply_out / "icon_supply_fire_rate_big.png").write_bytes(fire_rate.read_bytes())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
