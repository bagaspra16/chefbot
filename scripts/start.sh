#!/usr/bin/env bash
# ChefBot - All-in-one start script (Mac & Linux)
# Composes services, waits for Ollama, pulls model if needed

set -e
MODEL="${OLLAMA_MODEL:-tinyllama}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MAX_WAIT=60

echo "=== ChefBot ==="
echo "Model: $MODEL"
echo ""

# 1. Compose up
echo "[1/4] Starting Docker Compose..."
docker compose up -d --build

# 2. Wait for Ollama
echo "[2/4] Waiting for Ollama..."
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
    echo "      Ollama ready."
    break
  fi
  if [ "$i" -eq "$MAX_WAIT" ]; then
    echo "      Timeout waiting for Ollama. Check: docker compose logs ollama"
    exit 1
  fi
  sleep 1
done

# 3. Pull model if not present
echo "[3/4] Checking model $MODEL..."
if curl -sf "$OLLAMA_URL/api/tags" | grep -q "\"name\":\"$MODEL"; then
  echo "      Model already present."
else
  echo "      Pulling model $MODEL..."
  docker compose exec -T ollama ollama pull "$MODEL"
fi

# 4. Done
echo "[4/4] Done."
echo ""
echo "Open: http://localhost:3000"
echo ""
