# ChefBot

AI chatbot untuk dapur dan memasak. **Tanpa server**—buka index.html saja, fetch langsung ke RapidAPI.

## Quick Start

1. **Salin `config.env.example` ke `config.env`** (atau copy `.env` ke `config.env`) dan isi `RAPIDAPI_KEY` dari [rapidapi.com/chatgpt-42](https://rapidapi.com/rphrp1985/api/chatgpt-42)
2. **Buka index.html via Live Server** (wajib—jangan buka dengan file://)

## Fitur

- Tanpa Node.js/npm—cukup HTML + config.env
- API key dari `config.env`—Live Server tidak menyajikan file `.env`, jadi pakai `config.env`
- Mode: Recipe Bot, Ingredient Expert, Kitchen Tips, Menu Planner
- Bahasa: English / Indonesia

## Catatan

- **Wajib** gunakan Live Server (bukan file://) agar `config.env` bisa dibaca
