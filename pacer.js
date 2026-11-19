// Guided timer / breathing pacer, shared by the extension overlay and the PWA.
// Keep extension/pacer.js and pacer.js identical (the extension zip can't reach outside its folder).
//
// A task is either a plain string, or an object:
//   { text }                                          plain: no timer
//   { text, durationSeconds, label? }                 timed: one countdown
//   { text, phases: [{ label, seconds, type?, optional?, scale? }], cycles? }   breathing pacer
// Phase `type` is 'in' | 'out' | 'hold' (inferred from the label when omitted). `optional` marks a
// gentle hold the user may skip. `scale` overrides how full the circle gets for an 'in' phase.

const PACER_MIN_SCALE = 0.62;

function normalizeTask(task) {
    return typeof task === 'string' ? { text: task } : task;
}

function taskKind(task) {
    if (task.phases && task.phases.length) return 'breathing';
    if (task.durationSeconds) return 'timed';
    return 'plain';
}

function inferPhaseType(label) {
    if (/^(in|big|small|top)/i.test(label)) return 'in';
    if (/^(ex|out|hum|long|sigh)/i.test(label)) return 'out';
    return 'hold';
}

function buildSteps(task) {
    if (taskKind(task) === 'timed') {
        return [{ label: task.label || 'Time left', seconds: task.durationSeconds, type: 'timed', cycle: 1, cycles: 1 }];
    }
    const cycles = task.cycles || 1;
    const steps = [];
    for (let c = 1; c <= cycles; c++) {
        task.phases.forEach((p) => {
            steps.push({
                label: p.label,
                seconds: p.seconds,
                type: p.type || inferPhaseType(p.label),
                optional: !!p.optional,
                scale: p.scale,
                cycle: c,
                cycles
            });
        });
    }
    return steps;
}

// Returns { el, destroy }. `onDone` fires once when the last step finishes.
function createPacer(task, { onDone } = {}) {
    const steps = buildSteps(task);
    const totalMs = steps.reduce((sum, s) => sum + s.seconds * 1000, 0);
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const el = document.createElement('div');
    el.className = 'pacer';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Guided timer');
    el.innerHTML = `
        <div class="pacer-visual" aria-hidden="true">
            <span class="pacer-circle"></span>
            <span class="pacer-count"></span>
        </div>
        <p class="pacer-phase" role="status" aria-live="polite">Ready when you are</p>
        <p class="pacer-note"></p>
        <div class="pacer-bar" aria-hidden="true"><span class="pacer-bar-fill"></span></div>
        <button type="button" class="pacer-start primary">Start</button>
    `;

    const circle = el.querySelector('.pacer-circle');
    const countEl = el.querySelector('.pacer-count');
    const phaseEl = el.querySelector('.pacer-phase');
    const noteEl = el.querySelector('.pacer-note');
    const fillEl = el.querySelector('.pacer-bar-fill');
    const startBtn = el.querySelector('.pacer-start');

    const idleScale = taskKind(task) === 'timed' ? 0.8 : PACER_MIN_SCALE;
    circle.style.transform = `scale(${idleScale})`;
    countEl.textContent = Math.ceil(steps[0].seconds);

    let interval = null;
    let finished = false;
    let index = 0;
    let stepStart = 0;
    let runStart = 0;
    let lastShownSecond = -1;

    function setBar(fraction) {
        fillEl.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction))})`;
    }

    function enterStep(i) {
        const step = steps[i];
        index = i;
        stepStart = performance.now();
        phaseEl.textContent = step.optional ? `${step.label} (optional)` : step.label;
        noteEl.textContent = step.optional ? 'Hold gently, or just keep breathing. Either is fine.' : '';
        if (step.cycles > 1 && step.type !== 'timed') {
            noteEl.textContent = (noteEl.textContent ? noteEl.textContent + ' ' : '') + `Round ${step.cycle} of ${step.cycles}`;
        }

        // The circle grows on inhale and shrinks on exhale (transform only, so it stays smooth)
        let target = null;
        if (step.type === 'in') target = step.scale || 1;
        else if (step.type === 'out') target = PACER_MIN_SCALE;
        if (target !== null) {
            circle.style.transition = reduceMotion ? 'none' : `transform ${step.seconds}s ease-in-out`;
            circle.style.transform = `scale(${target})`;
        }
        lastShownSecond = -1;
    }

    function tick() {
        const now = performance.now();
        const step = steps[index];
        const elapsed = now - stepStart;

        if (elapsed >= step.seconds * 1000) {
            if (index + 1 < steps.length) {
                enterStep(index + 1);
                return;
            }
            finish();
            return;
        }

        const remaining = Math.ceil(step.seconds - elapsed / 1000);
        countEl.textContent = remaining;

        // Reduced motion: advance the bar once per second instead of continuously
        if (!reduceMotion || remaining !== lastShownSecond) setBar((now - runStart) / totalMs);
        lastShownSecond = remaining;
    }

    function finish() {
        clearInterval(interval);
        interval = null;
        finished = true;
        setBar(1);
        countEl.textContent = '✓';
        phaseEl.textContent = 'Done. Well done.';
        noteEl.textContent = '';
        circle.style.transition = reduceMotion ? 'none' : 'transform 0.8s ease-in-out';
        circle.style.transform = 'scale(1)';
        startBtn.hidden = true;
        if (onDone) onDone();
    }

    function start() {
        if (interval || finished) return;
        startBtn.hidden = true;
        el.classList.add('is-running');
        fillEl.style.transition = reduceMotion ? 'none' : 'transform 0.15s linear';
        runStart = performance.now();
        enterStep(0);
        interval = setInterval(tick, 100);
    }

    startBtn.addEventListener('click', start);

    return {
        el,
        destroy() {
            clearInterval(interval);
            interval = null;
        }
    };
}
