# FocusAnchor ⚓

A 5-second sensory anchor that interrupts automatic scrolling and "freeze" states, then offers a gentle grounding step. 100% on-device: no accounts, no backend, no analytics. Not a medical device and not a substitute for professional care.

Live: https://mat1505455-max.github.io/focus-anchor-MVP/ (PWA) and `/landing/` (landing page + privacy policy). GitHub Pages deploys from `main` / root, so every push redeploys in 1-2 minutes.

## What's in the repo

| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js`, `pacer.js` | The mobile PWA (plain HTML/CSS/JS, no build step) |
| `extension/` | Chrome extension (Manifest V3) that shows the same anchor before sites on a blocklist |
| iOS Shortcut | Apple Shortcut + App-Open automation that launches the PWA (see "iOS Shortcut" below) |
| `landing/` | Landing page and privacy policy |
| `fonts/` | Heebo (Latin subset), bundled locally. A copy lives in `extension/fonts/` |
| `store/listing.md` | Chrome Web Store listing text and permission justifications (submission is on hold) |

## PWA flow

1. **Welcome** (first visit only): ask for a name, saved in `localStorage`. Returning users skip straight to the anchor.
2. **Anchor:** warm message (3 rotating variants) and a hold-to-anchor circle. Hold 5 s with a progress ring, per-second visual beat, tones and vibration where supported. iOS has no Vibration API, so the visual beat and audio are the fallback.
3. **Task card:** one of 61 grounding tasks. Timed and breathing tasks get an interactive pacer (phase text, countdown, progress bar). Plain tasks get an "I did it" button that unlocks after 5 s. "Give me another" rerolls. "Done, thanks" is always available.
4. **Completion:** a rotating light-hearted message with a small offline SVG animation, and a quiet "Do another".

## Task data

`GROUNDING_TASKS` entries are plain strings, or objects with timer metadata (see `pacer.js`):

```js
{ text, durationSeconds }                                   // timed
{ text, phases: [{ label, seconds, type, optional }], cycles }   // breathing pacer
```

Breath holds are gentle and always optional. Picks never repeat back-to-back (last pick persisted in `localStorage`).

## Chrome extension

- `host_permissions` cover a short starter list only. Other sites are added from the popup via `chrome.permissions.request` (optional host permissions), and a single dynamic content-script registration is kept in sync with the blocklist.
- SPA navigation (e.g. YouTube) is detected inside the content script (Navigation API, `popstate`, `hashchange`, href poll), so no `webNavigation` permission.
- While the overlay is open, page audio/video is paused and re-paused if it restarts.
- "Continue to {site}" stays hidden until the task is done. "Close this tab" is always the primary action.
- Heebo is delivered to the overlay as bytes from the background script and registered with `FontFace`, so no web-accessible resource and nothing for a host page's CSP to block.
- Data (name, blocklist, pause-free minutes, a capped local event log) lives in `chrome.storage.local` only.

To try it: `chrome://extensions` -> Developer mode -> Load unpacked -> select `extension/`.

## iOS Shortcut (app-open trigger)

Safari can't intercept other apps, so on iPhone the PWA is paired with an Apple Shortcut that opens FocusAnchor when you launch a distracting app (Instagram, TikTok, etc.).

**Setup**
1. Install the pre-built "Focus Anchor" Shortcut from its iCloud link: https://www.icloud.com/shortcuts/c3f81e1d7e2348d088c7426d878a7f3b
2. In the Shortcuts app -> Automation -> New Automation -> **App** -> pick the apps to interrupt -> **Is Opened**.
3. Choose **Run Immediately** (so no confirmation banner appears), then select the "Focus Anchor" Shortcut.

**Cooldown**
- To avoid being interrupted on every launch, the Shortcut enforces a 10-minute cooldown between triggers.
- On each run it reads a timestamp from `Shortcuts/focus_cooldown.txt` in iCloud Drive. If less than 10 minutes have passed, it exits silently; otherwise it opens the PWA and writes the new timestamp.
- Optionally it can show a silent notification banner with the minutes of cooldown remaining.
- Everything stays on your device and in your own iCloud Drive. There is no server, account or analytics, and the Shortcut contacts nothing but the PWA page itself.

To change the cooldown, edit the time comparison in the Shortcut. Delete `focus_cooldown.txt` to reset it.

## Design system

Cream `#FDFBF7`, sage `#8A9A86` (fill only), deep ink `#1F2A24`, forest `#2C4535`. Sage is ~2.9:1 on cream, so it is always paired with an ink outline or text, and states never rely on color alone. Animations use `transform`/`opacity` and respect `prefers-reduced-motion`.

## Developing

- Syntax check: `node --check app.js` (and the files in `extension/`).
- `pacer.js` exists twice (root and `extension/`) and must stay identical. The task list is likewise duplicated in `app.js` and `extension/data.js`.
- No automated tests yet. Verify in a browser (F12 device toolbar) and on a real iPhone; hard-refresh the live site to avoid cached copies.
- Don't break the anchor's touch handling: `touch-action: none`, the `touchstart` `preventDefault`, and the `startGrounding` / `stopGrounding` guards.
