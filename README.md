# ChefBot

A **local** AI chatbot focused exclusively on kitchen and professional cooking. It runs on your laptop using Docker and a small Ollama model, with a modern HTML + Tailwind UI and a lightweight API layer. All processing stays on your machine—private and offline-capable.

## Features

- **Domain-restricted**: Answers only kitchen and cooking questions; politely redirects off-topic queries.
- **Local LLM**: Uses the smallest supported Ollama model (TinyLlama by default) inside Docker.
- **Session context**: Keeps a short conversation history per session; clear anytime via "New conversation."
- **Chef-inspired UI**: Cream and gold palette, message bubbles, typing indicator, keyboard accessible.
- **Resource limits**: Docker Compose sets memory/CPU limits; suitable for typical laptops.

## Requirements

- **Docker** and **Docker Compose**
- **Hardware**: ~2 GB RAM for Ollama + ~512 MB for the app; TinyLlama is ~638 MB. A machine with 4 GB+ free RAM is recommended.
- **Disk**: ~1 GB for the model and images.

## Quick Start

1. **Clone or copy this project**, then from the project root run the all-in-one start script:

   **Mac / Linux:**
   ```bash
   ./scripts/start.sh
   ```

   **Windows (PowerShell):**
   ```powershell
   .\scripts\start.ps1
   ```

   **Windows (CMD):**
   ```cmd
   scripts\start.bat
   ```

   The script will: compose up, wait for Ollama, pull the model if needed, then print the app URL.

2. **Open the app**: [http://localhost:3000](http://localhost:3000)

3. Ask kitchen or cooking questions. Try: *"How do I make a basic béchamel?"* or *"What's the safe internal temperature for chicken?"*

**Manual start** (if you prefer):
```bash
docker compose up --build -d
docker compose exec ollama ollama pull tinyllama   # first run only
```

## Troubleshooting

**"Sorry, I couldn't reach the kitchen assistant"** — Usually one of:

1. **Model not pulled** — Run: `docker compose exec ollama ollama pull tinyllama`
2. **Ollama not running** — Run: `docker compose up -d`
3. **Wrong URL** — Open [http://localhost:3000](http://localhost:3000), not `file://`

**Check status:**
- Open [http://localhost:3000/api/status](http://localhost:3000/api/status) — shows Ollama connectivity and model availability

**Rebuild after code changes:**
```bash
docker compose down
docker compose up -d --build
```

## Project Layout

```
ChefBot/
├── docker-compose.yml   # Ollama + app services, resource limits, health checks
├── index.html           # Chat UI (Tailwind, Inter font) — main entry
├── app.js               # Chat logic, typing indicator, API calls
├── styles.css           # Theme overrides
├── api/
│   ├── Dockerfile      # Builds API + serves frontend from root
│   ├── package.json
│   ├── server.js       # Express: /api/chat, /api/clear, /api/health, static files
│   └── domain.js       # Kitchen-only domain check
├── scripts/
│   ├── start.sh        # All-in-one start (Mac/Linux)
│   ├── start.bat       # All-in-one start (Windows CMD)
│   └── start.ps1       # All-in-one start (Windows PowerShell)
└── README.md
```

## API Endpoints

| Method | Path        | Description |
|--------|-------------|-------------|
| GET    | `/api/health` | Service health |
| POST   | `/api/chat`   | Send message; body `{ "message": "..." }`. Returns `{ "reply", "cached?", "denied?" }`. |
| POST   | `/api/clear`  | Clear session context. Optional header: `X-Session-Id`. |

## Configuration

- **Ollama model**: Set `OLLAMA_MODEL` in `docker-compose.yml` (e.g. `phi3:mini` for a slightly larger model).
- **Port**: Change `3000:3000` for the `app` service if you need another port.
- **Memory**: Adjust `deploy.resources.limits.memory` for `ollama` and `app` in `docker-compose.yml`.

## Using Another Model

Edit `OLLAMA_MODEL` in `docker-compose.yml`, then pull that model:

```bash
docker compose exec ollama ollama pull <model-name>
```

Restart the app if it was already running: `docker compose restart app`.

## Stopping

```bash
docker compose down
```

Data for Ollama (including pulled models) is in the `ollama_data` volume and persists between runs.

## License

Use and modify as needed for your prototype or evaluation.
