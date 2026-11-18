// Shared content, loaded before content.js (same isolated-world scope).
// Mirrors the PWA's app.js content; keep the two in sync until they share a module.

const DEFAULT_NAME = 'friend';
const DEFAULT_PERSONA = 'empathetic';
const VALID_PERSONAS = ['commander', 'empathetic', 'analytical'];

const getPersonaData = (name) => ({
    commander: [
        { title: `${name}, stop scrolling.`, instruction: "Put the phone down, take a breath, and come back to this room. Feel your feet." },
        { title: `${name}, that's enough.`, instruction: "The feed will still be there later. Exhale, sit up, and plant your feet on the floor." },
        { title: `Eyes up, ${name}.`, instruction: "You caught yourself. Now feel your body. One slow breath, then move." }
    ],
    empathetic: [
        { title: `Hey ${name}, it's okay.`, instruction: "It's completely natural that you escaped here. Let's take a breath together." },
        { title: `Hey ${name}, I've got you.`, instruction: "Getting stuck happens to everyone. Breathe out slowly, then we'll take one tiny step." },
        { title: `No judgment, ${name}.`, instruction: "You noticed, and that's the hard part. Let's ease back into your body together." }
    ],
    analytical: [
        { title: "Dopamine loop interrupted.", instruction: "Somatic grounding engaged. Your nervous system is already starting to settle." },
        { title: "Nervous system regulation in progress.", instruction: "Steady physical contact and a slow exhale help the body shift out of a stress response." },
        { title: "Pattern noted: scroll-driven freeze.", instruction: "Noticing it is the first regulation step. Next, one small sensory input to anchor you in the present." }
    ]
});

// Trauma-informed: no eyes-closed, breath-holding or recall prompts.
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

// Random index that differs from the previous pick for this key (memory only here).
const lastPicks = {};
function pickFresh(length, key) {
    if (length <= 1) return 0;
    let index;
    do { index = Math.floor(Math.random() * length); } while (index === lastPicks[key]);
    lastPicks[key] = index;
    return index;
}
