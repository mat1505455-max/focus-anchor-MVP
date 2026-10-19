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

function startGrounding() {
    // Guard against double-firing (e.g. touch + emulated mouse events) stacking two timers
    if (appState.timerInterval) return;

    let timeLeft = 5;
    const countdownEl = document.getElementById('countdown-timer');

    if (countdownEl) countdownEl.textContent = timeLeft;

    // Initial vibration pulse (bottom-up trigger) marking the start of contact
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }

    // 5-second countdown
    appState.timerInterval = setInterval(() => {
        timeLeft--;
        if (countdownEl) countdownEl.textContent = timeLeft;

        // Short vibration on every elapsed second for sensory feedback
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        if (timeLeft <= 0) {
            clearInterval(appState.timerInterval);
            appState.timerInterval = null;
            completeGrounding();
        }
    }, 1000);
}

function stopGrounding() {
    // If the user lifts their finger early, reset everything to prevent shortcuts
    clearInterval(appState.timerInterval);
    appState.timerInterval = null;
    if (navigator.vibrate) {
        navigator.vibrate(0); // Immediately cancel any active vibration
    }

    // Restore the initial display state
    const countdownEl = document.getElementById('countdown-timer');
    if (countdownEl) countdownEl.textContent = "5";
}

function completeGrounding() {
    // Strong, noticeable completion feedback (half a second of continuous vibration)
    if (navigator.vibrate) {
        navigator.vibrate(500);
    }
    // Move on to the micro-action screen
    navigateTo('screen-action');
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

    // Screen 1: persona selection
    const personaButtons = document.querySelectorAll('.btn-persona');

    // Reflect the restored/default persona in the UI
    personaButtons.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.persona === appState.currentPersona);
    });

    // Prefill the saved name, if any
    const savedName = readStorage(STORAGE_KEYS.name);
    const nameInput = document.getElementById('username-input');
    if (savedName && nameInput) nameInput.value = savedName;

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
            const inputEl = document.getElementById('username-input');

            // If the user typed a name, update the global variable and persist it in the browser
            if (inputEl && inputEl.value.trim() !== "") {
                userName = inputEl.value.trim();
                writeStorage(STORAGE_KEYS.name, userName);
            }

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
