// Service worker. Responsibilities:
//  1. Seed the starter blocklist on first install.
//  2. Keep one dynamic content-script registration in sync with the blocklist, limited to
//     sites Chrome has actually granted host permission for (starter list + user-approved extras).
//  3. Close a tab on request.
// (Single-page-app navigation is detected inside the content script, so no webNavigation permission.)
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
        js: ['data.js', 'pacer.js', 'content.js'],
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

// Heebo is bundled in the extension. Content scripts ask us for the bytes (instead of fetching a
// web-accessible resource) so the font can't be probed or blocked by a host page's CSP.
let fontBase64 = null;
async function getFontBase64() {
    if (fontBase64) return fontBase64;
    const response = await fetch(chrome.runtime.getURL('fonts/heebo-latin.woff2'));
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    fontBase64 = btoa(binary);
    return fontBase64;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !sender.tab) return; // only content scripts talk to us

    // Content scripts can't reliably close their own tab, so they ask us
    if (message.type === 'close-tab' && sender.tab.id !== undefined) {
        chrome.tabs.remove(sender.tab.id);
        return;
    }

    if (message.type === 'get-font') {
        getFontBase64()
            .then((base64) => sendResponse({ base64 }))
            .catch(() => sendResponse({ base64: null }));
        return true; // keep the channel open for the async response
    }
});
