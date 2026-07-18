// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================

let userName = localStorage.getItem('focus_anchor_user_name'); 

const getPersonaData = (name) => ({
    commander: {
        title: `מפקד: "${name}, עזוב את הגלילה."`,
        instruction: "שים את הטלפון בצד, קח נשימה ובוא נחזור לעבודה. קדימה."
    },
    empathetic: {
        title: `חבר: "היי ${name}, הכל בסדר."`,
        instruction: "טבעי לגמרי שברחת לפה, בוא ננשום שניה ביחד."
    },
    analytical: {
        title: "חוקר: \"זיהיתי לולאת דופמין קצרת-טווח.\"",
        instruction: "חזרה כעת לתרגיל למשך 3 דקות תקטע את שרשרת הדחיינות."
    }
});


let appState = {
    currentPersona: 'commander',
    currentScreen: 'screen-onboarding',
    timerInterval: null
};

// ==========================================
// 2. SCREEN NAVIGATION & TEXT INJECTION
// ==========================================

function navigateTo(screenId) {
    appState.currentScreen = screenId;
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
    }
    
    if (screenId === 'screen-intervention') {
        loadInterventionText();
    }
}

function loadInterventionText() {
    const allPersonas = getPersonaData(userName);
    const personaData = allPersonas[appState.currentPersona];
    
    const titleEl = document.getElementById('intervention-title');
    const descEl = document.getElementById('intervention-desc');
    
    if (titleEl && descEl) {
        titleEl.textContent = personaData.title;
        descEl.textContent = personaData.instruction;
    }
}

// ==========================================
// 3. CORE GROUNDING LOGIC (Haptic & Timer)
// ==========================================

function startGrounding() {
    let timeLeft = 5;
    const countdownEl = document.getElementById('countdown-timer');
    
    if (countdownEl) countdownEl.textContent = timeLeft;
    
    // פולס רטט ראשוני (Bottom-up trigger) לסימון תחילת המגע
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]); 
    }
    
    // מנגנון ספירה לאחור של 5 שניות
    appState.timerInterval = setInterval(() => {
        timeLeft--;
        if (countdownEl) countdownEl.textContent = timeLeft;
        
        // פולס רטט קצר בכל שנייה שעוברת בשביל הפידבק התחושתי
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        
        if (timeLeft <= 0) {
            clearInterval(appState.timerInterval);
            completeGrounding();
        }
    }, 1000);
}

function stopGrounding() {
    // אם המשתמש עזב את העוגן לפני הזמן - מאפסים הכל כדי למנוע קיצורי דרך
    clearInterval(appState.timerInterval);
    if (navigator.vibrate) {
        navigator.vibrate(0); // עצירת כל רטט פעיל מיידית
    }
    
    // החזרת התצוגה למצב ההתחלתי
    const countdownEl = document.getElementById('countdown-timer');
    if (countdownEl) countdownEl.textContent = "5";
}

function completeGrounding() {
    // פידבק סיום חזק ומורגש (חצי שנייה של רטט רציף)
    if (navigator.vibrate) {
        navigator.vibrate(500);
    }
    // מעבר למסך ההנעה לפעולה המיקרוסקופית
    navigateTo('screen-action');
}
// ==========================================
// 4. EVENT LISTENERS (מסך 1)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    
    const personaButtons = document.querySelectorAll('.btn-persona');
    personaButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // נשמור את הפרסונה שנבחרה בתוך ה-State
            appState.currentPersona = e.target.getAttribute('data-persona');
            
            // שינוי ויזואלי קטן (נדגיש את הכפתור הנבחר - נטפל בעיצוב ב-CSS אחר כך)
            personaButtons.forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            
            console.log(`הפרסונה הנבחרת עודכנה ל: ${appState.currentPersona}`);
        });
    });

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const inputEl = document.getElementById('username-input');
            
            // אם המשתמש הקליד שם, נעדכן את המשתנה הגלובלי ונשמור בדפדפן
            if (inputEl && inputEl.value.trim() !== "") {
                userName = inputEl.value.trim();
                localStorage.setItem('focus_anchor_user_name', userName);
            }
            
            console.log(`המשתמש ${userName} ממשיך למסך ההתערבות עם פרסונת ${appState.currentPersona}`);
            
            // נעבור למסך הבא (מסך 2)
            navigateTo('screen-intervention');
        });
    }
    // 3. האזנה למגע בעוגן הקרקוע (מסך 2)
    const touchAnchor = document.getElementById('touch-anchor');
    if (touchAnchor) {
        // אירועי תחילת לחיצה (עכבר ומובייל)
        touchAnchor.addEventListener('mousedown', startGrounding);
        touchAnchor.addEventListener('touchstart', (e) => {
            e.preventDefault(); // מונע התנהגויות ברירת מחדל של דפדפנים במובייל
            startGrounding();
        });

        // אירועי עזיבה/ניתוק מגע (עכבר ומובייל)
        touchAnchor.addEventListener('mouseup', stopGrounding);
        touchAnchor.addEventListener('mouseleave', stopGrounding); // למקרה שהעכבר יצא מגבולות העיגול
        touchAnchor.addEventListener('touchend', stopGrounding);
        touchAnchor.addEventListener('touchcancel', stopGrounding);
    }
    // 4. האזנה לכפתור איפוס (מסך 3)
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // החזרה למסך הראשון כדי לאפשר סבב מיקוד חדש בעת הצורך
            navigateTo('screen-onboarding');
        });
    }
});