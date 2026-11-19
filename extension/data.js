// Shared content, loaded before content.js (same isolated-world scope).
// Mirrors the PWA's app.js content; keep the two in sync until they share a module.

const DEFAULT_NAME = 'friend';

// Messages on the anchor screen (one warm "Friend" tone): 3 variants, never the same one twice in a row
const getMessages = (name) => [
    { title: `Hey ${name}, it's okay.`, instruction: "It's completely natural that you escaped here. Let's take a breath together." },
    { title: `Hey ${name}, I've got you.`, instruction: "Getting stuck happens to everyone. Breathe out slowly, then we'll take one tiny step." },
    { title: `No judgment, ${name}.`, instruction: "You noticed, and that's the hard part. Let's ease back into your body together." }
];

// Trauma-informed: no eyes-closed or recall prompts. Any breath holds are gentle and optional.
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

// Random index that differs from the previous pick for this key (memory only here).
const lastPicks = {};
function pickFresh(length, key) {
    if (length <= 1) return 0;
    let index;
    do { index = Math.floor(Math.random() * length); } while (index === lastPicks[key]);
    lastPicks[key] = index;
    return index;
}
