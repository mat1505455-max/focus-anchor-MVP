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
})();

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

// --- Overlay ---------------------------------------------------------------

const OVERLAY_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 1rem; padding: 2rem; overflow-y: auto;
        background: #0f172a; color: #f1f5f9;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; text-align: center;
    }
    h1 { margin: 0; font-size: 1.9rem; line-height: 1.25; }
    p { margin: 0; max-width: 30rem; color: #94a3b8; font-size: 1.1rem; line-height: 1.5; }
    .task { color: #f1f5f9; font-size: 1.25rem; background: #1e293b; padding: 1.1rem 1.4rem; border-radius: 14px; }
    .hint { font-size: 0.95rem; min-height: 1.4em; }
    .actions { display: flex; flex-direction: column; gap: 0.7rem; width: min(22rem, 100%); margin-top: 0.5rem; }
    button { font: inherit; cursor: pointer; border: 0; border-radius: 14px; padding: 0.85rem 1.5rem; font-weight: 700; }
    .primary { color: #06202e; background: #38bdf8; }
    .secondary { color: #f1f5f9; background: #1e293b; border: 1px solid #334155; font-weight: 600; }
    .link { color: #94a3b8; background: none; text-decoration: underline; font-weight: 500; }
    button:focus-visible { outline: 3px solid #38bdf8; outline-offset: 3px; }

    .anchor {
        position: relative; width: 180px; height: 180px; margin: 0.75rem 0; padding: 0; border-radius: 50%;
        color: #06202e; font-size: 4rem; font-weight: 800;
        background: radial-gradient(circle at 30% 30%, #38bdf8, #0ea5e9);
        animation: pulse 2s ease-out infinite;
        touch-action: none; user-select: none; -webkit-user-select: none;
    }
    .anchor:active { transform: scale(0.96); }
    .ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); pointer-events: none; }
    .ring circle { fill: none; stroke-width: 5; }
    .ring .track { stroke: rgba(6, 32, 46, 0.25); }
    .ring .bar { stroke: #06202e; stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100; }
    .anchor.holding .bar { stroke-dashoffset: 0; transition: stroke-dashoffset ${HOLD_SECONDS}s linear; }
    .anchor.beat { animation: beat 0.35s ease-out; }
    .count { position: relative; pointer-events: none; }
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.45); }
        70% { box-shadow: 0 0 0 36px rgba(56, 189, 248, 0); }
        100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
    }
    @keyframes beat {
        0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
        100% { box-shadow: 0 0 0 28px rgba(255, 255, 255, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
        .anchor, .anchor.beat { animation: none; }
        .anchor.holding .bar { transition: none; }
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

    function dismiss() {
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

    function setHint(text) { if (hintEl) hintEl.textContent = text; }

    function resetAnchorUI() {
        if (anchorEl) anchorEl.classList.remove('holding', 'beat');
        if (countEl) countEl.textContent = HOLD_SECONDS;
    }

    function beat() {
        anchorEl.classList.remove('beat');
        void anchorEl.offsetWidth; // restart the animation
        anchorEl.classList.add('beat');
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
            <h1></h1>
            <p></p>
            <button type="button" class="anchor" aria-label="Hold for ${HOLD_SECONDS} seconds">
                <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
                    <circle class="track" cx="50" cy="50" r="46"></circle>
                    <circle class="bar" cx="50" cy="50" r="46" pathLength="100"></circle>
                </svg>
                <span class="count">${HOLD_SECONDS}</span>
            </button>
            <p class="hint">Hold your finger on the anchor</p>
        `;
        overlay.querySelector('h1').textContent = message.title;
        overlay.querySelector('p').textContent = message.instruction;
        anchorEl = overlay.querySelector('.anchor');
        countEl = overlay.querySelector('.count');
        hintEl = overlay.querySelector('.hint');

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
    function renderChoice() {
        anchorEl = countEl = hintEl = null;
        overlay.innerHTML = `
            <h1>Anchor locked.</h1>
            <p>Try this if it feels right. Skipping is fine.</p>
            <p class="task" aria-live="polite"></p>
            <div class="actions">
                <button type="button" class="secondary" id="reroll">Give me another</button>
                <button type="button" class="primary" id="continue"></button>
                <button type="button" class="link" id="close">Close this tab</button>
            </div>
        `;
        const taskEl = overlay.querySelector('.task');
        const showTask = () => { taskEl.textContent = GROUNDING_TASKS[pickFresh(GROUNDING_TASKS.length, 'task')]; };
        showTask();

        overlay.querySelector('#continue').textContent = `Continue to ${domain}`;
        overlay.querySelector('#reroll').addEventListener('click', showTask);

        overlay.querySelector('#continue').addEventListener('click', async () => {
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
