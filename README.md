<p align="center">
  <img src="banner.png" alt="GitStars Map - Retro OS Edition" width="100%" />
</p>

<h1 align="center">🕸️ GitStars Map - Retro OS Edition v1.0</h1>

<p align="center">
  A nostalgic 90s-2000s desktop operating system environment (styled like Windows 95/98) running inside the browser to explore and map your GitHub Stars, resembling Obsidian's force-directed graph view.
</p>

<p align="center">
  <a href="https://git-start.vercel.app/">
    <img src="https://img.shields.io/badge/Live_Demo-Try_It_Online-FF5733?style=for-the-badge&logo=vercel" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <strong>⚡ Try it online! Link your read-only token and explore your stars instantly: <a href="https://git-start.vercel.app/">git-start.vercel.app</a> ⚡</strong>
</p>


<p align="center">
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Vitest-4-76E1FE?style=for-the-badge&logo=vitest" alt="Vitest 4" />
  <img src="https://img.shields.io/badge/Security-Client--Side-brightgreen?style=for-the-badge&logo=shield" alt="Client-Side Only" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-security-first-architecture">Security Architecture</a> •
  <a href="#%EF%B8%8F-how-it-works">How It Works</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-technical-stack">Tech Stack</a>
</p>

---

## 🚀 Features

*   📺 **Nostalgic CRT Monitor Shader:** CSS-driven scanlines, vignetting, phosphor glowing, and subtle flicker filters that can be toggled on/off via the taskbar tray.
*   🪟 **Draggable Retro Windows:** Multiple windows for Settings, Help, Mind Map Graph, and Properties. Windows support dragging, Z-index focusing, and minimizing.
*   🔊 **Real-time 8-Bit Audio Synthesis:** Dynamic micro-beeps synthesized on the fly using the Web Audio API (success chirps, error buzzes, click responses, and floppy drive seek clicks during loading).
*   🤖 **Universal Client-Side AI Router:** Connects directly from your browser to:
    *   **Google Gemini API** (Free Tier supported natively via AI Studio)
    *   **OpenRouter** (Aggregated access to free and cheap models)
    *   **OpenAI** (GPT-4o-mini, custom URLs)
    *   **Groq** (Llama 3)
    *   **Custom Endpoints** (e.g., Ollama or custom API proxies)
*   🛡️ **100% Billing Protection:** Built-in **Local Rate Limiter Security Guard** checks counts in `localStorage` and client-side blocks requests exceeding 15/min or 1500/day. Standard free-tier Google AI Studio accounts will return `HTTP 429` (Too Many Requests) rather than rolling over to billing.
*   🕸️ **Obsidian-Style Mind Map:** Interactive Canvas 2D force-directed graph rendering repo and category nodes. Stars are sized logarithmically by star counts and color-coded by programming language, connected with animated data stream particles.

---

## 📸 Screenshots & Artwork

<p align="center">
  <img src="readme-poster.png" alt="GitStars Map Promotional Poster" width="100%" />
</p>

<p align="center">
  <img src="screenshots/Screenshot%202026-06-06%20at%2012.41.21%20PM.png" width="48%" alt="Mind Map Setup" />
  <img src="screenshots/Screenshot%202026-06-06%20at%2012.54.34%20PM.png" width="48%" alt="Obsidian style force graph" />
</p>
<p align="center">
  <img src="screenshots/Screenshot%202026-06-06%20at%2012.57.22%20PM.png" width="48%" alt="Settings and API Configuration" />
  <img src="screenshots/Screenshot%202026-06-06%20at%2012.58.24%20PM.png" width="48%" alt="Retro CRT scanline filters" />
</p>

---

## 🔒 Security-First Architecture

We take privacy and API billing security seriously:

1.  **Zero Server Backend:** No databases, no proxy servers. All API key variables are entered by visitors, saved in their browser's private `localStorage`, and executed directly to GitHub/Google endpoints.
2.  **No Hardcoded Keys:** Your source code is 100% clean of API keys. No secrets are committed or stored on servers.
3.  **Local Rate Limiting Guard:** Even if your API keys are loaded, the browser strictly rate-limits requests to protect you from unexpected bill spikes or API bans.

---

## 🕹️ How It Works

```mermaid
graph TD
    User([User's Browser]) --> OS[Retro OS Environment]
    OS --> Graph[Canvas Force Graph Node Mapping]
    OS --> Sounds[Web Audio API sound synthesis]
    OS --> Shader[CRT Post-processing Shader]
    OS --> Guard[Security Guard Rate Limiter]
    
    Guard --> Router[Universal Client AI Router]
    Router --> |Direct Client Call| Gemini[Google Gemini API]
    Router --> |Direct Client Call| OpenRouter[OpenRouter API]
    Router --> |Direct Client Call| OpenAI[OpenAI API]
    Router --> |Direct Client Call| Groq[Groq API]
    
    OS --> |Direct Client Call| GitHub[GitHub API]
    
    subgraph Browser Storage
        Keys[localStorage: API Keys]
        Cache[localStorage: Star Data & Limits]
    end
    
    OS -.-> Keys
    Guard -.-> Cache
```

---

## 📦 Getting Started

### Prerequisites

You will need:
1.  **Node.js** (v18+)
2.  **Google Gemini API Key** (optional, but needed for AI mapping): Get one for free at [Google AI Studio](https://aistudio.google.com/).
3.  **GitHub PAT** (optional, recommended): Generate a read-only token for public scopes on [GitHub Settings](https://github.com/settings/tokens).

### Running Locally

1.  Clone or navigate to the directory:
    ```bash
    git clone https://github.com/yourusername/github-stars-visualizer.git
    cd github-stars-visualizer
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the development server:
    ```bash
    npm run dev
    ```
4.  Run unit tests (TDD suite):
    ```bash
    npm test
    ```

---

## 🏗️ Technical Stack

*   **UI Framework:** React 19 + Vite 8
*   **Graph Renderer:** Canvas-based `force-graph`
*   **Styling:** Vanilla CSS (retro custom bevels & layouts)
*   **Test Suite:** Vitest (15 unit tests verifying rates, routers, and graph builders)
*   **Sound Synth:** Native HTML5 Web Audio API

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) to get started on setting up the local dev environment, styling specifications, and TDD workflow instructions.

---

## 💎 Credits & Open Source Acknowledgements

This project was built possible by these fantastic open-source libraries, assets, and inspirations:

*   **Frontend & Tooling:** [React 19](https://react.dev/), [Vite 8](https://vite.dev/), [ESLint](https://eslint.org/)
*   **Data Visualization:** [force-graph (HTML5 Canvas)](https://github.com/vasturiano/force-graph) by Vasco Asturiano
*   **AI Integration:** [@google/generative-ai SDK](https://github.com/google/generative-ai-js)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Testing Suite:** [Vitest 4](https://vitest.dev/)
*   **Typography:** [Google Fonts: VT323](https://fonts.google.com/specimen/VT323) (nostalgic pixel font) and [Google Fonts: Courier Prime](https://fonts.google.com/specimen/Courier+Prime) (monospace console font)
*   **Visual Style & Retro Design:** Classic Windows 95/98 styling and beveled theme designs.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.


