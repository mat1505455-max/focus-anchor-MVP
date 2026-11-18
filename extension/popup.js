// Popup: local stats for the last 7 days plus settings. Reads/writes chrome.storage.local only.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const els = {
    summary: document.getElementById('summary'),
    hours: document.getElementById('hours'),
    name: document.getElementById('name'),
    persona: document.getElementById('persona'),
    passMinutes: document.getElementById('passMinutes'),
    blocklist: document.getElementById('blocklist'),
    save: document.getElementById('save'),
    saved: document.getElementById('saved')
};

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

function renderStats(events) {
    const recent = events.filter(e => e.t >= Date.now() - WEEK_MS);
    const count = (type) => recent.filter(e => e.type === type).length;
    const pauses = count('shown');
    const anchored = count('anchored');
    const left = count('closed');

    if (pauses === 0) {
        els.summary.textContent = 'No pauses yet. They will show up here.';
    } else {
        // Positive framing: what the user did, never how much time was "wasted"
        els.summary.textContent =
            `You paused ${plural(pauses, 'time')}, completed ${plural(anchored, 'anchor')}, ` +
            `and chose to leave ${plural(left, 'time')}.`;
    }

    const byHour = new Array(24).fill(0);
    recent.filter(e => e.type === 'shown').forEach(e => { byHour[new Date(e.t).getHours()]++; });
    const max = Math.max(...byHour, 1);
    els.hours.replaceChildren(...byHour.map((n, hour) => {
        const bar = document.createElement('div');
        bar.className = n ? 'bar' : 'bar empty';
        bar.style.height = n ? `${Math.max(8, (n / max) * 100)}%` : '2px';
        bar.title = `${hour}:00, ${plural(n, 'pause')}`;
        return bar;
    }));
}

function parseBlocklist(text) {
    const domains = text.split(/[\s,]+/)
        .map(s => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
        .filter(Boolean);
    return [...new Set(domains)];
}

async function init() {
    const { events = [], blocklist = [], name = '', persona = 'empathetic', passMinutes = 10 } =
        await chrome.storage.local.get(['events', 'blocklist', 'name', 'persona', 'passMinutes']);

    renderStats(events);
    els.name.value = name;
    els.persona.value = persona;
    els.passMinutes.value = passMinutes;
    els.blocklist.value = blocklist.join('\n');
}

els.save.addEventListener('click', async () => {
    const minutes = Math.min(120, Math.max(1, parseInt(els.passMinutes.value, 10) || 10));
    await chrome.storage.local.set({
        name: els.name.value.trim(),
        persona: els.persona.value,
        passMinutes: minutes,
        blocklist: parseBlocklist(els.blocklist.value)
    });
    els.passMinutes.value = minutes;
    els.saved.hidden = false;
    setTimeout(() => { els.saved.hidden = true; }, 1500);
});

init();
