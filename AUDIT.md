# AUDIT.md — GitHub Stars Visualizer System Audit

**Date:** 2026-06-12. **Scope:** entire repository at commit `15b0b4c`. **Method:** five parallel code-reading passes (components/state, AI services, graph/audio, CSS/chrome, build/tests), cross-checked by direct file reads. This document is **descriptive only**: it records what the code does today, not what it should do. All line numbers refer to the files as they exist at this commit. Items that could not be determined from the code are flagged as *ambiguous*.

---

## 1. Module map

Source total (excluding `package-lock.json`, README, banner): ~3,700 lines.

| File | Lines | Responsibility | Imports | Imported by |
|---|---|---|---|---|
| `index.html` | 13 | HTML shell: viewport meta, emoji favicon, `#root`, loads `/src/main.jsx` | — | — |
| `src/main.jsx` | 10 | React mount in `<React.StrictMode>` (`main.jsx:6-9`) | react, react-dom, `App`, `index.css` | entry |
| `src/App.jsx` | 708 | Root component: all app state, window manager, indexing orchestration, indexer modal, shutdown screen | all components, `audio`, `github`, `aiAnalysis`, `graphBuilder` | `main.jsx` |
| `src/components/WindowFrame.jsx` | 166 | Draggable/maximizable window chrome (titlebar, controls, drag logic) | react, `audio` | `App.jsx` (4 instances) |
| `src/components/GraphWindow.jsx` | 468 | force-graph canvas host, custom node painter, click hit-testing, filter/physics panel | react, `force-graph`, `d3-force-3d` (`forceCollide`), `audio` | `App.jsx` |
| `src/components/SettingsWindow.jsx` | 256 | Credentials/config form, "test connection" feature | react, `audio`, `aiRouter` | `App.jsx` |
| `src/components/DetailWindow.jsx` | 188 | Selected-node inspector; semantic-link navigation | react, `audio` | `App.jsx` |
| `src/components/Taskbar.jsx` | 171 | Start menu, window tabs, CRT toggle, live clock | react, `audio` | `App.jsx:689` |
| `src/components/HelpWindow.jsx` | 88 | Static help/readme content | react, `audio` | `App.jsx` |
| `src/components/DesktopIcon.jsx` | 30 | Presentational desktop icon (select/double-click) | react, `audio` | `App.jsx` (4 instances) |
| `src/services/aiAnalysis.js` | 194 | Single-shot AI categorization: prompt build, response parse, heuristic fallback, normalization | `aiRouter` | `App.jsx:11` |
| `src/services/aiRouter.js` | 133 | Multi-provider dispatch (gemini/openrouter/openai/groq/custom-via-proxy) | `rateLimiter` | `aiAnalysis.js`, `SettingsWindow.jsx:53` |
| `src/services/rateLimiter.js` | 102 | Client-side minute/day request quotas in localStorage | — | `aiRouter.js` |
| `src/services/github.js` | 101 | Starred-repo fetch: paginated loop + single-page variant | — | `App.jsx:10` |
| `src/utils/graphBuilder.js` | 131 | Pure function: repos + AI analysis → `{nodes, links}` | — | `App.jsx:12` |
| `src/utils/audio.js` | 113 | Web Audio synthesis: 4 sounds, module-global AudioContext | — | every component + App |
| `src/index.css` | 560 | Entire retro OS design system (tokens, bevels, taskbar, CRT, terminal, scrollbars) | Google Fonts `@import` (line 1-5) | `main.jsx:4` |
| `src/App.css` | 184 | **Dead code.** Vite template leftovers; never imported anywhere (verified: only `index.css` is imported, `main.jsx:4`) | — | none |
| `api/ai-proxy.js` | 61 | Vercel serverless function: forwards chat-completion calls to arbitrary `targetUrl` | — | called over HTTP by `aiRouter.js:67` |
| `vite.config.js` | 17 | React plugin + Vitest exclude globs (no env/globals config) | — | — |
| `eslint.config.js` | 21 | js.recommended + react-hooks + react-refresh flat config | — | — |
| `sync-gitnord.sh` | 69 (2.2 KB) | rsyncs source into a separate `gitnord/` git repo for Vercel deploy | — | manual |
| Tests (5 files) | 694 | See §6 | — | — |

**Dependencies** (`package.json:13-18`): `react`/`react-dom` 19.2.6, `force-graph` ^1.51.4 (used, `GraphWindow.jsx`), `@google/generative-ai` ^0.24.1 (**declared but never imported**), `lucide-react` ^1.17.0 (**declared but never imported**). No `vercel.json` exists; Vercel deployment relies on the `api/` folder convention plus the out-of-repo `gitnord/` mirror produced by `sync-gitnord.sh`.

---

## 2. Data flow

### 2.1 GitHub fetch
1. User enters username/PAT in SettingsWindow (`SettingsWindow.jsx:79-100`, password-type inputs) → `onSave` → `handleSaveSettings` (`App.jsx:215`) → persists whole settings object including tokens to `localStorage['gitstars_settings']` (`App.jsx:217`). Changing username clears repo/AI caches (`App.jsx:221-222`).
2. "Start indexing" → `handleStartIndexing` (`App.jsx:262-359`) → `fetchStarredRepos(username, githubToken, maxStars)` (`App.jsx:288`).
3. `github.js:1-59`: loop over `GET https://api.github.com/users/{username}/starred?page=N&per_page=100`; `Authorization: token <pat>` header added only if a token is set (`github.js:19`); hard cap `Math.min(maxStars, 500)` (`github.js:9`); stops on short page (`github.js:50`) or cap; final `slice` (`github.js:58`). Rate-limit handling: on 403/429, throws only if `X-RateLimit-Remaining === '0'` (`github.js:29-36`); no backoff, no `X-RateLimit-Reset` use. A second export `fetchStarredReposPaged` (`github.js:61-101`) is **never called from app code** — only from tests.

### 2.2 AI categorization
1. If an API key is configured, `analyzeStars(...)` is called (`App.jsx:302`) with an `onProgress` callback feeding the indexer modal log.
2. `aiAnalysis.js:49-56`: builds **one single prompt** containing all repos (`{full_name, description≤150ch, language}` serialized with `JSON.stringify(..., null, 2)`); no batching, no token-count guard.
3. `aiRouter.sendMessage` (`aiRouter.js:4-132`): `rateLimiter.checkLimit()` first (`:10`), then provider switch (`:18-78`):
   - **gemini**: key in URL query string `?key=` (`:21`), `responseMimeType: 'application/json'`.
   - **openrouter / openai / groq**: `Authorization: Bearer` (`:36,48,58`), `response_format: {type:'json_object'}`.
   - **custom**: POSTs `{targetUrl, apiKey, model, prompt}` to `${origin}/api/ai-proxy` (`:67-74`).
   - No retry/fallback; 429 gets a special message (`:93-95`); other non-OK throws with upstream error detail (`:97-107`); `rateLimiter.increment()` only after successful parse (`:129`).
4. Response parsing (`aiAnalysis.js:102-139`): markdown-fence strip → first/last-brace slice → trailing-comma regex → `JSON.parse` → on failure, `heuristicParse` (`:3-37`, regex over 1000-char windows around each repo name). **Errors never propagate** — the catch at `:89` logs and continues, so analysis silently degrades to defaults.
5. Normalization (`:142-180`): every repo is guaranteed `{category, summary, related[]}`, falling back to `repo.language || 'General'` and `repo.description`; `related` filtered to repos present in the input set, case-insensitively.
6. Results cached: `localStorage['gitstars_cached_repos']` and `['gitstars_cached_ai']` (`App.jsx:321-322`; key-less path writes `{}` at `:331-332`). Caches are never invalidated except on username change or full reset.

### 2.3 Graph build
`buildGraphData(repositories, aiAnalysis, {languages, minStars})` (`graphBuilder.js`) — pure, deterministic, no positions:
filter (`:4-18`) → unique categories (`:31-35`) → category nodes (`val:16`, color `#ff00ff`, `:38-46`) → repo nodes (`val = max(5, log10(stars+1)*3)`, `:59`; color from a 12-language map `getLanguageColor`, `:111-131`) → `belongs_to` links repo→category (`:78-82`) → `semantic_connection` links from `analysis.related`, deduped bidirectionally (`:90-93`), case-insensitive target lookup, silently dropping targets outside the filtered set (`:87`).
Recomputed in `React.useMemo` keyed on `[repositories, aiAnalysis, selectedLanguages, minStars]` (`App.jsx:58-63`).

### 2.4 Render loop
`GraphWindow.jsx` instantiates `force-graph` once on mount (`:92-204`, deps `[]`), clearing the container with `innerHTML = ''` (`:96`). The library owns the rAF loop and the d3-force simulation (charge/link/collide configured at `:111-113`, re-tuned + `d3ReheatSimulation()` at `:246-255`). Custom node painter `drawNode` (`:36-89`): halo for selected/search-matched nodes, core circle, white ring for categories, labels only when `globalScale > 0.15` (`:70`), `ctx.measureText` per category label per frame (`:76`). Click detection is custom: `pointerdown`/`pointerup` with <8 px / <500 ms threshold (`:138-150`), `screen2GraphCoords` then an O(n) linear scan over all nodes for the nearest hit (`:161-171`) → `onSelectNode` → App opens DetailWindow with detail forced to top z (`App.jsx:361-381`). Data updates go through a second effect (`:206-235`) with one-time `zoomToFit` (`:227-234`); search/selection highlight re-registers `nodeCanvasObject` (`:237-244`). ResizeObserver feeds CSS-pixel dimensions to `graph.width/height` (`:187-193`); **no devicePixelRatio handling in app code** (whether force-graph scales for DPR internally is *ambiguous from this repo*). Cleanup removes listeners and the instance (`:195-202`).

---

## 3. State management

**Pattern:** everything lives in `App.jsx` component state; zero Context, zero external store, props drilled one level down. 14 `useState` hooks (`App.jsx:16-144`), 3 `React.useMemo` (`:58-76`).

| Location | What lives there |
|---|---|
| App state | `settings` (incl. `githubToken`, `apiKey`) `:21-36`; `repositories` `:39`; `aiAnalysis` `:47`; filters `selectedLanguages`/`minStars` `:55-56`; `selectedNode`, `searchQuery` `:77-78`; indexing trio `isIndexing/indexingLogs/installProgress` `:81-83`; `crtEnabled/isShutdown/selectedIcon` `:16-18`; `windows` object (per-window `{isOpen,isActive,zIndex,x,y,width,height,title,icon}`) `:144` initialized by `getInitialWindows()` `:86-141` |
| Child component state | `WindowFrame`: `pos/isMaximized/dragging/dragStart` (`WindowFrame.jsx:21-24`) — **window position is duplicated**: initial x/y come from App's `windows` state but live position is local to WindowFrame and never written back. `GraphWindow`: `showSemantic/isFiltersOpen/gravity/linkDistance/collisionRadius` (`GraphWindow.jsx:20-24`). `Taskbar`: `startMenuOpen/timeStr` (`Taskbar.jsx:13-14`). `SettingsWindow`: local form copies of settings. |
| localStorage | `gitstars_settings` (R `App.jsx:23` / W `:217`); `gitstars_cached_repos` (R `:41` / W `:321,331`); `gitstars_cached_ai` (R `:49` / W `:322,332`); `gitstars_rl_minute_timestamp/_count`, `gitstars_rl_daily_timestamp/_count` (`rateLimiter.js:44-45,57-58`). `handleResetAll` does a blanket `localStorage.clear()` (`App.jsx:236`). |
| Module globals | `audioCtx` singleton in `audio.js:1` (lazy-created, resumed on suspend `:9-11`, never closed). |
| Refs | `GraphWindow.jsx:18-33`: container, graph instance, plus `searchQueryRef/selectedNodeIdRef/onSelectNodeRef` mirroring props for closure stability; `hasZoomedRef`. `WindowFrame.jsx:25`: `headerRef`. |

**Window manager mechanics:** `focusWindow` (`App.jsx:149-176`) computes max z excluding detail and assigns `maxZ+1`; detail window is *always* re-elevated above everything in `focusWindow` (`:166-172`), `toggleWindow` (`:199-203`), and `handleSelectNode` (`:375-378`). Drag is mousemove/touchmove listeners on `window` attached only while dragging (`WindowFrame.jsx:78-91`, cleaned up); bounds clamp keeps the titlebar within `[0, innerWidth-100]×[0, innerHeight-40]` (`:46-47`). Double-click titlebar toggles maximize (`:127`). There is **no window resize affordance** other than maximize; sizes are fixed props (help 440×380, settings 420×480, graph 640×480, detail 320×420 — `App.jsx:92-140`). Minimize = `toggleWindow` from a taskbar tab (`Taskbar.jsx:137`).

---

## 4. Coupling hotspots

- **`App.jsx` is the universal hub**: imports every component and every service except `aiRouter`/`rateLimiter`; owns 14 state atoms; renders 4 `WindowFrame`s, 4 `DesktopIcon`s, the indexer modal (~100 lines of inline JSX+styles, `:494-591`), the graph window header with search box (`:609-645`), and the shutdown screen. Anything touching data, windows, or indexing flows through it.
- **`audio.js` is imported by all 8 components plus App** — the widest fan-in in the codebase; every interactive element calls `audio.playClick()` directly at its call site (≈17 call sites: e.g. `GraphWindow.jsx:174,258,274,320,343,361`; `App.jsx:185,274,320,342,361,582,637,695`).
- **`aiRouter` has two consumers**: `aiAnalysis.js` (production path) and `SettingsWindow.jsx:53` (test-connection button) — the settings UI talks to the network layer directly.
- **Prop fan-out**: GraphWindow receives 10 props including two raw state setters (`setSelectedLanguages`, `setMinStars`) (`App.jsx:646-657`); Taskbar receives 7 (`:689-702`).
- **Styling is split three ways**: `index.css` classes, ~100+ inline `style={{}}` objects across all components (full inventory in the CSS audit pass; densest in DetailWindow, GraphWindow's filter panel, and App's indexer modal), and dynamic border-style props in Taskbar (`Taskbar.jsx:61-67,156-161`). No single source of truth for spacing/sizing.

---

## 5. Test coverage

Suite: **5 files, 27 tests, all passing** (Vitest 4.1.8, 617 ms; verified by running `npm test -- --run`). README claims "15 unit tests" (`README.md:148`) and CONTRIBUTING claims "26+" (`CONTRIBUTING.md:47`) — both stale.

| File | Tests | What is actually verified | What is NOT |
|---|---|---|---|
| `rateLimiter.test.js` (60) | 4 | under-limit pass; minute block at 15; recovery after 61 s (fake timers); daily block at 1500 via test-only `forceIncrementDailyOnly` | `getStats()` (`rateLimiter.js:82-96`); explicit `reset()` behavior; window-boundary edges |
| `aiAnalysis.test.js` (251) | 10 | empty input; clean JSON; markdown-fenced JSON; trailing commas + chatter; onProgress stages; full-garbage fallback to language/description defaults; heuristic recovery incl. invalid relations; case-insensitive key matching and casing normalization (both parse paths) | router-failure path (`:89` console.error branch); several specific onProgress messages |
| `aiRouter.test.js` (170) | 6 | missing-key throw; limiter consulted before fetch; Gemini URL/headers + increment; OpenRouter headers/URL; 429 → friendly error; custom provider posts to `/api/ai-proxy` with `targetUrl` in body | **openai and groq cases entirely untested** (`aiRouter.js:46-64`); network-error wrap (`:88-90`); non-429 HTTP errors; malformed-response throws (`:117,124`) |
| `github.test.js` (67) | 4 | username-required throw; URL/header construction; 403+remaining-0 → rate-limit error; HTTP 500 → error | **`fetchStarredRepos` (the function the app actually uses) is entirely untested** — all 4 tests target `fetchStarredReposPaged`; pagination loop, cap/slice, empty-page break, network-error wrap all unexercised |
| `graphBuilder.test.js` (146) | 4 | node/link counts; Uncategorized fallback; language+minStars filter; case-insensitive semantic-link resolution | `getLanguageColor` map; `val` sizing formula; bidirectional-dedup branch directly |
| **Zero coverage** | — | — | `App.jsx` (708 lines incl. window manager, indexing orchestration, cache I/O), all 8 components, `audio.js`, `main.jsx`, `api/ai-proxy.js` |

Vitest config is just exclude globs in `vite.config.js:7-15`; no environment, globals, coverage thresholds, or setup files. No CI workflow exists in the repo (no `.github/` directory).

---

## 6. Security and correctness observations

Reported factually; severity assessment is deferred to FINDINGS.md.

1. **Token/key storage**: GitHub PAT and AI API key are stored in plaintext JSON in `localStorage['gitstars_settings']` (`App.jsx:217`) and live in React state. They are entered via `type="password"` inputs (`SettingsWindow.jsx:90,149`). They are never logged by app code.
2. **Gemini key in URL**: for the gemini provider the key is a query-string parameter (`aiRouter.js:21`), i.e., it appears in the request URL rather than a header.
3. **Open proxy**: `api/ai-proxy.js` accepts any `http:`/`https:` `targetUrl` (`:29-31`), sets `Access-Control-Allow-Origin: *` (`:3`), requires no auth, and forwards a client-supplied bearer token (`:37-39`). As written it is a general-purpose server-side request forwarder reachable by any origin (SSRF-shaped surface; whether Vercel's platform constrains it is outside this repo).
4. **Rate limiter is advisory only**: quotas (15/min `rateLimiter.js:1`, 1500/day `:2`) live in four plaintext localStorage keys (`:44-45,57-58`); checked only at `aiRouter.js:10` and incremented only on success (`:129`). Anyone (or any reload-with-cleared-storage, devtools edit, or `handleResetAll`'s `localStorage.clear()` at `App.jsx:236`) resets it. There is no server-side enforcement anywhere. Failed requests don't count against the quota.
5. **README contradiction**: `README.md:73,77` claims "Zero Server Backend… no proxy servers" while `api/ai-proxy.js` is a server-side proxy (added in commit `15b0b4c` for Ollama CORS).
6. **Swallowed errors**: `analyzeStars` never throws (`aiAnalysis.js:89,127,137`) — on any AI failure the app silently produces language-based categories; the only user signal is one ⚠️ log line in the indexer modal (`:91`). Upstream API error bodies are surfaced verbatim into user-facing error strings (`aiRouter.js:101-106`).
7. **Unvalidated cache reads**: `JSON.parse` of the three `gitstars_*` cache/settings keys is wrapped in try/catch with defaults (`App.jsx:21-54`), but there is no schema validation — a stale shape (e.g., after a future format change) flows directly into rendering.
8. **`fetchStarredReposPaged` divergence**: the tested function (`github.js:61-101`) and the used function (`:1-59`) duplicate header/error logic with small differences (optional chaining on headers at `:83`; non-array throws at `:96-98` vs. silent break at `:43-45`).
9. **localStorage quota**: cached repo JSON for 500 repos plus AI results are written without size checks or quota-exception handling beyond the surrounding try/catch (`App.jsx:320-333`).
10. **No CSP / no external-content sanitization concerns found**: repo descriptions/summaries are rendered as React text children (no `dangerouslySetInnerHTML` anywhere in src/).

---

## 7. Performance characteristics

1. **Simulation cost**: d3-force charge is O(n²)-ish per tick (Barnes-Hut inside the library; exact internals not in this repo — *ambiguous*). App-side knobs at `GraphWindow.jsx:111-113,251-253`. At 200 nodes this is light; at 1000+ nodes the dominant cost is the library's tick + draw, not app code.
2. **Per-frame app cost**: `drawNode` runs per node per frame; labels culled below `globalScale 0.15` (`:70`); `ctx.measureText` per category label per frame (`:76`); link drawing is library-default with **3 animated particles per semantic link** (`:104-107`) which keeps the rAF loop hot even when the layout has settled (particles animate indefinitely).
3. **No DPR scaling in app code** (§2.4) — canvas sized in CSS pixels via ResizeObserver (`:187-193`).
4. **Re-render topology**: every keystroke in the graph search box updates `searchQuery` in App (`App.jsx:614-621`), re-rendering the whole App tree (no memoized children); GraphWindow shields the canvas from this via refs + effect-scoped re-registration (`GraphWindow.jsx:237-244`), but all other windows re-render. Same for clock-free state changes; the Taskbar clock ticks its own local state every 1 s (`Taskbar.jsx:17-31`) so it only re-renders itself.
5. **Graph rebuild**: any filter change recomputes `buildGraphData` (O(n+e), cheap) **and** feeds a new object to `graph.graphData()` (`GraphWindow.jsx:224`), which restarts/reheats layout — layout positions are not preserved across filter toggles (library merge behavior is *ambiguous* from this repo).
6. **CRT effects are CSS-only and cheap**: two fixed overlay divs (gradients + inset shadow, `index.css:42-64`) plus an **infinite 0.15 s opacity keyframe animation** on the root (`index.css:66-74`) that forces continuous compositing regardless of user activity; no `prefers-reduced-motion` query anywhere.
7. **Bundle**: single chunk, 424.6 KB / 134.7 KB gzip (verified `npm run build`, Vite 8.0.16, 383 ms); no code splitting, no dynamic imports; force-graph + React are the bulk. Google Fonts loaded via render-blocking CSS `@import` (`index.css:1-5`); imported font VT323 is referenced by no rule.
8. **StrictMode double-invocation**: dev-mode mount effects run twice; the GraphWindow mount effect guards via `innerHTML=''` teardown/re-init (`:96`); no production impact.
9. **Indexing is fully serial**: fetch all pages → one big AI call → render; progress percentages are scripted rather than measured (`App.jsx:262-359`).

---

## 8. Ambiguities (explicitly not resolved by reading this repo)

- Whether `force-graph` internally handles devicePixelRatio, node-drag default behavior, position merging on `graphData()` updates, and Barnes-Hut approximation parameters — all library internals, not pinned or configured in app code.
- Interaction of the indexer modal (`zIndex 99999`, `App.jsx:504`) with the detail window's "always on top among windows" rule, and with taskbar/CRT layers (9999/999998/999999) — layering works only because the magic numbers happen to be ordered; no documented scheme.
- Whether the case-insensitive lookups in `graphBuilder.js:25-28` and `aiAnalysis.js:148-152` defend against an observed LLM behavior or are speculative.
- Whether `@google/generative-ai` and `lucide-react` deps are planned or leftover.
- Whether `sync-gitnord.sh`'s separate `gitnord/` repo is the actual deployed artifact for `git-starmap.vercel.app`, or whether this repo deploys directly.
