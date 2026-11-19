// Content script. Checks the local blocklist and, on a blocked site, shows a full-screen
// overlay (inside a closed Shadow DOM) with the hold-to-anchor, then a grounding task
// and three choices. All data stays in chrome.storage.local.

const HOLD_SECONDS = 5;
const DEFAULT_PASS_MINUTES = 10;
const MAX_EVENTS = 5000;

let overlayOpen = false;

(async () => {
    // Only the top-level page, never iframes (ads, embeds)
    if (window.top !== window) return;

    await check();
    // Re-check so an expired pass brings the pause back without a page reload (SPAs, long sessions)
    setInterval(check, 30000);
    window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    watchUrlChanges();
})();

// Single-page apps change the URL without a page load. Content scripts live in an isolated world,
// so wrapping history.pushState here wouldn't see the page's own calls. Instead use the Navigation
// API (Chrome 102+), which reports same-document navigations, plus popstate/hashchange, plus a cheap
// href poll as a fallback. Everything runs on this page; no extra permission is needed.
function watchUrlChanges() {
    let lastHref = location.href;
    const onUrlChange = () => {
        if (location.href === lastHref) return;
        lastHref = location.href;
        check(); // shows the overlay if the site is blocked and no pause-free pass is active
    };

    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
    if (window.navigation && window.navigation.addEventListener) {
        window.navigation.addEventListener('navigatesuccess', onUrlChange);
    }
    setInterval(onUrlChange, 1000);
}

// Returns the matching blocklist entry, or null. "www.instagram.com" matches "instagram.com".
function matchBlocked(hostname, blocklist) {
    const host = hostname.toLowerCase();
    return blocklist.find(domain => host === domain || host.endsWith('.' + domain)) || null;
}

async function check() {
    if (overlayOpen) return;
    try {
        const { blocklist = [], passes = {} } = await chrome.storage.local.get(['blocklist', 'passes']);
        const matched = matchBlocked(location.hostname, blocklist);
        if (!matched) return;
        if ((passes[matched] || 0) > Date.now()) return;
        await showOverlay(matched);
    } catch (e) {
        // Extension was reloaded/updated and this script is orphaned: nothing to do
    }
}

async function logEvent(type, domain) {
    try {
        const { events = [] } = await chrome.storage.local.get('events');
        events.push({ t: Date.now(), type, domain });
        await chrome.storage.local.set({ events: events.slice(-MAX_EVENTS) });
    } catch (e) { /* logging is best-effort */ }
}

async function grantPass(domain) {
    const { passMinutes = DEFAULT_PASS_MINUTES, passes = {} } = await chrome.storage.local.get(['passMinutes', 'passes']);
    passes[domain] = Date.now() + passMinutes * 60 * 1000;
    await chrome.storage.local.set({ passes });
    return passMinutes;
}

// --- Audio & haptics (iOS irrelevant here; desktop Chrome plays audio after a user gesture) ---

let audioCtx = null;

function unlockAudio() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
    } catch (e) { /* audio is optional */ }
}

function playTone(frequency, durationSec) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + durationSec + 0.05);
    } catch (e) { /* audio is optional */ }
}

function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* optional */ }
}

// --- Media guard -----------------------------------------------------------
// While the overlay is open, keep the page's audio/video silent. SPAs like YouTube start playback
// asynchronously, so pausing once isn't enough: pause now, pause anything that fires a play event,
// and sweep periodically (covers media elements added after we mounted). Only runs while the overlay is open.

function pauseAllMedia() {
    document.querySelectorAll('video, audio').forEach((media) => {
        if (!media.paused) media.pause();
    });
}

function startMediaGuard() {
    const onPlay = (e) => {
        const target = e.target;
        if (target instanceof HTMLMediaElement && !target.paused) target.pause();
    };
    // 'play' and 'playing' don't bubble, so listen in the capture phase on the document
    document.addEventListener('play', onPlay, true);
    document.addEventListener('playing', onPlay, true);
    const sweep = setInterval(pauseAllMedia, 500);
    pauseAllMedia();

    return () => {
        clearInterval(sweep);
        document.removeEventListener('play', onPlay, true);
        document.removeEventListener('playing', onPlay, true);
    };
}

// --- Font ------------------------------------------------------------------
// Heebo ships inside the extension. The background script hands us the bytes and we register a
// FontFace from memory, so there is no network request, no web-accessible resource to fingerprint,
// and nothing for the host page's CSP to block. If anything fails we fall back to system fonts.

let fontPromise = null;

function loadFont() {
    if (!fontPromise) {
        fontPromise = (async () => {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'get-font' });
                if (!response || !response.base64) return;
                const bytes = Uint8Array.from(atob(response.base64), (c) => c.charCodeAt(0));
                const face = new FontFace('FocusAnchor Heebo', bytes.buffer, { weight: '100 900', display: 'swap' });
                await face.load();
                document.fonts.add(face);
            } catch (e) { /* fall back to the system font stack */ }
        })();
    }
    return fontPromise;
}

// --- Overlay ---------------------------------------------------------------

const OVERLAY_CSS = `
    /* Palette. Contrast on cream (#FDFBF7): ink 14:1, ink-soft 7:1, forest 10:1 (AAA).
       Sage (#8A9A86) is ~2.9:1 against cream, so it is only ever a fill: it is always paired with
       an ink outline (shape) and ink text (4.9:1 on sage), never relied on as the only cue. */
    :host {
        all: initial;
        color-scheme: light;
        --cream: #FDFBF7;
        --cream-deep: #F3EEE2;
        --sage: #8A9A86;
        --sage-deep: #5C6E58;
        --forest: #2C4535;
        --ink: #1F2A24;
        --ink-soft: #4A5A50;
    }
    * { box-sizing: border-box; }

    .overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        padding: 2rem 1.5rem; overflow-y: auto;
        background: radial-gradient(circle at 50% 38%, #FFFFFF 0%, var(--cream) 55%, var(--cream-deep) 100%);
        color: var(--ink);
        font-family: 'FocusAnchor Heebo', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        text-align: center;
        -webkit-font-smoothing: antialiased;
        animation: fade-in 0.5s ease-out;
    }
    .stage {
        display: flex; flex-direction: column; align-items: center;
        gap: 1.5rem; width: 100%; max-width: 34rem; margin: auto;
        animation: rise-in 0.6s ease-out;
    }
    h1 { margin: 0; font-size: clamp(1.75rem, 4.5vw, 2.4rem); font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; color: var(--ink); }
    p { margin: 0; font-size: 1.15rem; line-height: 1.7; color: var(--ink-soft); }
    .hint { min-height: 1.7em; font-size: 1rem; color: var(--ink); }

    [hidden] { display: none !important; }
    .stage-wide { max-width: 40rem; }

    /* Task card: the warm focal point of the screen */
    .task-card {
        width: 100%; padding: 2.25rem 2rem 2rem;
        display: flex; flex-direction: column; align-items: center; gap: 1.25rem;
        background: #F7EEDB; border: 1.5px solid var(--sage-deep); border-radius: 28px;
        box-shadow: 0 10px 30px rgba(92, 110, 88, 0.14);
    }
    .task-eyebrow { font-size: 0.85rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); }
    .task-text { font-size: clamp(1.5rem, 4.2vw, 1.85rem); font-weight: 500; line-height: 1.45; color: var(--ink); }
    .unlock-note { min-height: 1.7em; font-size: 1rem; color: var(--ink); }

    /* Guided timer / breathing pacer. The circle moves with transform only. */
    .pacer { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
    .pacer-visual { position: relative; display: grid; place-items: center; width: 168px; height: 168px; }
    .pacer-circle {
        position: absolute; inset: 0; border-radius: 50%;
        background: var(--sage); border: 2px solid var(--ink); will-change: transform;
    }
    .pacer-count { position: relative; font-size: 3.25rem; font-weight: 700; color: var(--ink); }
    .pacer-phase { min-height: 1.6em; font-size: 1.4rem; font-weight: 600; color: var(--ink); }
    .pacer-note { min-height: 1.5em; font-size: 0.95rem; color: var(--ink-soft); }
    .pacer-bar { width: min(18rem, 100%); height: 8px; border-radius: 999px; background: rgba(31, 42, 36, 0.15); overflow: hidden; }
    .pacer-bar-fill { display: block; width: 100%; height: 100%; background: var(--ink); transform-origin: left; transform: scaleX(0); }
    .pacer-start, .did-it { width: min(16rem, 100%); }

    /* Buttons: minimal, 48px+ targets, state changes use scale/opacity only */
    .actions { display: flex; flex-direction: column; gap: 0.75rem; width: min(22rem, 100%); margin-top: 0.5rem; }
    button {
        font: inherit; font-size: 1.05rem; font-weight: 600; cursor: pointer;
        min-height: 52px; padding: 0.8rem 1.5rem;
        border: 2px solid var(--ink); border-radius: 16px;
        transition: transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease;
    }
    button:hover { transform: scale(1.02); }
    button:active { transform: scale(0.97); opacity: 0.85; }
    button:focus-visible { outline: 3px solid var(--ink); outline-offset: 4px; }
    .primary { color: var(--cream); background: var(--forest); border-color: var(--forest); }
    .primary:hover { opacity: 0.92; }
    .secondary { color: var(--ink); background: transparent; }
    .secondary:hover { background: var(--cream-deep); }
    .link {
        min-height: 44px; color: var(--ink-soft); background: none; border-color: transparent;
        font-weight: 500; text-decoration: underline; text-underline-offset: 4px;
    }
    .link:hover { color: var(--ink); }

    /* The anchor. Breathing uses transform + opacity only (compositor-friendly, 60fps) */
    .orb { position: relative; display: grid; place-items: center; width: 240px; height: 240px; margin: 0.5rem 0; }
    .halo, .beat-ring {
        position: absolute; width: 168px; height: 168px; border-radius: 50%; pointer-events: none;
        will-change: transform, opacity;
    }
    .halo { background: var(--sage); opacity: 0.3; animation: breathe 7s ease-in-out infinite; }
    .halo-b { animation-delay: -3.5s; }
    .beat-ring { border: 2px solid var(--sage-deep); opacity: 0; }
    .beat-ring.go { animation: beat 0.5s ease-out; }

    .anchor {
        position: relative; width: 168px; height: 168px; padding: 0; border-radius: 50%;
        border: 0; background: none; color: var(--ink);
        touch-action: none; user-select: none; -webkit-user-select: none;
    }
    .anchor:hover { transform: none; }
    .anchor:active { transform: scale(0.97); opacity: 1; }
    .anchor:focus-visible { outline: 3px solid var(--ink); outline-offset: 8px; }
    .disc {
        position: absolute; inset: 16px; border-radius: 50%;
        background: var(--sage); border: 2px solid var(--ink);
        animation: breathe-core 7s ease-in-out infinite; will-change: transform;
    }
    .ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); pointer-events: none; }
    .ring circle { fill: none; stroke-width: 5; }
    .ring .track { stroke: var(--ink); opacity: 0.18; }
    .ring .bar { stroke: var(--ink); stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100; }
    .anchor.holding .bar { stroke-dashoffset: 0; transition: stroke-dashoffset ${HOLD_SECONDS}s linear; }
    .count { position: relative; font-size: 3.5rem; font-weight: 700; pointer-events: none; }

    @keyframes breathe {
        0%, 100% { transform: scale(1); opacity: 0.34; }
        50% { transform: scale(1.38); opacity: 0.1; }
    }
    @keyframes breathe-core {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.04); }
    }
    @keyframes beat {
        0% { transform: scale(1); opacity: 0.7; }
        100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes rise-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    @media (prefers-reduced-motion: reduce) {
        .overlay, .stage, .halo, .disc, .beat-ring.go { animation: none; }
        .halo-b { display: none; }
        .anchor.holding .bar { transition: none; }
        button, button:hover, button:active { transition: none; transform: none; }
        .pacer-circle, .pacer-bar-fill { transition: none !important; }
    }
    @media (max-width: 420px) {
        .orb { width: 210px; height: 210px; }
    }
`;

async function showOverlay(domain) {
    overlayOpen = true;

    const { name, persona } = await chrome.storage.local.get(['name', 'persona']);
    const userName = (typeof name === 'string' && name.trim()) || DEFAULT_NAME;
    const personaKey = VALID_PERSONAS.includes(persona) ? persona : DEFAULT_PERSONA;
    const variants = getPersonaData(userName)[personaKey];
    const message = variants[pickFresh(variants.length, 'variant')];

    const host = document.createElement('div');
    host.id = 'focus-anchor-host';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${OVERLAY_CSS}</style><div class="overlay" role="dialog" aria-modal="true" aria-label="FocusAnchor pause"></div>`;
    const overlay = shadow.querySelector('.overlay');

    // Lock page scroll behind the overlay; restored on dismiss
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const stopMediaGuard = startMediaGuard();

    // Don't hold the overlay back for the font: wait briefly, then render with the fallback
    await Promise.race([loadFont(), new Promise((resolve) => setTimeout(resolve, 400))]);

    // Task UI state (pacer or "I did it" delay), cleaned up on reroll/dismiss
    let pacer = null;
    let didItTimer = null;

    function clearTaskUI() {
        if (pacer) { pacer.destroy(); pacer = null; }
        clearInterval(didItTimer);
        didItTimer = null;
    }

    function dismiss() {
        clearTaskUI();
        stopMediaGuard();
        stopHold(true);
        host.remove();
        root.style.overflow = previousOverflow;
        overlayOpen = false;
    }

    // --- Step 1: hold-to-anchor ---
    let timer = null;
    let anchorEl = null;
    let countEl = null;
    let hintEl = null;
    let beatEl = null;

    function setHint(text) { if (hintEl) hintEl.textContent = text; }

    function resetAnchorUI() {
        if (anchorEl) anchorEl.classList.remove('holding');
        if (beatEl) beatEl.classList.remove('go');
        if (countEl) countEl.textContent = HOLD_SECONDS;
    }

    // One visible ripple per second (transform + opacity only)
    function beat() {
        beatEl.classList.remove('go');
        void beatEl.offsetWidth; // restart the animation
        beatEl.classList.add('go');
    }

    function startHold() {
        if (timer) return; // guard against double-firing
        unlockAudio();
        let left = HOLD_SECONDS;
        countEl.textContent = left;
        setHint('Keep holding');
        anchorEl.classList.add('holding');
        beat();
        playTone(440, 0.15);
        buzz([200, 100, 200]);

        timer = setInterval(() => {
            left--;
            countEl.textContent = left;
            if (left <= 0) {
                clearInterval(timer);
                timer = null;
                buzz(500);
                playTone(660, 0.4);
                logEvent('anchored', domain);
                renderChoice();
                return;
            }
            buzz(100);
            beat();
            playTone(440, 0.1);
        }, 1000);
    }

    function stopHold(silent) {
        const wasHolding = timer !== null;
        clearInterval(timer);
        timer = null;
        buzz(0);
        resetAnchorUI();
        if (wasHolding && !silent) setHint('Released too early. Press and hold again.');
    }

    function renderAnchor() {
        overlay.innerHTML = `
            <div class="stage">
                <h1></h1>
                <p class="lead"></p>
                <div class="orb">
                    <span class="halo halo-a" aria-hidden="true"></span>
                    <span class="halo halo-b" aria-hidden="true"></span>
                    <span class="beat-ring" aria-hidden="true"></span>
                    <button type="button" class="anchor" aria-label="Hold for ${HOLD_SECONDS} seconds">
                        <span class="disc" aria-hidden="true"></span>
                        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
                            <circle class="track" cx="50" cy="50" r="46"></circle>
                            <circle class="bar" cx="50" cy="50" r="46" pathLength="100"></circle>
                        </svg>
                        <span class="count">${HOLD_SECONDS}</span>
                    </button>
                </div>
                <p class="hint" role="status">Press and hold the circle</p>
            </div>
        `;
        overlay.querySelector('h1').textContent = message.title;
        overlay.querySelector('.lead').textContent = message.instruction;
        anchorEl = overlay.querySelector('.anchor');
        countEl = overlay.querySelector('.count');
        hintEl = overlay.querySelector('.hint');
        beatEl = overlay.querySelector('.beat-ring');

        // Pointer events cover mouse, touch and pen with a single path (no double-firing)
        anchorEl.addEventListener('pointerdown', (e) => { e.preventDefault(); startHold(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>
            anchorEl.addEventListener(type, () => stopHold(false)));
        // Keyboard: hold Space/Enter
        anchorEl.addEventListener('keydown', (e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); }
        });
        anchorEl.addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.key === 'Enter') stopHold(false);
        });
        anchorEl.focus();
    }

    // --- Step 2: grounding task + choices ---
    // "Close this tab" and "Give me another" are always available. "Continue" stays hidden until
    // the task is done: after the timer/pacer finishes, or after "I did it" (unlocked after a short pause).
    const DID_IT_DELAY_SECONDS = 5;

    function renderChoice() {
        anchorEl = countEl = hintEl = beatEl = null;
        overlay.innerHTML = `
            <div class="stage stage-wide">
                <h1>Anchor locked.</h1>
                <p>Try this if it feels right. Skipping is fine.</p>
                <div class="task-card">
                    <p class="task-eyebrow">A small step</p>
                    <p class="task-text" aria-live="polite"></p>
                    <div class="task-extra"></div>
                </div>
                <p class="unlock-note" role="status"></p>
                <div class="actions">
                    <button type="button" class="primary" id="close">Close this tab</button>
                    <button type="button" class="secondary" id="reroll">Give me another</button>
                    <button type="button" class="link" id="continue" hidden></button>
                </div>
            </div>
        `;
        // Keep keyboard focus inside the dialog, never on "Continue"
        overlay.querySelector('#close').focus();

        const taskEl = overlay.querySelector('.task-text');
        const extraEl = overlay.querySelector('.task-extra');
        const noteEl = overlay.querySelector('.unlock-note');
        const continueBtn = overlay.querySelector('#continue');
        continueBtn.textContent = `Continue to ${domain}`;

        function unlock(message) {
            continueBtn.hidden = false;
            noteEl.textContent = message;
            logEvent('task_completed', domain);
        }

        function mountDidIt() {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'primary did-it';
            btn.disabled = true;
            let left = DID_IT_DELAY_SECONDS;
            btn.textContent = `I did it (${left})`;
            extraEl.append(btn);

            didItTimer = setInterval(() => {
                left--;
                if (left > 0) { btn.textContent = `I did it (${left})`; return; }
                clearInterval(didItTimer);
                didItTimer = null;
                btn.textContent = 'I did it';
                btn.disabled = false;
            }, 1000);

            btn.addEventListener('click', () => {
                btn.hidden = true;
                unlock('Nice. You can continue whenever you want.');
            });
        }

        function showTask() {
            clearTaskUI();
            extraEl.replaceChildren();
            continueBtn.hidden = true;
            noteEl.textContent = '';

            const task = normalizeTask(GROUNDING_TASKS[pickFresh(GROUNDING_TASKS.length, 'task')]);
            taskEl.textContent = task.text;

            if (taskKind(task) === 'plain') {
                mountDidIt();
            } else {
                pacer = createPacer(task, { onDone: () => unlock('Well done. You can continue whenever you want.') });
                extraEl.append(pacer.el);
            }
        }
        showTask();

        overlay.querySelector('#reroll').addEventListener('click', showTask);

        continueBtn.addEventListener('click', async () => {
            await logEvent('continued', domain);
            await grantPass(domain);
            dismiss();
        });

        overlay.querySelector('#close').addEventListener('click', async () => {
            await logEvent('closed', domain);
            try {
                await chrome.runtime.sendMessage({ type: 'close-tab' });
            } catch (e) {
                // Fall back to leaving the site if the tab can't be closed
                location.href = 'about:blank';
            }
        });
    }

    logEvent('shown', domain);
    renderAnchor();
    // Attach to <html>: at document_start <body> may not exist yet
    root.appendChild(host);
    anchorEl.focus();
}
