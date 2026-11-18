// Service worker. Responsibilities:
//  1. Seed the starter blocklist on first install.
//  2. Keep one dynamic content-script registration in sync with the blocklist, limited to
//     sites Chrome has actually granted host permission for (starter list + user-approved extras).
//  3. Tell the content script to re-check on single-page-app navigations.
//  4. Close a tab on request.
// All data lives in chrome.storage.local, nothing leaves the device.

const DEFAULT_BLOCKLIST = [
    'youtube.com',
    'instagram.com',
    'reddit.com',
    'tiktok.com',
    'facebook.com',
    'x.com',
    'twitter.com'
];
const SCRIPT_ID = 'focus-anchor';

const patternFor = (domain) => `*://*.${domain}/*`; // covers the apex domain and subdomains

async function syncContentScripts() {
    const { blocklist = [] } = await chrome.storage.local.get('blocklist');

    const matches = [];
    for (const domain of blocklist) {
        const granted = await chrome.permissions.contains({ origins: [patternFor(domain)] });
        if (granted) matches.push(patternFor(domain));
    }

    try {
        await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    } catch (e) { /* not registered yet */ }

    if (matches.length === 0) return;
    await chrome.scripting.registerContentScripts([{
        id: SCRIPT_ID,
        matches,
        js: ['data.js', 'content.js'],
        runAt: 'document_start',
        persistAcrossSessions: true
    }]);
}

// Serialize syncs so two quick triggers can't race on the same registration id
let syncChain = Promise.resolve();
function scheduleSync() {
    syncChain = syncChain.then(syncContentScripts).catch((e) => console.error('FocusAnchor sync failed', e));
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === 'install') {
        const { blocklist } = await chrome.storage.local.get('blocklist');
        if (!blocklist) await chrome.storage.local.set({ blocklist: DEFAULT_BLOCKLIST });
    }
    scheduleSync();
});
chrome.runtime.onStartup.addListener(scheduleSync);

// Blocklist edited, or the user granted/revoked a site permission
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.blocklist) scheduleSync();
});
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);

// Single-page apps change the URL without a page load. The content script is already in the page,
// so ask it to re-check (it shows the overlay if the site is blocked and no pause-free pass is active).
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    if (details.frameId !== 0) return; // top frame only
    try {
        const { blocklist = [] } = await chrome.storage.local.get('blocklist');
        const host = new URL(details.url).hostname.toLowerCase();
        const blocked = blocklist.some(d => host === d || host.endsWith('.' + d));
        if (blocked) await chrome.tabs.sendMessage(details.tabId, { type: 'check' });
    } catch (e) { /* no content script in this tab, or the tab is gone */ }
});

// Content scripts can't reliably close their own tab, so they ask us
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === 'close-tab' && sender.tab && sender.tab.id !== undefined) {
        chrome.tabs.remove(sender.tab.id);
    }
});
