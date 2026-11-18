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
    "Look out of a window, or at the farthest point in the room, for 30 seconds."
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
