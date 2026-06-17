from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/bundles/battle/textures/bullet_white.png"
PREVIEW = ROOT / "output/imagegen/bullet-upgrade/bullet-energy-white-v1-strong.png"


def strengthen_bullet() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    rgb = image.convert("RGB")
    alpha = image.getchannel("A")

    # Expand the opaque area slightly so the projectile reads as a solid shape
    # instead of a thin silver sliver against the road texture.
    expanded_alpha = alpha.filter(ImageFilter.MaxFilter(5))
    softened_alpha = expanded_alpha.filter(ImageFilter.GaussianBlur(0.7))
    alpha = ImageChops.lighter(alpha, softened_alpha)
    alpha = alpha.point(lambda value: 0 if value < 8 else min(255, int(value * 1.18 + 16)))

    # Push the grayscale body toward brighter whites so tint colors land with
    # more visual weight in-game.
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.15)
    rgb = rgb.point(lambda value: min(255, int(170 + value * 0.42)))

    result = Image.merge("RGBA", (*rgb.split(), alpha))
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    result.save(SOURCE)
    result.save(PREVIEW)


if __name__ == "__main__":
    strengthen_bullet()
