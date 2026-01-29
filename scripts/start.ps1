# ChefBot - All-in-one start script (Windows PowerShell)
# Composes services, waits for Ollama, pulls model if needed

$ErrorActionPreference = "Stop"
$Model = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "tinyllama" }
$OllamaUrl = if ($env:OLLAMA_URL) { $env:OLLAMA_URL } else { "http://localhost:11434" }
$MaxWait = 60

Write-Host "=== ChefBot ==="
Write-Host "Model: $Model"
Write-Host ""

# 1. Compose up
Write-Host "[1/4] Starting Docker Compose..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start Docker Compose."
    exit 1
}

# 2. Wait for Ollama
Write-Host "[2/4] Waiting for Ollama..."
$ready = $false
for ($i = 1; $i -le $MaxWait; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "$OllamaUrl/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        $ready = $true
        break
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Host "      Timeout waiting for Ollama. Check: docker compose logs ollama"
    exit 1
}
Write-Host "      Ollama ready."

# 3. Pull model if not present
Write-Host "[3/4] Checking model $Model..."
try {
    $tags = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -Method Get
    $hasModel = $tags.models | Where-Object { $_.name -like "$Model*" }
    if ($hasModel) {
        Write-Host "      Model already present."
    } else {
        Write-Host "      Pulling model $Model..."
        docker compose exec -T ollama ollama pull $Model
    }
} catch {
    Write-Host "      Could not check tags, attempting pull..."
    docker compose exec -T ollama ollama pull $Model
}

# 4. Done
Write-Host "[4/4] Done."
Write-Host ""
Write-Host "Open: http://localhost:3000"
Write-Host ""
