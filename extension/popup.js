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

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

// Returns { domains, rejected }: normalized valid domains, and the entries that weren't domains
function parseBlocklist(text) {
    const entries = text.split(/[\s,]+/)
        .map(s => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0])
        .filter(Boolean);
    const unique = [...new Set(entries)];
    return {
        domains: unique.filter(d => DOMAIN_RE.test(d)),
        rejected: unique.filter(d => !DOMAIN_RE.test(d))
    };
}

function showStatus(text) {
    els.saved.textContent = text;
    els.saved.hidden = false;
    setTimeout(() => { els.saved.hidden = true; }, 4000);
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
    const { domains, rejected } = parseBlocklist(els.blocklist.value);

    // Ask for access to any site we don't have yet. permissions.request must start inside this
    // click handler (user gesture), so fire it before any await. The dialog can close this popup,
    // so the blocklist is saved in parallel; the background script re-syncs on either event.
    // Already-granted origins resolve silently, so we can request the whole list in one go.
    const patterns = domains.map(d => `*://*.${d}/*`);
    const permissionRequest = patterns.length
        ? chrome.permissions.request({ origins: patterns })
        : Promise.resolve(true);

    await chrome.storage.local.set({
        name: els.name.value.trim(),
        persona: els.persona.value,
        passMinutes: minutes,
        blocklist: domains
    });
    els.passMinutes.value = minutes;
    els.blocklist.value = domains.join('\n');

    const granted = await permissionRequest.catch(() => false);
    if (!granted) showStatus('Saved. Permission was not granted for the new site(s), so they stay inactive.');
    else if (rejected.length) showStatus(`Saved. Skipped invalid entries: ${rejected.join(', ')}`);
    else showStatus('Saved');
});

init();
