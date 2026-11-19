// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================

const STORAGE_KEYS = {
    name: 'focus_anchor_user_name'
};
const DEFAULT_NAME = 'friend';

// localStorage can throw (private mode, blocked storage), so never let it break the app
function readStorage(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* non-fatal: just not persisted */ }
}

let userName = readStorage(STORAGE_KEYS.name) || DEFAULT_NAME;

// Messages shown on the anchor screen: 3 variants, rotated so the same one never shows twice in a row
const getMessages = (name) => [
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
];

// Light-hearted sign-offs for the completion screen (rotated at random, never the same twice in a row)
const COMPLETION_MESSAGES = [
    "You just did something kind for your nervous system. Go enjoy the rest of your day.",
    "Plot twist: you paused, and nothing exploded. Have a great day!",
    "That's one tiny win in the bank. The feed can wait.",
    "Your brain says thanks. Your thumbs say they were just getting started. Too bad!",
    "Go be a person in the world for a bit. You've earned it.",
    "Gold star. Invisible, but very shiny. Have a lovely day.",
    "You've officially out-scrolled the scroll. Go do something delightful.",
    "Deep breath, loose shoulders, soft jaw. Looking good out there.",
    "The internet will survive without you for a while. Promise.",
    "Today's forecast: slightly calmer, with a chance of snacks.",
    "You showed up for yourself. That's the whole job. Have a great day!",
    "Somewhere, a very proud little sprout is doing a happy dance for you.",
    "Mission accomplished. Please enjoy your regularly scheduled life.",
    "Small step, big vibes. See you next time, no pressure.",
    "You can put the phone down now. Seriously. Go on."
];

// Screen 4 grounding tasks: sensory, physical, and zero-pressure transitions.
// Deliberately no eyes-closed or recall prompts (trauma-informed). Any breath holds are gentle and optional.
// An entry is a plain string, or an object with timer metadata (see pacer.js):
//   { text, durationSeconds } or { text, phases: [{ label, seconds }], cycles }
const GROUNDING_TASKS = [
    "Find 3 blue objects in the room. Let your eyes rest on each one for a moment.",
    "Drink a glass of cold water, slowly. Notice the temperature in your mouth and throat.",
    "Name 5 things you can see, 4 you can touch, and 3 you can hear.",
    "Hold something cold or textured, like a cold glass or a piece of fabric. Notice exactly how it feels.",
    "Stand up, stretch your arms overhead, and sit back down.",
    { text: "Press your feet firmly into the floor for 10 seconds. Feel the ground hold you.", durationSeconds: 10 },
    "Roll your shoulders back 5 times, slowly.",
    "Splash cool water on your face or wrists.",
    { text: "Put the phone face down on the table for 1 minute.", durationSeconds: 60, label: "Phone down" },
    { text: "Look out of a window, or at the farthest point in the room, for 30 seconds.", durationSeconds: 30 },
    // Posture, eye-strain, temperature/touch, breathing and orienting prompts
    "Sit tall and let your shoulders drop away from your ears.",
    "Gently roll your neck from one side to the other, once each way.",
    "Unclench your jaw and let your tongue rest softly in your mouth.",
    { text: "Shake out your hands for 10 seconds, like you're flicking off water.", durationSeconds: 10 },
    "Stand up and reach one hand toward the ceiling, then the other.",
    "Wiggle your toes inside your shoes or socks.",
    "Lean back in your chair and let it hold your weight.",
    "Stretch your fingers wide, then let them relax. Repeat 3 times.",
    "Tilt your head so one ear moves toward your shoulder, then switch sides.",
    { text: "Fold your arms across your chest in a gentle self-hug for 15 seconds.", durationSeconds: 15 },
    { text: "Look at something far away and let your eyes soften for 20 seconds.", durationSeconds: 20 },
    "Blink slowly 10 times.",
    "Rub your palms together until they're warm, then rest them on your cheeks.",
    "Slowly trace the edge of a window or door frame with your eyes.",
    "Look left, then right, then up, then down, slowly, without moving your head.",
    "Run your hands under cool or warm water and notice the temperature change.",
    "Hold a warm mug with both hands. Notice the warmth in your palms.",
    { text: "Press your palms together firmly for 10 seconds, then release and notice the tingling.", durationSeconds: 10 },
    "Touch the surface nearest to you. Is it smooth, rough, warm, or cool?",
    "Rest a hand on your chest or belly and feel it move.",
    "Put on a sweater or blanket, or take one off, whichever feels better.",
    "Rub a piece of fabric between your fingers. Notice its texture.",
    "Find something soft nearby and touch it for a moment.",
    { text: "Breathe in through your nose, then let a long, slow breath out through your mouth.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Exhale", seconds: 6, type: "out" }], cycles: 3 },
    { text: "Let each exhale be a little longer than the inhale, 4 times.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Exhale", seconds: 5, type: "out" }], cycles: 4 },
    { text: "Breathe out slowly, as if you were cooling a hot drink.", phases: [{ label: "Inhale", seconds: 3, type: "in" }, { label: "Exhale", seconds: 6, type: "out" }], cycles: 4 },
    { text: "Take 3 easy breaths and notice where the air moves in your body.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Exhale", seconds: 4, type: "out" }], cycles: 3 },
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
    "Rest your hands on your thighs and feel their weight.",
    // Structured breathing (gentle, optional holds) and color orienting
    { text: "Box breathing: in for 4, pause for 4, out for 4, pause for 4. Repeat 3 times. Skip the pauses if they don't feel comfortable.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Hold", seconds: 4, type: "hold", optional: true }, { label: "Exhale", seconds: 4, type: "out" }, { label: "Hold", seconds: 4, type: "hold", optional: true }], cycles: 3 },
    { text: "4-7-8 breathing: in through your nose for 4, hold gently for 7, out slowly through your mouth for 8. Do 3 rounds, and shorten the hold if it feels strained.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Hold", seconds: 7, type: "hold", optional: true }, { label: "Exhale", seconds: 8, type: "out" }], cycles: 3 },
    { text: "Physiological sigh: a double inhale through your nose (a big one, then a small top-up), then a long, slow exhale through your mouth. Repeat 3 times.", phases: [{ label: "Big inhale", seconds: 2, type: "in", scale: 0.85 }, { label: "Small top-up inhale", seconds: 1, type: "in" }, { label: "Long exhale", seconds: 6, type: "out" }], cycles: 3 },
    { text: "Even breathing: in for 5 and out for 5, easily, for about a minute.", phases: [{ label: "Inhale", seconds: 5, type: "in" }, { label: "Exhale", seconds: 5, type: "out" }], cycles: 6 },
    { text: "Longer exhale: in for 4, out for 6. Repeat 5 times.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Exhale", seconds: 6, type: "out" }], cycles: 5 },
    { text: "Triangle breathing: in for 4, a gentle pause for 4, out for 4. Repeat 4 times, and skip the pause if you'd rather.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Hold", seconds: 4, type: "hold", optional: true }, { label: "Exhale", seconds: 4, type: "out" }], cycles: 4 },
    { text: "Humming breath: breathe in through your nose, then hum softly as you breathe out. Repeat 4 times.", phases: [{ label: "Inhale", seconds: 4, type: "in" }, { label: "Hum softly", seconds: 6, type: "out" }], cycles: 4 },
    { text: "Straw breathing: in through your nose for 2, then out through pursed lips for 4, as if blowing through a straw. Repeat 5 times.", phases: [{ label: "Inhale", seconds: 2, type: "in" }, { label: "Exhale", seconds: 4, type: "out" }], cycles: 5 },
    "Find 3 things in your favorite color. Let your eyes rest on each one.",
    "Find 3 green things in the room. If colors are hard to tell apart, go with whatever looks closest.",
    { text: "Find the brightest color in the room and rest your eyes on it for 10 seconds.", durationSeconds: 10 },
    "Find one red thing, one yellow thing, and one blue thing, and rest your eyes on each for a moment."
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
    currentScreen: 'screen-welcome',
    timerInterval: null
};

const PICK_KEYS = {
    variant: 'focus_anchor_last_variant',
    task: 'focus_anchor_last_task',
    completion: 'focus_anchor_last_completion'
};

// ==========================================
// 2. SCREEN NAVIGATION & TEXT INJECTION
// ==========================================

function navigateTo(screenId) {
    // Leaving the task screen: stop any running timer
    if (appState.currentScreen === 'screen-action' && screenId !== 'screen-action') clearTaskUI();
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

    if (screenId === 'screen-complete') {
        loadCompletionMessage();
    }
}

function loadCompletionMessage() {
    const el = document.getElementById('complete-message');
    if (el) el.textContent = COMPLETION_MESSAGES[pickFresh(COMPLETION_MESSAGES.length, PICK_KEYS.completion)];
}

// Task UI: a timer/pacer for timed and breathing tasks, or an "I did it" button (enabled after a
// short pause) for plain ones. "Done, thanks" stays available throughout: this app never blocks anything.
const DID_IT_DELAY_SECONDS = 5;
let activePacer = null;
let didItTimer = null;

function clearTaskUI() {
    if (activePacer) { activePacer.destroy(); activePacer = null; }
    clearInterval(didItTimer);
    didItTimer = null;
}

function loadGroundingTask() {
    const taskEl = document.getElementById('grounding-task');
    const extraEl = document.getElementById('task-extra');
    const noteEl = document.getElementById('unlock-note');
    if (!taskEl || !extraEl || !noteEl) return;

    clearTaskUI();
    extraEl.replaceChildren();
    noteEl.textContent = '';

    const task = normalizeTask(GROUNDING_TASKS[pickFresh(GROUNDING_TASKS.length, PICK_KEYS.task)]);
    taskEl.textContent = task.text;

    if (taskKind(task) === 'plain') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary did-it';
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
            noteEl.textContent = 'Nice. That counts.';
        });
    } else {
        activePacer = createPacer(task, { onDone: () => { noteEl.textContent = 'Well done. That counts.'; } });
        extraEl.append(activePacer.el);
    }
}

function loadInterventionText() {
    const variants = getMessages(userName);
    const message = variants[pickFresh(variants.length, PICK_KEYS.variant)];

    const titleEl = document.getElementById('intervention-title');
    const descEl = document.getElementById('intervention-desc');

    if (titleEl && descEl) {
        titleEl.textContent = message.title;
        descEl.textContent = message.instruction;
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

    // Returning user: skip the welcome screen and land straight on the anchor
    if (savedName) navigateTo('screen-intervention');

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
            // This submit is a user gesture, so it can unlock audio for the hold on the next screen
            unlockAudio();
            navigateTo('screen-intervention');
        });
    }

    // Anchor screen: touch listeners on the grounding anchor
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

    // Screen 4: "Done, thanks" leads to the completion screen
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => navigateTo('screen-complete'));

    // Completion screen: one more task, straight to a fresh task card
    const againBtn = document.getElementById('again-btn');
    if (againBtn) againBtn.addEventListener('click', () => navigateTo('screen-action'));
});
