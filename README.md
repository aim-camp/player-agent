# aim.camp Player Agent

Desktop application for CS2 / FACEIT system optimization — part of the [aim.camp](https://aim.camp) gaming ecosystem.

Built with **Tauri v1** (Rust backend + TypeScript frontend).

## Features

### System Optimization (6 tabs)
- **SYS** — ~96 Windows tweaks (network, power, memory, GPU scheduling, etc.) with per-toggle impact prediction
- **CFG** — ~150+ CS2 autoexec commands with categories, search, import/export
- **HW** — Live hardware detection (CPU, GPU, RAM, disk, network adapters)
- **PROC** — Process manager with flagging of known resource hogs
- **NET** — Multi-server ping tester (Valve, FACEIT, AWS regions)
- **DEMO** — CS2 demo file manager with metadata parsing

### Community Integration (4 tabs — in development)
- **RANK** — Rankings, ELO tracking, achievements (OAuth Steam/Discord/FACEIT)
- **SRVS** — Match creation via Discord Bot, 5v5 & Retakes modes (Docker + SteamCMD)
- **MRKT** — Steam item tracker, price history, watchlist & alerts
- **HUB** — Wiki, events, Discord bridge, feedback, tournaments

### Additional
- AI-powered optimization suggestions (Groq integration)
- Discord webhook sharing
- 11 color themes with LED state indicators
- Profile save/load system
- PowerShell script generation & execution

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri v1.8 |
| Backend | Rust 2021 |
| Frontend | TypeScript + Vite 5 |
| Styling | Custom CSS (Orbitron + Rajdhani fonts) |
| Scripts | PowerShell (generated) |

## Build

```bash
# Install dependencies
npm install

# Dev mode
npx tauri dev

# Production build (generates .exe + .msi)
npx tauri build
```

## Architecture

Part of the aim.camp distributed platform:

```
aim-camp/
├── player-agent/          ← this repo (Tauri desktop app)
├── counter-strike-2/      ← CS2 game configs
├── steam-openid-connect-provider/  ← OAuth IDP
├── pterodactyl-panel/     ← server management
├── frontend/              ← (planned) React SPA
├── backend/               ← (planned) Node.js API
├── discord-bot/           ← (planned) match orchestration
└── infra/                 ← (planned) Docker Compose + monitoring
```

## License

GPL-3.0

---

**by Rqdiniz [ bu- ] · [aim.camp](https://aim.camp)**
