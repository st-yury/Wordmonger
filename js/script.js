const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TIMER_DURATION = 10;
const STREAK_MAX = 10;
const MASTERY_MAX = 10;

let state = {
    currentLevel: 0,
    correctStreak: 0,
    mastery: 0,
    linguistScore: 0,
    words: [],
    currentWord: null,
    timerInterval: null,
    timeLeft: TIMER_DURATION,
    hasAnswered: false,
    autoStartTimer: false,
    language: 'en-ru'
};

function expandApp() {
    if (!window.Telegram?.WebApp) return;

    const tg = Telegram.WebApp;
    tg.expand();

    const contentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;

    if (contentHeight > viewportHeight) {
        tg.viewportHeight = contentHeight;
    }

    if (!tg.isMobile) {
        document.body.style.minHeight = `${contentHeight + 20}px`;
    }
}

if (window.Telegram?.WebApp) {
    const tg = Telegram.WebApp;
    tg.ready();

    setTimeout(expandApp, 100);

    window.addEventListener('resize', () => {
        expandApp();
    });

    tg.onEvent('viewportChanged', expandApp);

    if (tg.colorScheme === 'dark') document.body.classList.add('theme-dark');

    if (tg.themeParams) {
        const root = document.documentElement;
        const p = tg.themeParams;
        if (p.bg_color) root.style.setProperty('--bg-color', p.bg_color);
        if (p.text_color) root.style.setProperty('--text-color', p.text_color);
        if (p.hint_color) root.style.setProperty('--hint-color', p.hint_color);
        if (p.link_color) root.style.setProperty('--link-color', p.link_color);
        if (p.secondary_bg_color) root.style.setProperty('--secondary-bg', p.secondary_bg_color);
        tg.setHeaderColor(p.bg_color || '#ffffff');
        tg.setBackgroundColor(p.bg_color || '#ffffff');
    }
}

window.addEventListener('load', () => {
    if (!window.Telegram?.WebApp) {
        document.body.style.minHeight = '100vh';
        document.body.style.height = 'auto';
    }
    expandApp();
});

function handleStop() {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
    }
    if (window.Telegram?.WebApp?.close) {
        Telegram.WebApp.close();
    } else {
        stopTimer();
        alert("Game Paused");
    }
}

function setLanguage(langMode) {
    if (state.language === langMode) return;
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    state.language = langMode;
    updateLanguageButtons();
    state.correctStreak = 0;
    state.autoStartTimer = false;
    updateUI();
    loadWords();
}

function updateLanguageButtons() {
    const btnEnRu = document.getElementById('btn-en-ru');
    const btnRuEn = document.getElementById('btn-ru-en');
    btnEnRu.classList.remove('active-mode');
    btnRuEn.classList.remove('active-mode');
    if (state.language === 'en-ru') btnEnRu.classList.add('active-mode');
    else btnRuEn.classList.add('active-mode');
}

function updateUI() {
    const badges = document.querySelectorAll('.level-badge');
    badges.forEach((b, i) => {
        b.classList.remove('active');
        if (i === state.currentLevel) b.classList.add('active');
    });

    const streakContainer = document.getElementById('streakDots');
    streakContainer.className = 'streak-visual';
    streakContainer.innerHTML = '';
    for (let i = 0; i < STREAK_MAX; i++) {
        const dot = document.createElement('div');
        dot.className = 'streak-dot';
        if (i < state.correctStreak) dot.classList.add('filled');
        streakContainer.appendChild(dot);
    }

    const statsRow = document.getElementById('statsRow');
    if (state.currentLevel === 5) {
        statsRow.classList.add('visible');
        document.getElementById('masteryVal').innerHTML = `${state.mastery}<span>/${MASTERY_MAX}</span>`;
        document.getElementById('scoreVal').textContent = state.linguistScore;
    } else {
        statsRow.classList.remove('visible');
    }

    setTimeout(expandApp, 100);
}

function resetTimerVisuals() {
    const bar = document.getElementById('timerBar');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    bar.className = 'timer-progress';
    void bar.offsetWidth;
}

function startTimer() {
    state.timeLeft = TIMER_DURATION;
    state.hasAnswered = false;
    const bar = document.getElementById('timerBar');
    resetTimerVisuals();
    setTimeout(() => {
        bar.style.transition = `transform ${TIMER_DURATION}s linear, background-color 0.5s ease`;
        bar.style.transform = 'scaleX(0)';
    }, 50);

    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timeLeft--;
        if (state.timeLeft === 5) bar.classList.add('yellow');
        else if (state.timeLeft === 2) { bar.classList.remove('yellow'); bar.classList.add('red'); }
        if (state.timeLeft <= 0) { stopTimer(); handleTimeout(); }
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
}

function handleTimeout() {
    if (state.hasAnswered) return;
    state.hasAnswered = true;
    stopTimer();
    const allBtns = document.querySelectorAll('.option');
    allBtns.forEach(b => b.style.pointerEvents = 'none');
    handleWrongAnswer(null);
}

function loadWords() {
    const levelName = LEVELS[state.currentLevel];
    const loading = document.getElementById('loading');
    const content = document.getElementById('cardContent');
    stopTimer();
    resetTimerVisuals();
    loading.style.display = 'flex';
    content.style.display = 'none';
    document.getElementById('loadingText').textContent = `Loading ${levelName}...`;

    const langPrefix = state.language === 'en-ru' ? 'enrus' : 'rusen';
    fetch(`words/words_${langPrefix}_${levelName}.json`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(words => {
            if (!words || !words.length) throw new Error('No words');
            state.words = words;
            setTimeout(() => {
                loading.style.display = 'none';
                content.style.display = 'flex';
                content.classList.add('fade-in');
                nextWord();
                expandApp();
            }, 200);
        })
        .catch(err => {
            console.error(err);
            document.getElementById('loadingText').textContent = 'Error loading file';
        });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function nextWord() {
    if (!state.words || state.words.length === 0) return loadWords();
    stopTimer();
    state.hasAnswered = false;
    state.currentWord = state.words[Math.floor(Math.random() * state.words.length)];
    document.getElementById('word').textContent = state.currentWord.word.toUpperCase();
    document.getElementById('transcription').textContent = state.currentWord.transcription || '';
    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';
    state.currentWord.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option slide-up';
        btn.textContent = capitalize(opt.text);
        btn.style.animationDelay = `${i * 30}ms`;
        btn.onclick = () => handleAnswer(opt.correct, btn);
        optionsContainer.appendChild(btn);
    });
    if (state.autoStartTimer) setTimeout(() => startTimer(), 150);
    else resetTimerVisuals();
}

function handleAnswer(correct, btn) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;
    stopTimer();

    const allBtns = document.querySelectorAll('.option');
    allBtns.forEach(b => b.style.pointerEvents = 'none');

    if (correct) {
        // === SUCCESS ===
        btn.classList.add('correct');
        const card = document.getElementById('card');
        card.classList.add('correct-animation');
        setTimeout(() => card.classList.remove('correct-animation'), 250);

        try {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                Telegram.WebApp.HapticFeedback.impactOccurred('light');
            }
        } catch (e) {}
        // ---------------------------------------

        state.correctStreak++;
        state.autoStartTimer = true;

        if (state.correctStreak >= STREAK_MAX) {
            state.correctStreak = 0;

            if (state.currentLevel === 5) {
                state.mastery++;
                if (state.mastery >= MASTERY_MAX) {
                    state.mastery = 0;
                    state.linguistScore++;
                    try {
                        if (window.Telegram?.WebApp?.HapticFeedback) {
                            Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                        }
                    } catch(e) {}
                }
                updateUI();
            } else {
                state.currentLevel++;
                try {
                    if (window.Telegram?.WebApp?.HapticFeedback) {
                        Telegram.WebApp.HapticFeedback.notificationOccurred('success');
                    }
                } catch(e) {}
                updateUI();
                setTimeout(() => loadWords(), 300);
                return;
            }
        }

        updateUI();
        setTimeout(() => nextWord(), 300);

    } else {
        // === ERROR ===
        handleWrongAnswer(btn);
    }
}

function handleWrongAnswer(btn) {
    const card = document.getElementById('card');
    if (btn) btn.classList.add('wrong');
    card.classList.add('wrong-animation');
    setTimeout(() => card.classList.remove('wrong-animation'), 250);
    document.getElementById('streakDots').classList.add('error');

    try {
        if (window.Telegram?.WebApp?.HapticFeedback) {
            Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
    } catch (e) {
        console.log('Haptic error ignored');
    }
    // ---------------------------------

    state.autoStartTimer = false;
    setTimeout(() => {
        if (state.currentLevel > 0) {
            state.currentLevel--;
            state.correctStreak = 0;
            updateUI();
            loadWords();
        } else {
            state.correctStreak = 0;
            updateUI();
            nextWord();
        }
    }, 400);
}

updateLanguageButtons();
updateUI();
loadWords();

document.addEventListener('DOMContentLoaded', () => {
    expandApp();

    if (window.Telegram?.WebApp && !window.Telegram.WebApp.isMobile) {
        document.body.style.minHeight = '100vh';
        document.body.style.height = 'auto';
        setTimeout(expandApp, 300);
    }
});