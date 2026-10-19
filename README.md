# ChefBot

AI chatbot untuk dapur dan memasak. **Tanpa server**—buka index.html saja, fetch langsung ke Groq API (`openai/gpt-oss-120b`).

## Quick Start

1. **Salin `config.env.example` ke `config.env`** dan isi `GROQ_API_KEY` dari [console.groq.com/keys](https://console.groq.com/keys)
2. **Buka index.html via Live Server** (atau web server lokal)

## Fitur

- Menggunakan Groq API super cepat dengan model `openai/gpt-oss-120b`
- Streaming respons real-time
- Tanpa Node.js/npm backend—cukup HTML + JS client
- Mode: Recipe Bot, Ingredient Expert, Kitchen Tips, Menu Planner
- Bahasa: English / Indonesia
- Unit converter, cooking quick tips, & quick actions

## Catatan

- Gunakan Live Server atau web server lokal agar `config.env` dapat dimuat oleh browser.
- Key juga dapat dikonfigurasi langsung di `index.html` pada `window.CHEFBOT_GROQ_API_KEY`.
