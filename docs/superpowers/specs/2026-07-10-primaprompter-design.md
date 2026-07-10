# PrimaPrompter — v1 Design Spec

**Date:** 2026-07-10
**Status:** Design direction + screen inventory APPROVED by owner (2026-07-10); revised per product-brain spec review (approve-with-redlines, all 9 adopted). Wireframes pending → operator visual approval is the gate before any implementation.
**Author:** Mayank Gupta

This spec is the reconciled output of a research-and-synthesis workflow and an independent product-owner review, with the camera-feasibility claims adversarially verified. It is the single source of truth for the wireframes and the subsequent implementation plan.

---

## 1. Product

**PrimaPrompter** is a free, open-source, cross-platform (iOS + Android, single codebase) **teleprompter camera app**: record video while reading a scrolling script overlaid near the lens so the speaker keeps eye contact. Published to the Apple App Store and Google Play.

**Positioning wedge.** The paid incumbents (BIGVU, Teleprompter.com, PromptSmart, Teleprompter Premium) monetize aggressively — launch-screen paywalls, trial-to-charge surprises, watermarks, "I bought it, now it's a subscription." The loudest complaint in the category is billing, not features. Separately, **no** existing project is a polished cross-platform *native* teleprompter-camera recorder with pro controls: the open-source recorders are iOS/macOS-only or web; the cross-platform OSS ones (e.g. TiefPrompt) don't record. That white space is PrimaPrompter's exact target.

We win by making the **core loop flawless and nag-free** — script → eye-contact recording → clean take in Photos — and by exposing **pro camera controls nobody else fully surfaces** (60fps + 4K, tap-to-focus, exposure compensation, the stabilization ladder). "Free and open source, forever; your footage never leaves the device" is the honest, sharp answer to the market's #1 pain, and goes on the store page as a feature.

## 2. Locked owner decisions

- **Scope:** "Pro studio" — full-featured, shipped in stages (v1 defined below).
- **Data:** **on-device only** — no login, no backend, no cloud, no analytics.
- **Positioning:** absolutely free + open source (public repo), published to both stores. No paywall / accounts / monetization.
- **Primary format:** **vertical-first 9:16** (Reels / TikTok / Shorts); landscape is a v2 polish item.
- **Process:** design-first; every screen wireframed and **visually approved by the operator before any code**.

## 3. Tech stack

**React Native + [react-native-vision-camera 4.7.3](https://github.com/mrousavy/react-native-vision-camera)** as the capture engine, with the teleprompter composited as plain RN views over the `<Camera>` preview.

- **Capture:** react-native-vision-camera **4.7.3** (MIT — the Expo-plugin line). Maps the underlying AVFoundation / Camera2 device formats to first-class JS props: fps (incl. 60), resolution (incl. 4K) via format selection, codec (H.264/HEVC via `startRecording` options), video HDR, video stabilization mode, torch, zoom, focus, exposure. All controls are **device-gated** — the UI queries supported formats and only offers what the device reports.
- **Animation / gesture:** react-native-reanimated (UI-thread-driven prompter scroll — the native driver, never JS-thread during encode) + react-native-gesture-handler (pinch-zoom, tap-focus, drag-scrub). *No frame-processor deps in v1 (no `react-native-worklets-core`) — add only if the spike proves a need.*
- **Storage:** op-sqlite (relational: scripts, folders, take metadata) + react-native-mmkv (key-value prefs).
- **Shell:** Expo dev-build (config plugin + expo-dev-client) **or** bare RN — resolved by the week-1 device spike. Expo Go cannot load native camera code; a custom dev-build is mandatory from day one.
- **Navigation:** @react-navigation/native (native-stack).

**Verified corrections** (adversarial verification, accepted):
- Use **v4.7.3** — the earlier "use v5" research claim was wrong for Expo: v5.1.0 ships **no** Expo config plugin (`app.plugin.js` absent → `expo prebuild` fails), while the 4.7.x line is Expo-ready. Bootstrap-verified 2026-07-10; the native build vs RN 0.86 / SDK 57 is spike-validated.
- Exposure control is **exposure-compensation bias** (a brightness bias around auto-exposure), NOT manual lens position/ISO/shutter, and NOT a true AE/AF lock — vision-camera 4.7.3 exposes no lock/exposureMode API (`exposure` is compensation, not absolute), so AE/AF lock is deferred to v1.1/v5. UI copy must never promise "manual exposure" or "lock."
- **cinematic / cinematic-extended stabilization are iOS-only**; Android exposes off / auto / standard. HEVC is device-dependent on Android. This is handled by the capability-driven UI.

**Rejected alternatives:** Flutter (official camera plugin hides codec/HDR/exact-format/60fps; forces plugin fork or single-vendor lib), Kotlin/Compose Multiplatform (no mature pro-video camera lib; effectively writing native twice), native twin apps (violates the single-codebase lock; reserved only as documented fallback for any single control that proves unreachable in Vision Camera).

## 4. v1 screen inventory (~12 wireframe artifacts incl. states)

| # | Screen | Type | Purpose |
|---|--------|------|---------|
| 1 | **Script Library** | destination (home) | Browse/manage scripts + folders; entry to record. Includes a guided empty-state. |
| 2 | **Script Editor** | destination | Create/edit plain-text scripts with **passive** color-coded cue tags (`[pause]`, `[look left]`); live word count + est. duration. |
| 3 | **Record — idle** | destination | THE core screen: full-bleed 9:16 preview, teleprompter band pinned high near the lens, reachable capture controls. |
| 4 | **Record — recording** | state of #3 | Controls collapse to elapsed time + pause-scroll + stop; all else hidden to prevent mis-taps. |
| 5 | **Capture Settings** | sheet over Record | Capability-driven camera controls (see §5.2). |
| 6 | **Prompter Appearance** | sheet over Record | Font / size / line-height / band opacity / default WPM / dyslexia fonts / high-contrast / mirror-text. |
| 7 | **Take Review** | destination (auto on stop) | Play / keep / retake / discard. This *is* the multi-take manager. |
| 8 | **Trim-Lite** *(spike-gated)* | destination | Single-clip **non-destructive** passthrough trim (in/out handles); entered from Take Review and Gallery. |
| 9 | **Takes Gallery** | destination | Takes grouped by script; save-to-Photos / share; per-take size + free space. |
| 10 | **Settings / About** | destination | Storage management; **opt-in "Share diagnostics" row**; privacy statement; public-repo + license link; version. |
| 11 | **First-run permission prime** | modal state | Camera/mic rationale before the system dialogs + one-card eyeline pitch. Not a navigable onboarding screen. |

**Navigation / IA:** stack-based, anchored on Script Library as home. Primary flow: Library → (tap script) Editor **or** straight to Record → Capture Settings as needed → stop → Take Review → (Trim-Lite) → save/share. At most two tabs (Library, Settings); the record/review chain is a pushed stack so the creator stays in a focused linear shooting workflow. No login, no cloud, no onboarding gate beyond permission priming.

## 5. Core UX

### 5.1 Teleprompter
- **Eyeline (pinned reading-line model):** the active line is fixed in a high band (top ~12–22% of the 9:16 frame, offset below the notch/Dynamic Island safe area) and words flow *through* that fixed height rather than a full-screen block scrolling past. Keeps the eyes at one vertical position directly under the front lens. The reading line is user-draggable to match exact lens position, with a subtle lens-direction cue. **Pure optical geometry — no AI gaze correction.**
- **Scroll:** WPM-calibrated constant auto-scroll (default ~130 WPM), exposed as **words-per-minute**, with a **fine live edge slider** reachable during the take. Plus: large tap-to-pause/resume zone on the band, drag-to-scrub to any line, 3-2-1 countdown that arms recording + scrolling together, hardware-button start/stop. Speed remembered **per script** (`Script.wpmOverride`, falling back to the global default). Scroll auto-stops at end; recording keeps rolling (outros).
- **Hardware start/stop:** volume-button start/stop is **Android v1** (trivial keycode; bonus — cheap Bluetooth shutter remotes emulate volume keys, delivering half the deferred "remote" feature for free). On **iOS** it is OS-gated: the sanctioned API (`AVCaptureEventInteraction`, ~iOS 17.2+ — verify in spike) postdates our iOS 15 floor and pre-API volume hacks risk store rejection, so it's hidden below the verified version.
- **Cue tags are v1-passive:** color-highlighted in the editor and the prompter band, **excluded** from word-count / WPM / duration math, and they trigger **no** behavior (`[pause]` does not auto-pause the scroll). Behavior-triggering cues are v2.
- **Mirror text** OFF by default, labeled "for beam-splitter rig," tucked in advanced settings. Kept strictly separate from front-camera selfie preview mirroring and the optional "flip saved video" setting.
- **Formatting:** semi-transparent dark scrim behind the reading band only (never full-screen); white text with stroke/drop-shadow; adjustable band opacity; ~36–48pt-equivalent sans, line height 1.5–2.0, 2–4 lines visible; active line highlighted, neighbors dimmed. **Accessibility from day one:** OpenDyslexic + Lexend fonts, independent size/line-height/opacity, high-contrast theme, Dynamic Type, VoiceOver/TalkBack labels, min touch targets.

### 5.2 Recording controls
- **Exposed:** front/back toggle; resolution (1080p/4K, format-gated); fps (24/30/60 where the format supports); codec (H.264/HEVC); video HDR (default-off, gated on `format.supportsVideoHdr`); stabilization (off/standard/cinematic/cinematic-extended/auto, platform- and format-gated); torch; continuous pinch zoom; tap-to-focus + exposure-compensation (AE/AF lock deferred to v1.1 — no API in vision-camera 4.7.3); grid; output orientation locked vertical-first.
- **HDR dependency rider:** HDR typically requires HEVC/10-bit — **H.264 + HDR is invalid on most devices**. The "grey out impossible combos" logic must cover the full **codec × HDR × fps** dependency matrix (spike-verified), not just single controls.
- **Flip-saved-video (fenced):** ships v1 **only if** the SDK writes the mirror at record time (an `isMirrored`-style option — spike-verify). If it needs a re-encode, it defers to v2 with export presets. Not shown in wireframes until verified.
- **Hidden** (out of scope): manual ISO/shutter, white balance, RAW, filters/beauty effects.
- **Defaults:** vertical 9:16, **front (selfie) camera**, 1080p @ 30fps, H.264, standard stabilization ON, HDR off, auto exposure/focus, torch off, countdown ON at 3s. Heavy triples (4K@60 + HDR + cinematic) are opt-in, discovered by filtering device formats, with graceful degradation + a warning. Remember last-used camera after first launch. Torch control appears contextually (rear-only).

## 6. Editing (deliberately light)
Single-clip **Trim-Lite** + (later) export presets — explicitly **not** a multi-track timeline. A direct bet against BIGVU's slow/buggy heavyweight editor.
- **v1:** per-script multi-take management, in-app playback/scrub, single-take trim, save to Photos/Files + system share, re-record CTA.
- **Trim is non-destructive:** trimming writes a **new** take (file + row, `Take.trimmedFromTakeId` for lineage + a gallery badge); the original is retained, and the success view offers a one-tap "delete original." Passthrough-first, with one re-encode fallback path.
- **v2:** per-platform export presets (Reels/TikTok/Shorts 1080×1920 + source passthrough) — deferred because presets require a transcode pipeline, whereas passthrough trim does not.

## 7. Data model (on-device)
- **SQLite (op-sqlite):**
  - `Folder` (id, name, timestamps, sortOrder)
  - `Script` (id, folderId?, title, body w/ inline cue markup, wordCount, **wpmOverride?** (nullable → global default), timestamps, lastUsedAt)
  - `Take` (id, scriptId, fileUri, thumbnailUri, durationMs, width, height, fps, codec, cameraPosition, fileSizeBytes, isKeeper, **trimmedFromTakeId?** (nullable lineage), createdAt — video files live on the app-sandbox filesystem, not in the DB)
  - *(`ExportRecord` is deliberately NOT in the v1 schema — added when export presets land in v2. No speculative tables in a public OSS schema.)*
- **MMKV:** `CaptureSettings` (last-used + named presets), `TeleprompterPrefs` (global defaultWpm, fontSize, lineHeight, bandOpacity, fontFamily, highContrast, readingLinePosition, mirrorText, countdownSeconds), and the diagnostics opt-in flag.

## 8. v1 cut

**Included:** Script Library (folders + search + CRUD); Script Editor (passive cue tags + duration); Record (pinned high-band teleprompter, scrim band + focus highlight, draggable reading line, live WPM slider, tap-pause, drag-scrub, countdown, hardware start/stop, progress); full capability-gated Capture Settings; multi-take management; **Trim-Lite** (spike-gated, non-destructive); Prompter appearance/accessibility settings; mirror-text expert toggle; **opt-in diagnostics** (minimal on-device ring-buffer log + "Share diagnostics" row in Settings — data leaves only via the user's own share action); permission priming; public repo + license; no analytics.

**Deferred to v2+:** export presets; voice-follow (on-device ASR only, opt-in, confidence-hold fallback); **teleprompter-only mode** (no camera, full-screen mirrored prompter for external-rig users — the loudest OSS audience) — v1.1; Apple Watch + second-device Host/Join + BT remote button-mapping; bionic-reading + deep RTL/multilingual; cloud/Drive script sync (v1 does one-shot `.txt` document-picker import only); behavior-triggering cue tags; live video effects; any AI.

**Trim-Lite spike gate:** Trim-Lite rides the week-1 device spike. If Android passthrough trim + fallback exceeds ~3–4 dev-days, Trim-Lite auto-drops to v1.1 — no renegotiation.

## 9. Non-screen acceptance criteria (v1 hard requirements)
- **Keep-awake** during record/prompter.
- **Interruption-finalize:** phone call / backgrounding / storage-full / thermal shutdown / **Bluetooth-mic route-change mid-take** → the in-progress take is **finalized and saved, never lost** (minimum on BT route-change: no crash, take survives — spike-verify SDK behavior).
- **Storage guard:** estimate MB/min vs. free space; warn before a take that won't fit.
- **Portrait lock** (vertical-first).

## 10. Risks
- **Hardware-gated format combos** (4K@60 + HDR + cinematic; and the codec×HDR×fps matrix) → query formats, grey out impossible combos with a plain reason, degrade gracefully.
- **Scroll jank while encoding** on low-end Android → prompter scroll runs on the **UI thread (native driver)**, never JS-thread during 4K encode; one low-end Android in the test loop.
- **Take loss on interruption/storage-full** — the unforgivable failure → §9 acceptance criteria.
- **Android OEM Camera2 quirks** → tested-device matrix, feature-detect, safe fallbacks; native CameraX as documented fallback for any single unreachable control.
- **Trim/export pipeline** heavy/fragile/licensing-encumbered → keep editing light; prefer platform-native passthrough (AVAssetExportSession / Media3 Transformer); **avoid ffmpeg-kit** (retired/archived + LGPL weight — verify before adopting any fork).
- **Gesture collision** (tap-pause vs tap-focus) → distinct gesture zones (band vs preview) + dedicated pause control; validate in wireframe review.
- **OSS sustainability** → clear CONTRIBUTING, good-first-issue labels, published wireframes/architecture docs, tight modular feature structure.

## 11. Owner decisions (recommendations; proceeding unless redirected)
1. **License → Apache-2.0** (patent grant, built-in contribution licensing, store-safe, F-Droid-compatible). Reversed from an initial GPLv3 lean because GPL collides with Apple's App Store ToS once outside contributors appear (VLC-2011 precedent). MIT acceptable if maximal simplicity preferred. **LICENSE file must land before the repo goes public.**
2. **Diagnostics → opt-in, user-shared local log** (nothing auto-leaves; keeps "no collection" literally true on the Play data-safety form). Now reflected in the v1 cut (§8) and Settings (§4 #10).
3. **Brand:** final name / icon / bundle IDs; publish under existing Primakor Apple/Play accounts or new ones. (Wireframes use "PrimaPrompter" as the working name.)
4. **Min-OS floor → iOS 15+ / Android 10+** (pending spike verification against v5 minimums; note the iOS-15 floor is why volume start/stop is Android-only in v1).
5. **Launch → 1–2 week TestFlight / internal-track soak, then simultaneous public.**

## 12. Open items
- **Week-1 device spike (MANDATORY de-risk)** on **both real devices**, run in parallel with wireframe approval: scroll overlay perf during 4K/60 encode; camera format query + graceful degrade; **codec × HDR × fps dependency matrix**; interruption-finalize (incl. BT-mic route change); Android passthrough-trim feasibility (gates Trim-Lite); **record-time mirroring** support (gates flip-saved-video); **iOS volume-button API availability** (`AVCaptureEventInteraction` version); Expo-dev-build vs bare RN decision. If the camera/scroll assumptions fail on Android, the stack reopens.
- **Store-publishing research** (Apple privacy manifest, Play Data Safety, camera-app review gotchas) — one research pass failed during synthesis; re-run at submission time. Not needed for wireframes.

## 13. Process / next steps
1. Produce wireframes for all §4 screens (frontend-design) → **operator visual approval (gate).**
2. Write the implementation plan (writing-plans).
3. Repo scaffolding + LICENSE (before public) + week-1 device spike.
4. Build v1 against the approved wireframes.
