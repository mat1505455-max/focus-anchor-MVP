# FocusAnchor (MVP) ⚓

A bottom-up sensory intervention app that breaks dopamine loops, procrastination, and freeze responses during study sessions.

## 🎯 MVP Goal
Build a lean mobile-first web app prototype that lets the user pick a tailored address persona and delivers a 5-second physiological anchor (touch, vibration, and visual feedback) to interrupt procrastination in real time.

## 📱 App Flow (3 Screens)
1. **Onboarding:** The user selects an address persona (Commander / Friend / Explorer). The choice is persisted in `localStorage`.
2. **Intervention:** Displays persona-specific copy and a circular "anchor" target where the user places a finger.
3. **Grounding:** The user holds the anchor for 5 seconds while a countdown runs and haptic feedback fires (Vibration API). On completion, a CTA button launches a micro-task.

## 🛠️ Tech Stack
- HTML5 (semantic, minimal markup)
- CSS3 (pulse keyframe animation, mobile-first responsive layout)
- Vanilla JavaScript (screen state management, Web Vibration API)

## 🚀 Development Roadmap (Tranche 1)
- [ ] Style the three screens in CSS and make them mobile-responsive.
- [ ] Implement screen-switching logic and persist the selected persona in `localStorage`.
- [ ] Integrate the countdown timer and haptic feedback (Web Vibration API).
- [ ] Run an initial beta test with friends in real-world conditions.
