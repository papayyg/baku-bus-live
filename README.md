# Baku Bus Live

Live arrivals of Baku city buses in Telegram: a bot and a Mini App.

Bot: [@bakubus_live_bot](https://t.me/bakubus_live_bot)

## Features

- Saved trips (stop + route) as one-tap buttons in the chat
- Minutes to arrival, stops left, all following buses
- Every bus of a route on a live map
- Nearby stops, search by name (Latin or Cyrillic) and route number
- One-off and recurring arrival alerts
- Azerbaijani, Russian and English; light and dark themes

## Stack

- Server: Bun, TypeScript, grammY, SQLite, Zod
- Mini App: React, Vite, Tailwind CSS, TanStack Query, MapLibre with OpenFreeMap tiles
- Tooling: Biome, Bun test

## Requirements

- Bun 1.4+ or Docker
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A public HTTPS URL for the Mini App
- AYNA MaaS gateway credentials (`NECPT_*`)

## Configuration

Copy `.env.example` to `.env` and fill it in. All variables are described there.

## Development

```bash
bun install
bun run dev        # API and bot on :8080
bun run dev:web    # Mini App on :5173, proxies /api to :8080
```

Set `DEV_USER_ID=1` to open the Mini App in a regular browser without Telegram auth.

```bash
bun test
bun run typecheck
bun run lint
```

## Deployment

The app runs as a single container on port 8080 and stores data in a Docker volume.

```bash
cp .env.example .env
docker compose up -d --build
```

Put any HTTPS reverse proxy in front of `127.0.0.1:8080` and set `PUBLIC_URL` to its address.

### BotFather

- Menu button: Bot Settings → Menu Button → `PUBLIC_URL`
- Commands: `start`, `app`, `help`, `language`

## Data

- Stops and routes: AYNA map API, synced daily
- Live arrivals and vehicle positions: AYNA MaaS gateway

Both are unofficial integrations and may change without notice.

## License

[MIT](LICENSE)
