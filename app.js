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

// Persona messages: 3 variants each, rotated so the same one never shows twice in a row
const getPersonaData = (name) => ({
    commander: [
        {
            title: `${name}, stop scrolling.`,
            instruction: "Put the phone down, take a breath, and come back to this room. Feel your feet."
        },
        {
            title: `${name}, that's enough.`,
            instruction: "The feed will still be there later. Exhale, sit up, and plant your feet on the floor."
        },
        {
            title: `Eyes up, ${name}.`,
            instruction: "You caught yourself. Now feel your body. One slow breath, then move."
        }
    ],
    empathetic: [
        {
            title: `Hey ${name}, it's okay.`,
            instruction: "It's completely natural that you escaped here. Let's take a breath together."
        },
        {
            title: `Hey ${name}, I've got you.`,
            instruction: "Getting stuck happens to everyone. Breathe out slowly, then we'll take one tiny step."
        },
        {
            title: `No judgment, ${name}.`,
            instruction: "You noticed, and that's the hard part. Let's ease back into your body together."
        }
    ],
    analytical: [
        {
            title: "Dopamine loop interrupted.",
            instruction: "Somatic grounding engaged. Your nervous system is already starting to settle."
        },
        {
            title: "Nervous system regulation in progress.",
            instruction: "Steady physical contact and a slow exhale help the body shift out of a stress response."
        },
        {
            title: "Pattern noted: scroll-driven freeze.",
            instruction: "Noticing it is the first regulation step. Next, one small sensory input to anchor you in the present."
        }
    ]
});

// Screen 4 grounding tasks: sensory, physical, and zero-pressure transitions.
// Deliberately no eyes-closed, breath-holding or recall prompts (trauma-informed).
const GROUNDING_TASKS = [
    "Find 3 blue objects in the room. Let your eyes rest on each one for a moment.",
    "Drink a glass of cold water, slowly. Notice the temperature in your mouth and throat.",
    "Name 5 things you can see, 4 you can touch, and 3 you can hear.",
    "Hold something cold or textured, like a cold glass or a piece of fabric. Notice exactly how it feels.",
    "Stand up, stretch your arms overhead, and sit back down.",
    "Press your feet firmly into the floor for 10 seconds. Feel the ground hold you.",
    "Roll your shoulders back 5 times, slowly.",
    "Splash cool water on your face or wrists.",
    "Put the phone face down on the table for 1 minute.",
    "Look out of a window, or at the farthest point in the room, for 30 seconds.",
    // Posture, eye-strain, temperature/touch, breathing and orienting prompts
    "Sit tall and let your shoulders drop away from your ears.",
    "Gently roll your neck from one side to the other, once each way.",
    "Unclench your jaw and let your tongue rest softly in your mouth.",
    "Shake out your hands for 10 seconds, like you're flicking off water.",
    "Stand up and reach one hand toward the ceiling, then the other.",
    "Wiggle your toes inside your shoes or socks.",
    "Lean back in your chair and let it hold your weight.",
    "Stretch your fingers wide, then let them relax. Repeat 3 times.",
    "Tilt your head so one ear moves toward your shoulder, then switch sides.",
    "Fold your arms across your chest in a gentle self-hug for 15 seconds.",
    "Look at something far away and let your eyes soften for 20 seconds.",
    "Blink slowly 10 times.",
    "Rub your palms together until they're warm, then rest them on your cheeks.",
    "Slowly trace the edge of a window or door frame with your eyes.",
    "Look left, then right, then up, then down, slowly, without moving your head.",
    "Run your hands under cool or warm water and notice the temperature change.",
    "Hold a warm mug with both hands. Notice the warmth in your palms.",
    "Press your palms together firmly for 10 seconds, then release and notice the tingling.",
    "Touch the surface nearest to you. Is it smooth, rough, warm, or cool?",
    "Rest a hand on your chest or belly and feel it move.",
    "Put on a sweater or blanket, or take one off, whichever feels better.",
    "Rub a piece of fabric between your fingers. Notice its texture.",
    "Find something soft nearby and touch it for a moment.",
    "Breathe in through your nose, then let a long, slow breath out through your mouth.",
    "Let each exhale be a little longer than the inhale, 4 times.",
    "Breathe out slowly, as if you were cooling a hot drink.",
    "Take 3 easy breaths and notice where the air moves in your body.",
    "Let out one big sigh, out loud if you like.",
    "Name 3 things you can see that have straight edges.",
    "Listen for the farthest sound you can hear, then the nearest one.",
    "Name 2 things within reach that you're glad to have.",
    "Run a fingertip along something with a texture you like.",
    "Say where you are, in one simple sentence.",
    "Say your name and today's date, quietly.",
    "Take a sip of something and notice its taste and temperature.",
    "Walk to another room slowly and notice each step.",
    "Notice any scent in the air around you, or just the feeling of the air on your skin.",
    "Find three round objects around you.",
    "Rest your hands on your thighs and feel their weight."
];

// Random index in [0, length) that differs from the last one used for this key.
// The last index is persisted so it stays fresh across visits; memory is the fallback.
const lastPicks = {};

function pickFresh(length, storageKey) {
    if (length <= 1) return 0;
    let last = lastPicks[storageKey];
    if (last === undefined) {
        const stored = parseInt(readStorage(storageKey), 10);
        last = Number.isInteger(stored) ? stored : -1;
    }
    let index;
    do {
        index = Math.floor(Math.random() * length);
    } while (index === last);
    lastPicks[storageKey] = index;
    writeStorage(storageKey, String(index));
    return index;
}


let appState = {
    currentPersona: VALID_PERSONAS.includes(savedPersona) ? savedPersona : 'commander',
    currentScreen: 'screen-onboarding',
    timerInterval: null
};

const PICK_KEYS = {
    variantPrefix: 'focus_anchor_last_variant_',
    task: 'focus_anchor_last_task'
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

    if (screenId === 'screen-action') {
        loadGroundingTask();
    }
}

function loadGroundingTask() {
    const taskEl = document.getElementById('grounding-task');
    if (taskEl) taskEl.textContent = GROUNDING_TASKS[pickFresh(GROUNDING_TASKS.length, PICK_KEYS.task)];
}

function loadInterventionText() {
    const variants = getPersonaData(userName)[appState.currentPersona];
    const personaData = variants[pickFresh(variants.length, PICK_KEYS.variantPrefix + appState.currentPersona)];

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

// Call from a user gesture (iOS keeps audio locked until then). Safe to call repeatedly:
// iOS can drop the context into 'interrupted' (not just 'suspended') between holds, so
// anything that isn't 'running' gets resumed.
function unlockAudio() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) audioCtx = new AudioContextClass();
        if (audioCtx.state !== 'running') {
            const resumed = audioCtx.resume();
            if (resumed && resumed.catch) resumed.catch(() => {});
        }
    } catch (e) { /* audio is optional */ }
}

function playTone(frequency, durationSec) {
    if (!audioCtx) return;
    // resume() is async, so wait for it instead of silently dropping the tone
    if (audioCtx.state !== 'running') {
        try {
            audioCtx.resume().then(() => {
                if (audioCtx.state === 'running') playToneNow(frequency, durationSec);
            }).catch(() => {});
        } catch (e) { /* audio is optional */ }
        return;
    }
    playToneNow(frequency, durationSec);
}

function playToneNow(frequency, durationSec) {
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

    // Releasing a finger counts as a user gesture on iOS (touchstart doesn't), so re-arm audio now
    unlockAudio();

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

    // Screen 4: reroll the grounding task
    const rerollBtn = document.getElementById('reroll-btn');
    if (rerollBtn) rerollBtn.addEventListener('click', loadGroundingTask);

    // Screen 4: reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Return to the first screen to allow a new focus round when needed
            navigateTo('screen-onboarding');
        });
    }
});
