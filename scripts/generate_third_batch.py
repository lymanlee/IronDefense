#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Any

import requests


ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env.local"
DEFAULT_INPUT_FILE = ROOT_DIR / "tmp/imagegen/third-batch-prompts.jsonl"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "output/imagegen/third-batch"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def iter_jobs(path: Path) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for line_no, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            jobs.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSONL at line {line_no}: {exc}") from exc
    if not jobs:
        raise RuntimeError(f"No jobs found in {path}")
    return jobs


def decode_item_bytes(item: dict[str, Any]) -> bytes:
    b64_value = item.get("b64_json") or item.get("image_base64") or item.get("base64")
    if b64_value:
        return base64.b64decode(b64_value)

    url_value = item.get("url") or item.get("image_url")
    if url_value:
        response = requests.get(url_value, timeout=120)
        response.raise_for_status()
        return response.content

    raise RuntimeError(f"Image item has neither base64 nor url fields: {sorted(item.keys())}")


def post_image_generation(
    *,
    api_key: str,
    base_url: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    response = requests.post(
        f"{base_url.rstrip('/')}/images/generations",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=300,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError(f"Unexpected image generation response type: {type(data).__name__}")
    return data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate image batches via 12API-compatible GPT Image endpoint.")
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT_FILE),
        help="Path to JSONL prompt file. Defaults to third-batch prompts.",
    )
    parser.add_argument(
        "--out-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for generated images. Defaults to output/imagegen/third-batch.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(ENV_FILE)
    api_key = require_env("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://cdn.12ai.org/v1").strip()

    input_file = Path(args.input)
    output_dir = Path(args.out_dir)
    jobs = iter_jobs(input_file)
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, job in enumerate(jobs, start=1):
        out_name = job["out"]
        out_path = output_dir / out_name
        payload = {
            "model": job.get("model", "gpt-image-2"),
            "prompt": job["prompt"],
            "size": job.get("size", "1536x1024"),
            "quality": job.get("quality", "high"),
            "background": job.get("background", "transparent"),
            "output_format": job.get("output_format", "png"),
            "response_format": "b64_json",
            "n": job.get("n", 1),
        }
        print(f"[{index}/{len(jobs)}] generating {out_name} ...", flush=True)
        result = post_image_generation(api_key=api_key, base_url=base_url, payload=payload)
        data_items = result.get("data")
        if not data_items:
            raise RuntimeError(f"No image data returned for {out_name}")
        first_item = data_items[0]
        if not isinstance(first_item, dict):
            raise RuntimeError(f"Unexpected image item type for {out_name}: {type(first_item).__name__}")
        image_bytes = decode_item_bytes(first_item)
        out_path.write_bytes(image_bytes)
        print(f"[{index}/{len(jobs)}] wrote {out_path}", flush=True)

    print(f"All batch images generated successfully from {input_file}.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
