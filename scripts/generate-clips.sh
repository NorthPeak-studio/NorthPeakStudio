#!/usr/bin/env bash
# Higgsfield clip generator for NorthPeakStudio.
# Workflow: upload image to catbox -> submit DoP request -> poll until done -> download MP4.
#
# Usage: scripts/generate-clips.sh                  # generates all configured clips (skips ones already present)
#        scripts/generate-clips.sh hero             # generates only the named clip
#
# Reads HIGGSFIELD_API_KEY/SECRET from .env at repo root.

set -euo pipefail
export PATH="/usr/bin:/usr/local/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/site/assets"
VIDEO_DIR="$ASSETS"
TMP="$ROOT/.tmp"
mkdir -p "$TMP" "$VIDEO_DIR"

# Load env
if [ -f "$ROOT/.env" ]; then
  set -a; . "$ROOT/.env"; set +a
fi
: "${HIGGSFIELD_API_KEY:?Missing HIGGSFIELD_API_KEY}"
: "${HIGGSFIELD_API_SECRET:?Missing HIGGSFIELD_API_SECRET}"

AUTH="Authorization: Key ${HIGGSFIELD_API_KEY}:${HIGGSFIELD_API_SECRET}"
BASE="https://platform.higgsfield.ai"
MODEL="higgsfield-ai/dop/standard"

resize_for_upload() {
  # Higgsfield doesn't need 5MB inputs. Shrink to ~1280px wide JPEG q85.
  local src="$1"
  local out="$TMP/$(basename "${src%.*}").jpg"
  sips -Z 1280 "$src" --out "$out" --setProperty format jpeg --setProperty formatOptions 85 >/dev/null
  printf "%s" "$out"
}

upload_to_litterbox() {
  # Anonymous, 1h-ttl host. Free, large file friendly.
  local file="$1"
  local attempt
  for attempt in 1 2 3 4; do
    local out
    out=$(curl -sS --http1.1 --max-time 60 \
      -F "reqtype=fileupload" \
      -F "time=1h" \
      -F "fileToUpload=@${file}" \
      "https://litterbox.catbox.moe/resources/internals/api.php" || true)
    if [[ "$out" =~ ^https://litter\.catbox\.moe/ ]]; then
      printf "%s" "$out"
      return 0
    fi
    echo "  litterbox attempt ${attempt} failed (out='${out:-empty}'), retrying..." >&2
    sleep 3
  done
  echo "ERR: litterbox upload failed after retries" >&2
  return 1
}

submit() {
  local image_url="$1"
  local prompt="$2"
  local duration="${3:-5}"
  local payload
  payload=$(cat <<EOF
{
  "image_url": "${image_url}",
  "prompt": "${prompt}",
  "duration": ${duration},
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
EOF
)
  curl -sS -X POST "${BASE}/${MODEL}" \
    -H "${AUTH}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -d "${payload}"
}

poll_until_done() {
  local request_id="$1"
  local max_wait="${2:-900}"   # seconds
  local elapsed=0
  while [ "$elapsed" -lt "$max_wait" ]; do
    local body
    body=$(curl -sS "${BASE}/requests/${request_id}/status" -H "${AUTH}")
    local status
    status=$(printf "%s" "$body" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
    case "$status" in
      completed)
        printf "%s" "$body"
        return 0
        ;;
      failed|nsfw)
        echo "FAILED: $body" >&2
        return 1
        ;;
      *)
        echo "  status=$status (${elapsed}s)" >&2
        sleep 8
        elapsed=$((elapsed + 8))
        ;;
    esac
  done
  echo "TIMEOUT after ${max_wait}s" >&2
  return 1
}

generate_clip() {
  local name="$1"
  local image_path="$2"
  local prompt="$3"
  local duration="${4:-5}"

  local out="${VIDEO_DIR}/${name}.mp4"
  if [ -f "$out" ]; then
    echo "✓ ${name}.mp4 already exists — skip"
    return 0
  fi

  echo "▸ ${name}: shrinking $(basename "$image_path")..."
  local resized
  resized=$(resize_for_upload "$image_path")
  echo "  resized to: $(/bin/ls -la "$resized" | /usr/bin/awk '{print $5}') bytes"

  echo "▸ ${name}: uploading..."
  local image_url
  image_url=$(upload_to_litterbox "$resized")
  echo "  hosted at: $image_url"

  echo "▸ ${name}: submitting to DoP..."
  local resp
  resp=$(submit "$image_url" "$prompt" "$duration")
  local request_id
  request_id=$(printf "%s" "$resp" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["request_id"])')
  echo "  request_id=$request_id"

  echo "▸ ${name}: polling..."
  local final
  final=$(poll_until_done "$request_id")
  local video_url
  video_url=$(printf "%s" "$final" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["video"]["url"])')
  echo "  video at: $video_url"

  echo "▸ ${name}: downloading to ${out}..."
  curl -sS -o "$out" "$video_url"
  /bin/ls -la "$out"
  echo "✓ ${name} done"
  echo
}

# ============================================================
# Clip definitions — keep prompts cinematic + restrained motion
# ============================================================
declare -a CLIPS=(
  "intro|sunset-peak.png|Subtle parallax push-in on alpine ridge at golden hour, gentle wind across snow, slow drifting clouds, distant lens flare, ultra cinematic, very subtle motion|5"
  "process|climber.png|Smooth tracking shot following the climber on the rock face, slight handheld feel, dust motes in sun rays, warm cinematic grade, gentle vertical motion|5"
  "cta|night-camp.png|Slow gentle push-in on tent and campfire under starry sky, milky way drifts overhead, embers float upward, calm night atmosphere|5"
)

# Filter by argument
if [ "$#" -gt 0 ]; then
  TARGET="$1"
  CLIPS=( "$(printf '%s\n' "${CLIPS[@]}" | grep "^${TARGET}|" || true)" )
  if [ -z "${CLIPS[0]:-}" ]; then
    echo "no clip named '${TARGET}'" >&2; exit 2
  fi
fi

for spec in "${CLIPS[@]}"; do
  IFS='|' read -r NAME IMG PROMPT DUR <<<"$spec"
  generate_clip "$NAME" "${ASSETS}/${IMG}" "$PROMPT" "$DUR"
done

echo "All clips done."
