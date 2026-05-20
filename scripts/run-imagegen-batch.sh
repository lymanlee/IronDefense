#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"
IMAGE_GEN="${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/image_gen.py"
INPUT_FILE="${1:-${ROOT_DIR}/tmp/imagegen/third-batch-prompts.jsonl}"
OUTPUT_DIR="${2:-${ROOT_DIR}/output/imagegen/third-batch}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

: "${OPENAI_API_KEY:?OPENAI_API_KEY is missing. Fill .env.local first.}"
: "${OPENAI_BASE_URL:=https://cdn.12ai.org/v1}"

mkdir -p "${OUTPUT_DIR}"

python3 "${IMAGE_GEN}" generate-batch \
  --input "${INPUT_FILE}" \
  --out-dir "${OUTPUT_DIR}" \
  --concurrency "${IMAGEGEN_CONCURRENCY:-2}" \
  --max-attempts "${IMAGEGEN_MAX_ATTEMPTS:-3}" \
  --force
