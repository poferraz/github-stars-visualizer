# REFACTOR_PLAN.md — GitHub Stars Visualizer

**Inputs:** AUDIT.md (Phase 1), FINDINGS.md (Phase 2). **Constraints honored:** same stack (React 19 + Vite + vanilla CSS + force-graph + Web Audio), retro OS identity preserved, client-side/zero-backend security model preserved — with one flagged exception (the existing proxy, Decision D1). No code is changed by this plan; nothing below executes until approved.

---

## 1. Target architecture

### 1.1 Module layout

```
src/
  App.jsx                    # thin shell: composes Desktop, Taskbar, overlays (<150 lines)
  os/                        # the retro OS layer — pure UI machinery, data-agnostic
    WindowFrame.jsx          # controlled component: position/size/z from props
    useWindowManager.js      # reducer: open/close/focus/minimize/move/resize/z-order/persist
    Taskbar.jsx  StartMenu.jsx  DesktopIcon.jsx
  windows/                   # window content, one folder-free file each
    GraphWindow/             # split: index.jsx, useForceGraph.js, drawNode.js, FilterPanel.jsx
    SettingsWindow.jsx  DetailWindow.jsx  HelpWindow.jsx  IndexerWindow.jsx
  state/
    useIndexing.js           # fetch→analyze→cache orchestration (extracted from App)
    storage.js               # namespaced, schema-versioned localStorage wrapper
  services/                  # unchanged roles, hardened internals
    github.js                # ONE fetcher (paged loop), strict validation
    aiRouter.js  aiAnalysis.js (batched)  rateLimiter.js
  utils/
    audio.js                 # + mute state, persisted; same synthesis
    graphBuilder.js          # + category palette assignment
  styles/
    tokens.css  os.css  effects.css   # index.css split along existing seams
```

**Rationale by finding:**
- **H1 (god component):** App.jsx keeps only composition. Indexing orchestration → `useIndexing`; the inline indexer modal and graph-header JSX become normal window components. Each piece becomes unit-testable (H3).
- **H2 (split window state):** `useWindowManager` reducer becomes the *single* source of truth for position, size, z, minimized, maximized. WindowFrame turns controlled (reports drag deltas up, renders what it's told). This is what unlocks persistence, cascade/tile, resize, and kills the triplicated "detail always on top" rule (one reducer rule instead of three call sites).
- **M4 (re-renders):** window manager state via Context+reducer scoped to the OS layer; window *content* components memoized; search state moves into GraphWindow (it's the only consumer).
- **M6 (cache edges):** `storage.js` owns every localStorage touch: `gitstars.v2.*` namespacing, JSON-schema-lite validation on read, quota-exception fallback (drop cache, keep settings), and a scoped `resetApp()` replacing `localStorage.clear()`.
- **No new runtime dependencies** for state (no Redux/Zustand): at 4-6 windows and one data pipeline, useReducer+Context is sufficient and keeps the bundle flat (L4). New devDeps only: `@testing-library/react` + `jsdom` (Decision D6).

### 1.2 Data-pipeline changes (C2)

`analyzeStars` becomes batched: repos chunked (~40/batch), each batch its own prompt/parse/normalize with 1 retry + backoff; partial failures surface as a structured result `{analysis, failures: [...]}` that the indexer UI must render distinctly (no more silent degradation). `related` links computed within batch + against already-analyzed names (Decision D5). Cache writes record `schemaVersion`, `analyzedAt`, and `coverage` (n analyzed / n total) so the UI can show "AI map: 480/500 repos" honestly.

### 1.3 Security posture (C1, H5)

- Proxy: **Decision D1** (delete vs harden). Plan assumes the recommendation (delete) unless overridden.
- Gemini key moves from URL query to `x-goog-api-key` header (supported by the same endpoint) — removes keys from URL/CDN logs.
- Keys stay client-side in localStorage (the model's documented tradeoff), with added: explicit copy in Settings ("stored only in this browser"), and an optional "don't persist key" session-only checkbox (Decision D7).

---

## 2. Migration sequence

Each increment is one PR, independently shippable, behavior-parity unless stated, with its own test gate. Order is chosen so safety nets land before risky surgery.

| # | Increment | Contents | Test gate |
|---|---|---|---|
| **0** | **Baseline & hygiene** (L1, L2, H3-partial) | Add GitHub Actions CI (lint + `vitest run` + `vite build`); delete `App.css`, unused deps (`@google/generative-ai`, `lucide-react`), VT323 import; fix README/CONTRIBUTING test counts and backend claims | CI green on the 27 existing tests; build size not larger |
| **1** | **Security** (C1, H5) | Execute D1 on the proxy; Gemini key → header; `aiRouter` error messages stop echoing raw upstream bodies | New router tests: header auth for all 4 providers (closes openai/groq gap); proxy tests or proxy deletion |
| **2** | **Service unification** (M7, H3) | Merge `fetchStarredRepos`/`fetchStarredReposPaged` into one strict implementation; add `storage.js`; route all localStorage through it; scoped reset | New tests: pagination loop, 500-cap slice, empty page, network error, non-array throw; storage schema/quota tests. Gate: production fetcher coverage ≥ its branches |
| **3** | **AI batching & honest failure** (C2) | Batched `analyzeStars` per §1.2; indexer log + completion state distinguish full/partial/fallback; cache coverage metadata | aiAnalysis tests: multi-batch merge, single-batch failure → partial result, retry path, related-link scoping. Existing 10 parse tests still pass |
| **4** | **Window manager rewrite** (H2, UX1) | `useWindowManager` reducer; controlled WindowFrame; resize handles; layout persistence via storage.js; z-order from one ordered list (no magic numbers); detail-on-top as one reducer rule; Esc-to-close, focus-cycle shortcut | Reducer unit tests (focus/z/minimize/move/resize/persist round-trip); RTL component tests: open→drag→persist→reload parity. Manual parity checklist vs old behavior |
| **5** | **App decomposition** (H1, M4) | Extract `useIndexing`, IndexerWindow, Desktop; App.jsx <150 lines; memoize window contents; move searchQuery into GraphWindow | `useIndexing` tests (success/GitHub-fail/AI-partial paths with mocked services); render-count assertion that typing in search re-renders only GraphWindow |
| **6** | **Graph quality** (M1, M3, UX2) | Verify+fix DPR; per-category color palette (hash → distinct hue, legend generated from data); hover tooltip; search → zoom-to-first-match; preserve positions across filter changes (mutate node visibility / reuse node objects instead of new graphData); particles only while simulation hot or on hover; document the 500 cap in UI | graphBuilder tests for palette + stable node identity across filters; manual perf gate: settled graph at 500 nodes ≈ idle CPU; screenshot check at DPR 2 |
| **7** | **Accessibility & motion** (M2, M5, UX3) | `prefers-reduced-motion` disables flicker + particles; input focus outlines; ARIA (`role="dialog"` + label on windows, menu semantics on Start menu, `aria-live` on indexer log); status icons alongside colors; CRT toggle persisted | axe-core scan clean of criticals; scripted keyboard walkthrough (open settings → save → start index → open detail → close all, mouse-free) |
| **8** | **Responsive & touch** (H4) | <768px: windows render full-screen, taskbar tabs become the navigation (one window visible at a time); ≥44px touch targets for window controls on coarse pointers; `touch-action` on canvas/titlebars | RTL viewport tests for mode switch; manual matrix: iPhone-size, iPad-size, desktop |
| **9** | **UX polish & onboarding** (UX4, UX5, L5) | Mute toggle in tray (persisted); audio decoupled from components (single `sound()` helper or context — kills the 9-file fan-in); Settings: "Validate" button for GitHub username/PAT (1-page fetch), provider presets with sane defaults, explicit "No AI key = language-only map" copy; progress bar driven by real batch/page counts from increments 2-3 | RTL tests for validate-button states; muted-mode assertion (no AudioContext calls); manual first-run walkthrough |

Increments 0-3 are pure logic/services (low UI risk, high safety value). 4-5 are the structural surgery, protected by the nets built in 0-3. 6-9 are user-visible improvements that would be unsafe to attempt earlier.

---

## 3. UI redesign direction (retro OS identity kept)

The Win95 bevel/teal/CRT identity is the product's charm — nothing below replaces it; everything tightens it.

- **Layout system:** split `index.css` into `tokens.css` (the 9 existing custom properties + new spacing scale `--sp-1..4` and z-index tokens `--z-window/-modal/-taskbar/-overlay`), `os.css` (chrome), `effects.css` (CRT). Migrate the ~100 inline `style={{}}` clusters into classes *opportunistically* (whenever a file is already being touched in increments 4-9) rather than as a big-bang restyle. The z-index magic numbers (1…9999999) collapse into 4 tokens.
- **Window manager:** resizable windows via a bottom-right grip (authentic Win95 affordance); cascade default placement; layout persisted per window id; detail window loses forced-always-on-top in favor of normal focus order **plus** auto-focus on node select (preserves the useful behavior, kills the occlusion complaint — UX1); min/max sizes per window; double-click-maximize documented in Help.
- **Graph interaction model:** hover tooltip styled as a Win95 tooltip (yellow `#ffffe1`, 1px black border — on-theme); categories get distinct saturated hues with the magenta reserved for "Uncategorized"; legend generated from live data; "find" zooms to matches; physics panel gains a "freeze layout" toggle (pins simulation, the retro equivalent of a screensaver toggle). Particle animation becomes an event (on hover/select paths) rather than ambient noise.
- **Responsive behavior:** under 768px the desktop metaphor becomes a "kiosk mode": every window full-screen, taskbar = tab bar, Start menu = full-screen menu. The metaphor survives (titlebars, bevels, sounds) without pretending a 375px screen is a desktop.
- **Accessibility passes:** as increment 7 — focus outlines in the dotted retro style already used on buttons, ARIA dialog semantics, reduced-motion, color+glyph status in the terminal (`[OK]/[ERR]/[WARN]` prefixes are period-authentic anyway).

---

## 4. Decisions needed from you

| # | Question | Recommended | Tradeoffs |
|---|---|---|---|
| **D1** | The Vercel proxy (`api/ai-proxy.js`): **delete** it, or harden it (target allowlist + origin check + rate limit)? | **Delete.** Restores the true zero-backend model and removes the SSRF surface (FINDINGS C1). Ollama users run the app locally where `OLLAMA_ORIGINS` solves CORS properly; document that in Help. | Deleting drops "custom CORS-less endpoint" support on the hosted demo. Hardening keeps it but makes you operator of a (gated) proxy forever — auth, abuse, quotas. |
| **D2** | Star cap: keep **500**, or raise (~2000) after graph-perf work? | **Keep 500 now, surface it in the UI**; revisit after increment 6 ships and we can measure. | Raising earlier serves power users but multiplies AI cost ~4× and risks the exact perf/readability issues we're fixing. |
| **D3** | Mobile strategy: **adaptive kiosk mode** (full-screen windows <768px), scaled-down desktop, or desktop-only notice? | **Kiosk mode** (increment 8). | Scaled desktop is cheaper but stays unusable (tiny targets); a "desktop only" notice is cheapest and honest but writes off mobile traffic. |
| **D4** | Window manager: keep the **custom implementation** (rewritten per increment 4) or adopt a library? | **Keep custom.** It *is* the product's identity, the rewrite is ~300 lines, and no maintained library matches the Win95 model without heavy skinning. | A library would give resize/snap for free but adds bundle weight and fights the aesthetic. |
| **D5** | AI semantic links: compute **within batch (+already-seen repos)**, or add a second global cross-batch pass? | **Per-batch.** Simpler, half the tokens, and clusters are category-driven anyway. | Loses some cross-batch "related" edges. The global pass can be added later behind the same interface if maps feel sparse. |
| **D6** | Add `@testing-library/react` + `jsdom` as devDeps for component/hook tests? | **Yes** — increments 4-5 are not safely shippable without them. | Two devDeps and slightly slower CI; no runtime cost. |
| **D7** | Offer a "session-only, don't persist API key" option in Settings? | **Yes, as an opt-in checkbox** (default stays persisted — current behavior). | Small UI/state complexity; users who opt in re-enter keys per visit. |

---

## 5. Risk register

| Risk | Increment | Could break | Verification | Rollback |
|---|---|---|---|---|
| Proxy deletion strands a real user of the hosted custom-provider path | 1 | Custom-provider flow on git-starmap.vercel.app | Help copy + Settings hint shipped same PR; provider still works on localhost | Revert PR; proxy is one self-contained file |
| Batched prompts change category granularity (LLM sees fewer repos at once → different groupings) | 3 | Quality of category clustering | Side-by-side run on a real account before merge; categories count sanity-check in tests | Batch size is a constant; revert to single-shot is one code path |
| Window-manager rewrite breaks drag/focus/maximize edge cases (StrictMode double-mount, touch) | 4 | Core desktop interaction | Reducer tests + RTL tests + manual parity checklist (drag bounds, taskbar minimize, detail focus, touch drag) executed on the PR | Old WindowFrame kept in the PR history; single revert restores it. Increment is UI-only — no data-shape changes |
| Storage schema migration (`gitstars.*` → `gitstars.v2.*`) loses users' caches/settings | 2 | Saved settings, cached maps | One-time migration reads old keys, writes new, leaves old untouched for a release; migration unit-tested | Old keys still present → revert reads them again |
| Position-preserving graph updates fight force-graph internals (library merge behavior was flagged *ambiguous* in AUDIT §8) | 6 | Filter toggling, layout stability | Spike first: confirm library's `graphData()` node-identity merge semantics empirically before committing the approach | Fall back to current rebuild-and-reheat (status quo) |
| Kiosk-mode media query interacts badly with maximize state | 8 | Window rendering at boundary widths | RTL tests at 767/768/769px; manual resize sweep | Mode gate is one hook; disable to restore desktop-everywhere |
| Re-render optimization (memoization) introduces stale-prop bugs | 5 | Any window content | RTL interaction tests; React DevTools profile in PR review | Remove `memo` wrappers — perf regresses, correctness returns |
| App decomposition silently changes indexing semantics (cache writes, error logs) | 5 | Index→cache→render pipeline | `useIndexing` tests pin current semantics *before* extraction (characterization tests written against old App first) | Revert PR; services untouched by this increment |

**Cross-cutting rollback strategy:** every increment is one revertable PR with CI (from increment 0) as the gate; no increment changes both a data schema and UI in the same PR; the storage migration is the only irreversible-ish step and it deliberately preserves old keys for one release.

---

## 6. Out of scope

- **Framework/language migration** (no Next/Svelte/etc., no TypeScript conversion) — nothing in Phase 2 makes the stack untenable; TS would multiply every PR's size for marginal gain at 3.7k lines.
- **Any server backend, accounts, or server-side rate limiting** — zero-backend model preserved (D1's *deletion* option strengthens it; hardening option is the only flagged exception).
- **3D graph / WebGL renderer swap** — force-graph 2D canvas is adequate at the 500 cap (D2).
- **E2E browser suite (Playwright/Cypress)** — RTL + unit coverage is the right cost/benefit now; revisit if regressions slip through two releases.
- **Visual redesign away from Win95** — explicitly preserved.
- **i18n, theming beyond CRT toggle, PWA/offline support, GitHub OAuth flow** (PAT entry stays).
- **Raising the 500-star cap** (deferred behind D2 and increment 6 measurements).

---

*Plan ends here. Awaiting approval (and answers to D1-D7) before any code is written.*
