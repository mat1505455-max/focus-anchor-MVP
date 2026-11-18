// Service worker. Seeds defaults on first install and closes the tab on request.
// All data lives in chrome.storage.local, nothing leaves the device.

const DEFAULT_BLOCKLIST = [
    'instagram.com',
    'tiktok.com',
    'x.com',
    'twitter.com',
    'reddit.com',
    'facebook.com',
    'youtube.com'
];

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== 'install') return;
    const { blocklist } = await chrome.storage.local.get('blocklist');
    if (!blocklist) {
        await chrome.storage.local.set({ blocklist: DEFAULT_BLOCKLIST });
    }
});

// Content scripts can't reliably close their own tab, so they ask us
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === 'close-tab' && sender.tab && sender.tab.id !== undefined) {
        chrome.tabs.remove(sender.tab.id);
    }
});
