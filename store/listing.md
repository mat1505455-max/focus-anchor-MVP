# Chrome Web Store listing: FocusAnchor

## Name
FocusAnchor

## Summary (max 132 characters)
A 5-second sensory anchor that interrupts the automatic scroll. Calm, on-device, no accounts.

(92 characters)

## Category
Productivity (alternative: Lifestyle)

## Description

When you're scrolling on autopilot, willpower rarely helps. FocusAnchor gives you a 5-second cognitive reset instead: a calm pause that pulls your attention back into the present moment, then hands the choice back to you.

HOW IT WORKS
1. You open a site on your list. A calm full-screen pause appears instead of the feed.
2. Press and hold the anchor for 5 seconds. Touch, sound and a slow-filling ring give your body something real to focus on.
3. Try a tiny grounding step, continue on purpose, or close the tab.

NOT A BLOCKER, A RESET
No lockouts, no streak shame, no "wasted time" counters. FocusAnchor interrupts the loop, then you decide. Your weekly summary shows what you chose to do, never what you "failed" at.

GENTLE, LOW-PRESSURE GROUNDING
Steps like "find three blue objects", "press your feet into the floor" or "put the phone face down for a minute". Nothing asks you to close your eyes or revisit anything difficult, and any breath holds are gentle and optional. Don't like one? Tap "Give me another".

100% ON-DEVICE PRIVACY
- No account, no servers, no analytics, no tracking.
- Your name, settings and history are stored only in your browser.
- It only runs on a short starter list (YouTube, Instagram, Reddit, TikTok, Facebook, X) and on sites you add, and Chrome asks your permission for each new site.

EARLY PROTOTYPE
This is an early version and feedback is welcome.

FocusAnchor is a self-regulation tool. It is not a medical device and is not a substitute for professional care.

## Single purpose (Developer Dashboard field)
Show a short, calming pause screen with a 5-second hold-to-anchor interaction before the user continues on sites they chose to be interrupted on.

## Permission justifications (Developer Dashboard fields)
- **storage**: Saves the user's name, site list, pause-free time and a local event log (domain and timestamp) used for the user's own weekly summary. Nothing is transmitted.
- **scripting**: Registers the pause-screen content script for the sites on the user's list, including sites the user adds later.
- **Host permissions (youtube.com, instagram.com, reddit.com, tiktok.com, facebook.com, x.com, twitter.com)**: Required to show the pause screen on this starter list of common distraction sites.
- **Optional host permissions (all sites)**: Requested at runtime only for a specific site the user adds to their list. Never requested for all sites at once.
- **Remote code**: None. All code is packaged in the extension.

## Data usage disclosure (Developer Dashboard)
- Data collected: none transmitted. The extension stores user-provided settings and a local event log on the device only.
- Not sold, not used for unrelated purposes, not used for creditworthiness or lending.
- Privacy policy URL: https://mat1505455-max.github.io/focus-anchor-MVP/landing/privacy.html

## Screenshots to capture (1280x800)
1. The anchor screen over a blurred feed (headline visible).
2. The "Anchor locked" screen with a grounding task and the three choices.
3. The popup with the weekly summary and the hour-of-day chart.
4. The settings area showing the site list and the permission prompt when adding a site.
