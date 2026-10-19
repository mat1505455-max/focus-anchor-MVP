// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================

const STORAGE_KEYS = {
    name: 'focus_anchor_user_name',
    persona: 'focus_anchor_persona'
};
const DEFAULT_NAME = 'friend';
const VALID_PERSONAS = ['commander', 'empathetic', 'analytical'];

// localStorage can throw (private mode, blocked storage), so never let it break the app
function readStorage(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* non-fatal: just not persisted */ }
}

let userName = readStorage(STORAGE_KEYS.name) || DEFAULT_NAME;
const savedPersona = readStorage(STORAGE_KEYS.persona);

const getPersonaData = (name) => ({
    commander: {
        title: `Commander: "${name}, stop scrolling."`,
        instruction: "Put the phone down, take a breath, and let's get back to work. Move."
    },
    empathetic: {
        title: `Friend: "Hey ${name}, it's okay."`,
        instruction: "It's completely natural that you escaped here. Let's take a breath together."
    },
    analytical: {
        title: "Researcher: \"I detected a short-term dopamine loop.\"",
        instruction: "Returning to the exercise now for 3 minutes will break the procrastination chain."
    }
});


let appState = {
    currentPersona: VALID_PERSONAS.includes(savedPersona) ? savedPersona : 'commander',
    currentScreen: 'screen-onboarding',
    timerInterval: null
};

// ==========================================
// 2. SCREEN NAVIGATION & TEXT INJECTION
// ==========================================

function navigateTo(screenId) {
    appState.currentScreen = screenId;

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
    }

    if (screenId === 'screen-intervention') {
        loadInterventionText();
    }
}

function loadInterventionText() {
    const allPersonas = getPersonaData(userName);
    const personaData = allPersonas[appState.currentPersona];

    const titleEl = document.getElementById('intervention-title');
    const descEl = document.getElementById('intervention-desc');

    if (titleEl && descEl) {
        titleEl.textContent = personaData.title;
        descEl.textContent = personaData.instruction;
    }
}

// ==========================================
// 3. CORE GROUNDING LOGIC (Haptic & Timer)
// ==========================================

const HOLD_SECONDS = 5;
const HINT_DEFAULT = 'Hold your finger on the anchor';
const HINT_TOO_EARLY = 'Released too early. Press and hold again.';

// --- Feedback layer -------------------------------------------------------
// Vibration is unsupported on iOS Safari, so every tick also gets a visual
// beat and a short sound. Vibration is a bonus where available.

let audioCtx = null;

// Must be called from a user gesture (iOS keeps audio locked until then)
function unlockAudio() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* audio is optional */ }
}

function playTone(frequency, durationSec) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;
        osc.frequency.value = frequency;
        // Quick fade in/out avoids clicks
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + durationSec + 0.05);
    } catch (e) { /* audio is optional */ }
}

function buzz(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

function beatAnchor() {
    const anchor = document.getElementById('touch-anchor');
    if (!anchor) return;
    anchor.classList.remove('beat');
    void anchor.offsetWidth; // force reflow so the animation restarts
    anchor.classList.add('beat');
}

function setHint(text) {
    const hintEl = document.querySelector('.hint-text');
    if (hintEl) hintEl.textContent = text;
}

function resetAnchorUI() {
    const anchor = document.getElementById('touch-anchor');
    if (anchor) anchor.classList.remove('holding', 'beat');
    const countdownEl = document.getElementById('countdown-timer');
    if (countdownEl) countdownEl.textContent = HOLD_SECONDS;
}

// --- Hold logic -----------------------------------------------------------

function startGrounding() {
    // Guard against double-firing (e.g. touch + emulated mouse events) stacking two timers
    if (appState.timerInterval) return;

    unlockAudio();

    let timeLeft = HOLD_SECONDS;
    const countdownEl = document.getElementById('countdown-timer');
    const anchor = document.getElementById('touch-anchor');

    if (countdownEl) countdownEl.textContent = timeLeft;
    setHint(HINT_DEFAULT);
    if (anchor) anchor.classList.add('holding'); // starts the progress ring
    beatAnchor();
    playTone(440, 0.15);

    // Initial vibration pulse (bottom-up trigger) marking the start of contact
    buzz([200, 100, 200]);

    // 5-second countdown
    appState.timerInterval = setInterval(() => {
        timeLeft--;
        if (countdownEl) countdownEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(appState.timerInterval);
            appState.timerInterval = null;
            completeGrounding();
            return;
        }

        // Per-second feedback: vibration, visual beat and tick sound
        buzz(100);
        beatAnchor();
        playTone(440, 0.1);
    }, 1000);
}

function stopGrounding() {
    // Release events also fire after a completed hold; only react to an interrupted one
    const wasHolding = appState.timerInterval !== null;

    // If the user lifts their finger early, reset everything to prevent shortcuts
    clearInterval(appState.timerInterval);
    appState.timerInterval = null;
    buzz(0); // Immediately cancel any active vibration

    resetAnchorUI();
    if (wasHolding) setHint(HINT_TOO_EARLY);
}

function completeGrounding() {
    // Strong, noticeable completion feedback: long vibration plus a higher chime
    buzz(500);
    playTone(660, 0.4);

    resetAnchorUI();
    setHint(HINT_DEFAULT);

    // Move on to the micro-action screen
    navigateTo('screen-action');
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

    // Screen 1: welcome + name
    const welcomeForm = document.getElementById('welcome-form');
    const nameInput = document.getElementById('username-input');
    const nameError = document.getElementById('name-error');

    // Prefill the saved name, if any
    const savedName = readStorage(STORAGE_KEYS.name);
    if (savedName && nameInput) nameInput.value = savedName;

    // Returning user: skip the welcome screen and go straight to persona selection
    if (savedName) navigateTo('screen-onboarding');

    // Let the user go back and change the saved name
    const changeNameBtn = document.getElementById('change-name-btn');
    if (changeNameBtn) {
        changeNameBtn.addEventListener('click', () => {
            navigateTo('screen-welcome');
            if (nameInput) nameInput.focus();
        });
    }

    if (nameInput && nameError) {
        nameInput.addEventListener('input', () => { nameError.hidden = true; });
    }

    if (welcomeForm) {
        // A form submit covers both the button tap and the Enter/Go key on mobile keyboards
        welcomeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();

            if (name === '') {
                nameError.hidden = false;
                nameInput.focus();
                return;
            }

            userName = name;
            writeStorage(STORAGE_KEYS.name, userName);
            navigateTo('screen-onboarding');
        });
    }

    // Screen 2: persona selection
    const personaButtons = document.querySelectorAll('.btn-persona');

    // Reflect the restored/default persona in the UI
    personaButtons.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.persona === appState.currentPersona);
    });

    personaButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // currentTarget is always the button, even if it ever contains child elements
            const chosen = e.currentTarget.dataset.persona;

            // Store the selected persona in state and persist it
            appState.currentPersona = chosen;
            writeStorage(STORAGE_KEYS.persona, chosen);

            // Highlight the selected button (styled in styles.css)
            personaButtons.forEach(btn => btn.classList.remove('selected'));
            e.currentTarget.classList.add('selected');

            console.log(`Selected persona updated to: ${appState.currentPersona}`);
        });
    });

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            // This click is a user gesture, so it can unlock audio for the hold on the next screen
            unlockAudio();

            console.log(`User ${userName} continuing to the intervention screen with persona ${appState.currentPersona}`);

            // Move on to screen 2
            navigateTo('screen-intervention');
        });
    }

    // Screen 2: touch listeners on the grounding anchor
    const touchAnchor = document.getElementById('touch-anchor');
    if (touchAnchor) {
        // Press start events (mouse and mobile)
        touchAnchor.addEventListener('mousedown', startGrounding);
        touchAnchor.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default mobile browser behaviors
            startGrounding();
        });

        // Release/cancel events (mouse and mobile)
        touchAnchor.addEventListener('mouseup', stopGrounding);
        touchAnchor.addEventListener('mouseleave', stopGrounding); // Cursor left the circle's bounds
        touchAnchor.addEventListener('touchend', stopGrounding);
        touchAnchor.addEventListener('touchcancel', stopGrounding);
    }

    // Screen 3: reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Return to the first screen to allow a new focus round when needed
            navigateTo('screen-onboarding');
        });
    }
});
