# FINDINGS.md — Evaluation of the GitHub Stars Visualizer

**Input:** AUDIT.md (2026-06-12, commit `15b0b4c`). Each finding cites the audit section and the underlying file:line evidence. Quality bars assessed: maintainability, separation of concerns, testability, accessibility, mobile usability, perceived UI polish, runtime performance — plus the requested UI/UX deep-dives.

Severity scale:
- **Critical** — security exposure or a failure mode that breaks the core flow for real users today.
- **High** — materially blocks maintainability/testing, or degrades the primary experience for a large user segment.
- **Medium** — real cost, but bounded; workarounds exist.
- **Low** — polish, hygiene, drift.

---

## CRITICAL

### C1. `api/ai-proxy.js` is an unauthenticated open proxy (SSRF surface)
**Evidence:** AUDIT §6.3 — accepts any `http:`/`https:` `targetUrl` (`api/ai-proxy.js:29-31`), `Access-Control-Allow-Origin: *` (`:3`), no auth, no target allowlist, forwards client-supplied bearer tokens (`:37-39`).
**Why critical:** Any website, bot, or script on the internet can use the deployed Vercel function as a free server-side request forwarder — to reach internal Vercel-network endpoints, to launder traffic, or to burn the project's serverless quota. This is the one place the app's "client-side only" security story is actually breached, and it was added as a CORS workaround for Ollama (commit `15b0b4c`), not as a designed feature. It also contradicts the README's "no proxy servers" promise (`README.md:73,77`).
**Impact bars:** security, separation of concerns (the zero-backend model is silently no longer true).

### C2. AI analysis sends *all* repos in one prompt and silently degrades on failure
**Evidence:** AUDIT §2.2 — single prompt with up to 500 repos (`aiAnalysis.js:49-56`, fetch cap `github.js:9`); no batching, no token-limit guard; `analyzeStars` never throws (`aiAnalysis.js:89,127,137`); fallback silently substitutes language-as-category; only signal is one ⚠️ line in a scrolling log (`:91`).
**Why critical:** This breaks the *advertised core feature* (AI categorization + semantic links) at exactly the scale the product targets. A 300-500 repo prompt routinely exceeds output-token limits → truncated JSON → heuristic partial recovery or full fallback → user gets a "language map" believing it's an AI map, with stale results then cached indefinitely (`App.jsx:321-322`, invalidated only on username change). Correctness failure masquerading as success.
**Impact bars:** correctness, perceived polish, testability (the failure path is invisible).

---

## HIGH

### H1. `App.jsx` is a 708-line god component
**Evidence:** AUDIT §1, §3, §4 — 14 state atoms, window manager, indexing orchestration, cache I/O, ~100-line inline indexer modal (`App.jsx:494-591`), graph-window header JSX (`:609-645`), shutdown screen; imports everything; zero Context; setters passed raw as props (`:646-657`).
**Why high:** Every feature change passes through one file; window-manager logic, data pipeline, and presentation are interleaved, so none can be unit-tested or modified in isolation. This is the single largest drag on maintainability and the root cause of the component test gap (H3).

### H2. The window manager state is split and lossy
**Evidence:** AUDIT §3 — initial x/y live in App's `windows` state but live position is local to `WindowFrame` and never written back; no resize affordance (fixed 320-640 px sizes, `App.jsx:92-140`); detail window force-elevated above all in three separate code paths (`App.jsx:166-172,199-203,375-378`); z-order layering depends on uncoordinated magic numbers (1-10 windows, 99999 modal, 9999 taskbar, 999999 CRT — AUDIT §8).
**Why high:** Two sources of truth for position means App can never correctly persist, tile, cascade, or restore windows; the "always on top" special case is duplicated logic that will desync; the z-scheme works by luck. This blocks essentially every window-ergonomics improvement.
**Impact bars:** maintainability, separation of concerns, UI ergonomics (see UX1).

### H3. Tests cover the wrong or narrowest surface
**Evidence:** AUDIT §5 — `fetchStarredRepos` (the function the app calls) has **zero tests**; all 4 github tests target the unused `fetchStarredReposPaged`; openai/groq router branches untested (`aiRouter.js:46-64`); App.jsx, all 8 components, audio.js, ai-proxy.js untested; no CI workflow; README/CONTRIBUTING test counts stale (15 / 26+ vs actual 27).
**Why high:** The pagination loop, cap/slice, and error paths of the only production GitHub fetcher are unverified, and the entire interactive layer (window manager, indexing orchestration, cache I/O) has no safety net — which makes any refactor (the point of Phase 3) high-risk until this is fixed.

### H4. Unusable on mobile and small screens
**Evidence:** AUDIT §3 (fixed window sizes), CSS audit — fixed-pixel chrome assumes ≥1024 px; the only media queries live in dead `App.css`; graph window is 640×480 absolute-positioned; touch support exists *only* for window drag (`WindowFrame.jsx:57-91`); no `touch-action` CSS; desktop icons/start menu sized for mouse (16×14 px window buttons).
**Why high:** A Vercel-hosted, README-promoted demo app gets a large share of mobile/first-click traffic; today those users get overlapping fixed windows wider than their viewport and 14 px tap targets. Entire quality bar (mobile usability) is unmet rather than degraded.

### H5. Secrets handling is weaker than the architecture requires
**Evidence:** AUDIT §6.1-6.3 — PAT + AI keys in plaintext `localStorage['gitstars_settings']` (`App.jsx:217`); Gemini key in URL query string (`aiRouter.js:21`); keys forwarded through the proxy body for custom providers (`aiRouter.js:70`, `api/ai-proxy.js:38`).
**Why high (not critical):** localStorage-for-user's-own-keys is an accepted tradeoff of the zero-backend model and no XSS vector was found (no `dangerouslySetInnerHTML`, AUDIT §6.10). But the Gemini query-string key (logged by proxies/CDNs as part of URLs) and routing keys through C1's open proxy are avoidable aggravations, and a blanket `localStorage.clear()` on reset (`App.jsx:236`) nukes unrelated origin data patterns. Session-scoped or non-persisted key options don't exist.

---

## MEDIUM

### M1. Graph readability does not scale (see also UX2)
**Evidence:** AUDIT §2.3, §2.4, §7.2 — all category nodes share one color `#ff00ff` (`graphBuilder.js:43`); 12-language color map with single fallback; labels appear only past zoom 0.15 (`GraphWindow.jsx:70`) with no hover tooltip — identification below that threshold requires click+DetailWindow; legend lists fixed entries, not the data's actual languages; filter changes feed a fresh object to `graph.graphData()` restarting layout (`:224`), so positions aren't preserved across filter toggles.
**Why medium:** At 200+ nodes the map is functional but anonymous (dots without names, categories indistinguishable from each other); at the 500-repo cap, semantic-particle motion + reheat-on-filter makes exploration disorienting. Not data loss, but the core visualization under-delivers.

### M2. Always-on animation cost with no opt-out
**Evidence:** AUDIT §7.2, §7.6 — infinite 0.15 s opacity keyframe on the root (`index.css:66-74`) forces continuous compositing even when idle; 3 animated particles per semantic link keep the rAF loop hot after layout settles (`GraphWindow.jsx:104-107`); **no `prefers-reduced-motion` anywhere** (CSS audit §8).
**Why medium:** Battery/CPU drain on laptops and phones, and an accessibility violation (vestibular motion with no respect for OS-level preference). CRT overlay itself is cheap (static gradients) — the flicker animation and particles are the actual cost. Fix is small; impact is constant.

### M3. Canvas is not DPR-scaled
**Evidence:** AUDIT §2.4, §7.3 — ResizeObserver passes CSS pixels to `graph.width/height` (`GraphWindow.jsx:187-193`); no devicePixelRatio handling in app code (library behavior ambiguous, AUDIT §8).
**Why medium:** On retina/high-DPI displays (most laptops), the entire centerpiece visualization may render at 1× and look blurry — directly hurting perceived polish. Needs an empirical check first since the library may handle it (flagged ambiguous in audit).

### M4. Whole-tree re-renders from App-level state
**Evidence:** AUDIT §7.4 — search keystrokes update App state re-rendering every window; no `React.memo` anywhere; GraphWindow protects only the canvas via refs (`GraphWindow.jsx:28-33,237-244`).
**Why medium:** With four windows the cost is tolerable today; it becomes the bottleneck the moment windows multiply or graph metadata grows. It's also a symptom of H1 — fixing the architecture mostly fixes this.

### M5. Accessibility gaps beyond motion
**Evidence:** CSS audit §8 — inputs rely on background-color change instead of focus outlines (`index.css:223,230-232`); terminal log status conveyed by color alone (green/red/yellow/cyan, `index.css:433-451`); no ARIA roles on windows/taskbar/menu (none found in any JSX); window drag/focus is mouse/touch-only — no keyboard path to move, focus-cycle, or close windows besides tabbing to the close button; title-bar contrast borderline AA at gradient's light end.
**Why medium:** Keyboard users can operate forms and buttons (focus-visible exists on `.win95-btn`, `index.css:195-198`) but cannot meaningfully use the desktop metaphor; screen-reader users get no landmark/dialog semantics at all.

### M6. Cache and storage correctness edges
**Evidence:** AUDIT §6.7, §6.9 — no schema validation on cached JSON (`App.jsx:21-54`); no quota-exception strategy for 500-repo writes (`:320-333`); caches invalidated only on username change; `localStorage.clear()` also wipes the rate limiter and settings (`:236`).
**Why medium:** Failure modes are rare but confusing when hit (stale shapes after a format change render wrong; quota overflow silently loses the cache).

### M7. Duplicated/divergent GitHub fetchers
**Evidence:** AUDIT §6.8 — `fetchStarredRepos` (used, lenient: silent break on non-array `github.js:43-45`) vs `fetchStarredReposPaged` (unused in app, strict throw `:96-98`, tested).
**Why medium:** Classic drift trap: fixes land in the tested copy, production runs the other.

---

## LOW

### L1. Dead code and dependency hygiene
**Evidence:** AUDIT §1 — `App.css` (184 lines) never imported; `@google/generative-ai` and `lucide-react` declared but unused; VT323 font downloaded but referenced by no rule; Google Fonts via render-blocking CSS `@import` (`index.css:1-5`).

### L2. Documentation drift
**Evidence:** AUDIT §5, §6.5 — README "15 unit tests" vs 27 actual; "Zero Server Backend / no proxy servers" vs `api/ai-proxy.js`; CONTRIBUTING "26+".

### L3. Client-side rate limiter is advisory
**Evidence:** AUDIT §6.4 — trivially resettable localStorage counters, failed requests uncounted. **Deliberately low:** in a bring-your-own-key app it protects users from their own quota, not the operator from abuse; that's a reasonable design as long as it isn't *presented* as a security control. (The proxy in C1 is where real server-side limiting would matter.)

### L4. Bundle is one 424 KB chunk with no splitting
**Evidence:** AUDIT §7.7 — 134.7 KB gzip, force-graph + React dominant; no dynamic imports. Acceptable for an SPA of this type; worth revisiting only if the app grows.

### L5. Scripted progress percentages
**Evidence:** AUDIT §7.9 — indexer progress is staged theater, not measured (`App.jsx:262-359`). Harmless, but means a hung AI call shows a confident half-full bar.

---

## UI/UX deep-dives (requested specifically)

### UX1. Window management ergonomics — *High, folds into H2*
What a user feels today: windows can be dragged (mouse or single-touch) and maximized, but **not resized**; the 640×480 graph window cannot be enlarged short of full-screen maximize; positions reset on every reload (positions never persist — H2's split state makes persistence impossible); the detail window cannot be sent behind anything (`App.jsx:166-172`), so it permanently occludes the graph it describes until closed; minimize exists only via taskbar tab toggle (`Taskbar.jsx:137`); window control buttons are 16×14 px (`WindowFrame.jsx:139,150`) — below any touch-target guideline; no keyboard shortcuts (no Alt-Tab equivalent, no Esc-to-close); double-click-titlebar maximize is undiscoverable and undocumented in HelpWindow.

### UX2. Graph readability at scale — *Medium-High, folds into M1/C2*
At ~200 stars: clusters form well (category springs work), but every category hub is identical magenta, labels pop in/out at one global zoom threshold rather than by node importance, and there are no hover tooltips — the click→DetailWindow→close loop is the only way to identify a dot. At 500 (the cap; 1000+ is currently unreachable, `github.js:9`): semantic-link particles (3 per link, perpetual) add motion noise; filter or physics changes reheat the whole layout so the mental map is destroyed; search highlights matching nodes but doesn't navigate/zoom to them (`drawNode` halo only, `GraphWindow.jsx:48-54`). The 500 cap itself is undocumented in the UI — users with 2,000 stars silently get a truncated map (slice at `github.js:58`).

### UX3. CRT shader — *Medium, folds into M2*
The aesthetic wins (cheap static gradients, tasteful 0.15 opacity), but the cost is concentrated in the infinite flicker keyframe — continuous compositor work for a 1% opacity pulse most users never consciously perceive. There is a CRT toggle in the tray (`Taskbar.jsx:154-165`) — good — but it doesn't persist (not in settings, lost on reload) and doesn't disable the flicker animation's wrapper when off (only conditional rendering of overlays, `App.jsx:387-391`; the `.crt-flicker` class on the root is tied to the same state — verify during implementation).

### UX4. Audio behavior — *Medium*
Every click in the app synthesizes a beep (~17 call sites, AUDIT §4) and **there is no mute control anywhere** (audio audit: no mute mechanism, `audio.js`). The floppy-seek noise loops ~1.5 s during indexing (`audio.js:85-112`). Autoplay policy is handled correctly (lazy create + resume, `audio.js:5-11`), and failures are silent — but a user who finds the sounds annoying (or is in a meeting) can only mute the whole tab. Sound is also a hard dependency of every component (widest fan-in in the codebase), which is an architecture smell on top of the UX gap.

### UX5. Onboarding / token setup — *High for first-run conversion*
First run opens Help + Settings windows (good instinct, `App.jsx:92-140`). But: the GitHub username field doesn't validate before a full fetch attempt; PAT guidance is two static links in HelpWindow; the AI section demands provider/model/key knowledge upfront with defaults buried (gemini/`gemini-2.5-flash`); "Test connection" exists for the AI key (`SettingsWindow.jsx:41-66`) but **not for the GitHub username/PAT** — the cheaper, more error-prone input; errors during indexing surface as red lines in a faux terminal the user must interpret (`App.jsx:354`); a no-AI-key path works (language-only map) but nothing tells the user that's a supported mode rather than a failure; and per C2, an AI failure is presented identically to success. The happy path is fine; every unhappy path is cryptic.

---

## Summary matrix

| # | Finding | Severity | Quality bars hit |
|---|---|---|---|
| C1 | Open serverless proxy | Critical | Security, separation of concerns |
| C2 | Single-prompt AI + silent degradation | Critical | Correctness, polish |
| H1 | App.jsx god component | High | Maintainability, SoC, testability |
| H2 | Split/lossy window-manager state | High | Maintainability, UX |
| H3 | Tests target wrong/narrow surface; no CI | High | Testability |
| H4 | Unusable on mobile | High | Mobile usability |
| H5 | Secrets handling aggravations | High | Security |
| M1 | Graph readability at scale | Medium | Polish, UX |
| M2 | Always-on animations, no reduced-motion | Medium | Performance, a11y |
| M3 | No DPR canvas scaling (verify) | Medium | Polish |
| M4 | Whole-tree re-renders | Medium | Performance |
| M5 | A11y: keyboard/ARIA/color-only status | Medium | Accessibility |
| M6 | Cache schema/quota edges | Medium | Correctness |
| M7 | Divergent duplicate GitHub fetchers | Medium | Maintainability |
| L1-L5 | Dead code, doc drift, advisory limiter, single chunk, fake progress | Low | Hygiene |
