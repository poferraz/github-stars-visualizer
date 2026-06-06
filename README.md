# 🕸️ GitStars Map - Retro OS Edition v1.0

A nostalgic 90s-2000s desktop operating system environment (styled like Windows 95/98) running inside the browser to explore and map your GitHub Stars, resembling Obsidian's force-directed graph view.

## 🚀 Features

- **Draggable Retro Windows:** Multiple windows for Settings, Help, Mind Map Graph, and Properties. Windows support dragging, Z-index focusing, and minimizing.
- **Universal Client-Side AI Router:** Connects directly from the browser to:
  - **Google Gemini API** (Free Tier supported natively via AI Studio)
  - **OpenRouter** (Aggregated access to free and cheap models)
  - **OpenAI** (GPT-4o-mini, custom URLs)
  - **Groq** (Llama 3)
  - **Custom Endpoints** (e.g., Ollama or custom API proxies)
- **100% Billing Protection:**
  - Standard free-tier Google AI Studio accounts will block requests and return `HTTP 429` (Too Many Requests) rather than rolling over to billing.
  - Built-in **Local Rate Limiter Security Guard** checks counts in the browser's `localStorage` and client-side blocks requests exceeding 15/min or 1500/day.
- **Obsidian-Style Mind Map:** Interactive Canvas 2D force-directed graph rendering repo and category nodes. Stars are sized logarithmically by star counts and color-coded by programming language. Connects related repositories with animated data stream particles.
- **Nostalgic 8-Bit Audio:** Micro-beeps synthesized in real-time using the Web Audio API (success chirps, error buzzes, click responses, and mechanical floppy drive seek clicks during loading).
- **CRT Monitor Shader:** CSS-driven scanlines, vignetting, phosphor glowing, and subtle flicker filters that can be toggled on/off via the taskbar tray.

## 🛠️ Security Architecture

1. **Zero Server Backend:** No database, no proxy servers. All API key variables are entered by visitors, saved in their browser's private `localStorage`, and executed directly to GitHub/Google endpoints.
2. **No Hardcoded Keys:** Your source code is 100% clean of API keys. No secrets are committed or stored on servers.

## 📦 Getting Started

### Prerequisites

You will need:
1. **Node.js** (v18+)
2. **Google Gemini API Key** (optional, but needed for AI mapping): Get one for free at [Google AI Studio](https://aistudio.google.com/).
3. **GitHub PAT** (optional, recommended): Generate a read-only token for public scopes on [GitHub Beta Settings](https://github.com/settings/tokens?type=beta).

### Running Locally

1. Clone or navigate to the directory:
   ```bash
   cd /Users/poferraz/Documents/03_Development/github-stars-visualizer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch development server:
   ```bash
   npm run dev
   ```
4. Run unit tests (TDD suite):
   ```bash
   npm test
   ```

## 🏗️ Technical Stack

- **UI Framework:** React 19 + Vite 8
- **Graph Renderer:** Canvas-based `force-graph`
- **Styling:** Vanilla CSS (retro custom bevels & layouts)
- **Test Suite:** Vitest (15 unit tests verifying rates, routers, and graph builders)
- **Sound Synth:** Native HTML5 Web Audio API
