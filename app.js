// ============================================
// GRE Vocab Mountain — Main Application Logic
// ============================================

// ---- STATE ----
let state = {
    currentScreen: 'home',
    currentGroup: 1,
    currentCardIndex: 0,
    isFlipped: false,
    currentGame: null,
    gameScore: 0,
    gameCorrect: 0,
    gameWrong: 0,
    gameResults: [],
    gameStartTime: null,
    timerInterval: null,
    timerSeconds: 0,
    matchSelected: null,
    quizQuestionIndex: 0,
    quizQuestions: [],
    spellingIndex: 0,
    spellingWords: [],
};

// ---- PERSISTENCE ----
function loadProgress() {
    try {
        const saved = localStorage.getItem('gre_vocab_progress');
        if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {
        wordsStudied: {},      // { "word": { seen: true, easy: bool, hard: bool, correctCount: 0, wrongCount: 0 } }
        groupProgress: {},     // { "1": { cardsViewed: 5, completed: false } }
        gamesPlayed: 0,
        totalCorrect: 0,
        totalWrong: 0,
        streak: 0,
        lastStudyDate: null,
        totalTimeSeconds: 0,
        startTimestamp: Date.now()
    };
}

function saveProgress() {
    try {
        localStorage.setItem('gre_vocab_progress', JSON.stringify(progress));
    } catch (e) { /* ignore */ }
}

let progress = loadProgress();

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
    updateStreak();
    renderHome();
    initParticles();
    updateAllStats();
    
    // Track time
    setInterval(() => {
        progress.totalTimeSeconds++;
        if (progress.totalTimeSeconds % 30 === 0) saveProgress();
    }, 1000);
});

// ---- NAVIGATION ----
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-screen="${screenId}"]`)?.classList.add('active');
    
    state.currentScreen = screenId;
    
    if (screenId === 'home') renderHome();
    if (screenId === 'stats') renderStats();
    if (screenId === 'games') renderGameSelect();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- STREAK ----
function updateStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (progress.lastStudyDate === today) {
        // Already studied today
    } else if (progress.lastStudyDate === yesterday) {
        progress.streak++;
        progress.lastStudyDate = today;
    } else if (progress.lastStudyDate !== today) {
        if (progress.lastStudyDate && progress.lastStudyDate !== yesterday) {
            progress.streak = 0;
        }
        progress.lastStudyDate = today;
        progress.streak = Math.max(progress.streak, 1);
    }
    
    document.getElementById('streak-count').textContent = progress.streak;
    saveProgress();
}

// ---- HOME SCREEN ----
function renderHome() {
    renderHeroStats();
    renderWordOfDay();
    renderGroupsGrid();
}

function renderHeroStats() {
    const wordsLearned = Object.keys(progress.wordsStudied).length;
    const daysCompleted = Object.values(progress.groupProgress).filter(g => g.completed).length;
    const total = progress.totalCorrect + progress.totalWrong;
    const accuracy = total > 0 ? Math.round((progress.totalCorrect / total) * 100) : 0;
    
    document.getElementById('total-words-learned').textContent = wordsLearned;
    document.getElementById('total-days-completed').textContent = daysCompleted;
    document.getElementById('total-accuracy').textContent = accuracy + '%';
    
    // Update mountain climber position
    updateClimber(wordsLearned);
}

function updateClimber(wordsLearned) {
    const totalWords = getAllWords().length;
    const pct = Math.min(wordsLearned / totalWords, 1);
    const dots = [
        { cx: 160, cy: 200 },
        { cx: 180, cy: 170 },
        { cx: 195, cy: 140 },
        { cx: 210, cy: 110 },
        { cx: 205, cy: 80 },
        { cx: 200, cy: 30 },
    ];
    
    const idx = Math.min(Math.floor(pct * (dots.length - 1)), dots.length - 1);
    const dot = dots[idx];
    
    const climber = document.getElementById('climber-dot');
    const glow = document.getElementById('climber-glow');
    if (climber) {
        climber.setAttribute('cx', dot.cx);
        climber.setAttribute('cy', dot.cy);
    }
    if (glow) {
        glow.setAttribute('cx', dot.cx);
        glow.setAttribute('cy', dot.cy);
    }
}

function renderWordOfDay() {
    const allWords = getAllWords();
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const wordData = allWords[dayOfYear % allWords.length];
    const groupNum = findGroupForWord(wordData.word);
    
    document.getElementById('word-of-day').innerHTML = `
        <div>
            <div class="wod-word">${wordData.word}</div>
        </div>
        <div class="wod-details">
            <p class="wod-definition">${wordData.definition}</p>
            <p class="wod-example">"${wordData.example}"</p>
        </div>
        <span class="wod-group">Group ${groupNum}</span>
    `;
}

function renderGroupsGrid() {
    const grid = document.getElementById('groups-grid');
    grid.innerHTML = '';
    
    Object.keys(VOCAB_DATA).forEach(groupNum => {
        const group = VOCAB_DATA[groupNum];
        const gp = progress.groupProgress[groupNum] || { cardsViewed: 0, completed: false };
        const wordCount = group.words.length;
        const masteredInGroup = group.words.filter(w => {
            const ws = progress.wordsStudied[w.word];
            return ws && ws.correctCount >= 2;
        }).length;
        const pct = Math.round((masteredInGroup / wordCount) * 100);
        
        const card = document.createElement('div');
        card.className = `group-card ${gp.completed ? 'completed' : ''}`;
        card.onclick = () => startLearning(parseInt(groupNum));
        card.innerHTML = `
            <div class="group-number">${groupNum}</div>
            <div class="group-label">${group.name.split(' — ')[1] || 'Group ' + groupNum}</div>
            <div class="group-progress">
                <div class="group-progress-fill" style="width: ${pct}%"></div>
            </div>
            <div class="group-word-count">${masteredInGroup}/${wordCount} mastered</div>
        `;
        grid.appendChild(card);
    });
}

// ---- LEARN SCREEN ----
function startLearning(groupNum) {
    state.currentGroup = groupNum;
    state.currentCardIndex = 0;
    state.isFlipped = false;
    
    const group = VOCAB_DATA[groupNum];
    document.getElementById('learn-title').textContent = group.name;
    
    showScreen('learn');
    renderFlashcard();
    updateLearnProgress();
    populateGameGroupSelect();
}

function renderFlashcard() {
    const group = VOCAB_DATA[state.currentGroup];
    const word = group.words[state.currentCardIndex];
    
    document.getElementById('flash-word').textContent = word.word;
    document.getElementById('flash-word-back').textContent = word.word;
    document.getElementById('flash-definition').textContent = word.definition;
    document.getElementById('flash-example').textContent = word.example ? `"${word.example}"` : '';
    
    document.getElementById('card-counter').textContent = 
        `${state.currentCardIndex + 1} / ${group.words.length}`;
    
    // Reset flip
    state.isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');
    
    // Mark as studied
    if (!progress.wordsStudied[word.word]) {
        progress.wordsStudied[word.word] = { seen: true, easy: false, hard: false, correctCount: 0, wrongCount: 0 };
    } else {
        progress.wordsStudied[word.word].seen = true;
    }
    
    // Update group progress
    if (!progress.groupProgress[state.currentGroup]) {
        progress.groupProgress[state.currentGroup] = { cardsViewed: 0, completed: false };
    }
    progress.groupProgress[state.currentGroup].cardsViewed = 
        Math.max(progress.groupProgress[state.currentGroup].cardsViewed, state.currentCardIndex + 1);
    
    saveProgress();
    updateStreak();
}

function flipCard() {
    state.isFlipped = !state.isFlipped;
    document.getElementById('flashcard').classList.toggle('flipped');
}

function nextCard() {
    const group = VOCAB_DATA[state.currentGroup];
    state.currentCardIndex = (state.currentCardIndex + 1) % group.words.length;
    renderFlashcard();
    updateLearnProgress();
}

function prevCard() {
    const group = VOCAB_DATA[state.currentGroup];
    state.currentCardIndex = (state.currentCardIndex - 1 + group.words.length) % group.words.length;
    renderFlashcard();
    updateLearnProgress();
}

function markWord(difficulty) {
    const group = VOCAB_DATA[state.currentGroup];
    const word = group.words[state.currentCardIndex];
    
    if (!progress.wordsStudied[word.word]) {
        progress.wordsStudied[word.word] = { seen: true, easy: false, hard: false, correctCount: 0, wrongCount: 0 };
    }
    
    if (difficulty === 'easy') {
        progress.wordsStudied[word.word].easy = true;
        progress.wordsStudied[word.word].hard = false;
        showToast('😎 Marked as Easy!', 'success');
    } else {
        progress.wordsStudied[word.word].hard = true;
        progress.wordsStudied[word.word].easy = false;
        showToast('😓 Marked for Review', 'error');
    }
    
    saveProgress();
    nextCard();
}

function updateLearnProgress() {
    const group = VOCAB_DATA[state.currentGroup];
    const pct = ((state.currentCardIndex + 1) / group.words.length) * 100;
    document.getElementById('learn-progress-bar').style.width = pct + '%';
    document.getElementById('learn-progress-text').textContent = 
        `${state.currentCardIndex + 1} / ${group.words.length}`;
    
    // Check if completed
    if (state.currentCardIndex + 1 === group.words.length) {
        if (!progress.groupProgress[state.currentGroup]) {
            progress.groupProgress[state.currentGroup] = { cardsViewed: 0, completed: false };
        }
        progress.groupProgress[state.currentGroup].completed = true;
        saveProgress();
    }
}

function continueLearning() {
    // Find the first uncompleted group or start from group 1
    for (let i = 1; i <= Object.keys(VOCAB_DATA).length; i++) {
        const gp = progress.groupProgress[i];
        if (!gp || !gp.completed) {
            startLearning(i);
            return;
        }
    }
    // All completed, start from 1
    startLearning(1);
}

// ---- GAME SELECT ----
function renderGameSelect() {
    populateGameGroupSelect();
}

function populateGameGroupSelect() {
    const select = document.getElementById('game-group-select');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(VOCAB_DATA).forEach(num => {
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = VOCAB_DATA[num].name;
        if (parseInt(num) === state.currentGroup) opt.selected = true;
        select.appendChild(opt);
    });
}

function updateGameGroup() {
    state.currentGroup = parseInt(document.getElementById('game-group-select').value);
}

function playRandomMix() {
    state.currentGroup = 'random';
    startQuiz();
}

// ---- QUIZ GAME ----
function startQuiz() {
    state.currentGame = 'quiz';
    state.gameScore = 0;
    state.gameCorrect = 0;
    state.gameWrong = 0;
    state.gameResults = [];
    state.quizQuestionIndex = 0;
    state.gameStartTime = Date.now();
    
    // Get words for this group
    let words;
    if (state.currentGroup === 'random') {
        words = shuffleArray([...getAllWords()]).slice(0, 15);
    } else {
        words = shuffleArray([...VOCAB_DATA[state.currentGroup].words]);
    }
    
    // Generate quiz questions
    const allWords = getAllWords();
    state.quizQuestions = words.slice(0, 15).map(w => {
        const wrongOptions = shuffleArray(
            allWords.filter(aw => aw.word !== w.word)
        ).slice(0, 3).map(aw => aw.definition);
        
        const options = shuffleArray([w.definition, ...wrongOptions]);
        return {
            word: w.word,
            correctDefinition: w.definition,
            options: options
        };
    });
    
    showGameArea('📝 Definition Quiz');
    renderQuizQuestion();
}

function renderQuizQuestion() {
    if (state.quizQuestionIndex >= state.quizQuestions.length) {
        endGame();
        return;
    }
    
    const q = state.quizQuestions[state.quizQuestionIndex];
    const content = document.getElementById('game-content');
    
    content.innerHTML = `
        <div class="quiz-question">
            <p class="quiz-prompt-label">What does this word mean?</p>
            <h2 class="quiz-word">${q.word}</h2>
            <p class="quiz-question-number">Question ${state.quizQuestionIndex + 1} of ${state.quizQuestions.length}</p>
        </div>
        <div class="quiz-options">
            ${q.options.map((opt, i) => `
                <button class="quiz-option" id="quiz-opt-${i}" onclick="selectQuizAnswer(${i}, '${escapeStr(q.correctDefinition)}')">${opt}</button>
            `).join('')}
        </div>
    `;
    
    updateGameScore();
    startQuestionTimer(15);
}

function selectQuizAnswer(index, correctDef) {
    clearTimer();
    const q = state.quizQuestions[state.quizQuestionIndex];
    const selectedDef = q.options[index];
    const isCorrect = selectedDef === q.correctDefinition;
    
    // Disable all options
    document.querySelectorAll('.quiz-option').forEach(btn => btn.classList.add('disabled'));
    
    // Mark correct/wrong
    const selectedBtn = document.getElementById(`quiz-opt-${index}`);
    if (isCorrect) {
        selectedBtn.classList.add('correct');
        state.gameCorrect++;
        state.gameScore += 100;
        progress.totalCorrect++;
        updateWordProgress(q.word, true);
        showToast('✅ Correct!', 'success');
    } else {
        selectedBtn.classList.add('wrong');
        state.gameWrong++;
        progress.totalWrong++;
        updateWordProgress(q.word, false);
        
        // Show correct answer
        document.querySelectorAll('.quiz-option').forEach((btn, i) => {
            if (q.options[i] === q.correctDefinition) {
                btn.classList.add('reveal');
            }
        });
        showToast('❌ Wrong!', 'error');
    }
    
    state.gameResults.push({ word: q.word, correct: isCorrect, definition: q.correctDefinition });
    saveProgress();
    
    setTimeout(() => {
        state.quizQuestionIndex++;
        renderQuizQuestion();
    }, 1500);
}

// ---- MATCHING GAME ----
function startMatching() {
    state.currentGame = 'matching';
    state.gameScore = 0;
    state.gameCorrect = 0;
    state.gameWrong = 0;
    state.gameResults = [];
    state.matchSelected = null;
    state.gameStartTime = Date.now();
    
    let words;
    if (state.currentGroup === 'random') {
        words = shuffleArray([...getAllWords()]).slice(0, 8);
    } else {
        words = shuffleArray([...VOCAB_DATA[state.currentGroup].words]).slice(0, 8);
    }
    
    state.matchingPairs = words.map(w => ({ word: w.word, definition: w.definition }));
    
    showGameArea('🔗 Match Mania');
    renderMatchingGame();
}

function renderMatchingGame() {
    const content = document.getElementById('game-content');
    const shuffledWords = shuffleArray([...state.matchingPairs]);
    const shuffledDefs = shuffleArray([...state.matchingPairs]);
    
    content.innerHTML = `
        <div class="matching-grid">
            <div class="matching-column">
                <div class="matching-column-label">Words</div>
                ${shuffledWords.map((p, i) => `
                    <div class="match-item" id="match-word-${i}" data-type="word" data-word="${escapeAttr(p.word)}" onclick="selectMatch(this)">${p.word}</div>
                `).join('')}
            </div>
            <div class="matching-column">
                <div class="matching-column-label">Definitions</div>
                ${shuffledDefs.map((p, i) => `
                    <div class="match-item" id="match-def-${i}" data-type="def" data-word="${escapeAttr(p.word)}" onclick="selectMatch(this)">${truncate(p.definition, 60)}</div>
                `).join('')}
            </div>
        </div>
    `;
    
    startQuestionTimer(120);
}

function selectMatch(el) {
    const type = el.dataset.type;
    const word = el.dataset.word;
    
    if (el.classList.contains('matched')) return;
    
    if (!state.matchSelected) {
        // First selection
        state.matchSelected = { el, type, word };
        el.classList.add('selected');
    } else {
        // Second selection
        if (state.matchSelected.el === el) {
            // Deselect
            el.classList.remove('selected');
            state.matchSelected = null;
            return;
        }
        
        if (state.matchSelected.type === type) {
            // Same column, switch selection
            state.matchSelected.el.classList.remove('selected');
            state.matchSelected = { el, type, word };
            el.classList.add('selected');
            return;
        }
        
        // Check match
        if (state.matchSelected.word === word) {
            // Correct match!
            state.matchSelected.el.classList.remove('selected');
            state.matchSelected.el.classList.add('matched');
            el.classList.add('matched');
            state.gameCorrect++;
            state.gameScore += 150;
            progress.totalCorrect++;
            updateWordProgress(word, true);
            state.gameResults.push({ word, correct: true });
            showToast('✅ Match!', 'success');
            
            // Check if all matched
            if (state.gameCorrect === state.matchingPairs.length) {
                clearTimer();
                setTimeout(() => endGame(), 800);
            }
        } else {
            // Wrong match
            state.matchSelected.el.classList.remove('selected');
            state.matchSelected.el.classList.add('wrong-match');
            el.classList.add('wrong-match');
            state.gameWrong++;
            progress.totalWrong++;
            
            setTimeout(() => {
                state.matchSelected?.el?.classList.remove('wrong-match');
                el.classList.remove('wrong-match');
            }, 600);
        }
        
        state.matchSelected = null;
        saveProgress();
    }
}

// ---- SPELLING GAME ----
function startSpelling() {
    state.currentGame = 'spelling';
    state.gameScore = 0;
    state.gameCorrect = 0;
    state.gameWrong = 0;
    state.gameResults = [];
    state.spellingIndex = 0;
    state.gameStartTime = Date.now();
    
    let words;
    if (state.currentGroup === 'random') {
        words = shuffleArray([...getAllWords()]).slice(0, 10);
    } else {
        words = shuffleArray([...VOCAB_DATA[state.currentGroup].words]).slice(0, 10);
    }
    
    state.spellingWords = words;
    
    showGameArea('✏️ Spelling Bee');
    renderSpellingQuestion();
}

function renderSpellingQuestion() {
    if (state.spellingIndex >= state.spellingWords.length) {
        endGame();
        return;
    }
    
    const word = state.spellingWords[state.spellingIndex];
    const hint = word.word[0] + '_'.repeat(word.word.length - 2) + word.word[word.word.length - 1];
    
    const content = document.getElementById('game-content');
    content.innerHTML = `
        <div class="spelling-area">
            <p class="spelling-question-num">Word ${state.spellingIndex + 1} of ${state.spellingWords.length}</p>
            <div class="spelling-definition">${word.definition}</div>
            <p class="spelling-hint">Hint: <strong>${hint}</strong> (${word.word.length} letters)</p>
            <div class="spelling-input-wrapper">
                <input type="text" class="spelling-input" id="spelling-input" 
                    placeholder="Type the word..." 
                    onkeydown="if(event.key==='Enter')checkSpelling()"
                    autocomplete="off" autocorrect="off" spellcheck="false">
                <button class="btn btn-primary" onclick="checkSpelling()">Check</button>
            </div>
            <div class="spelling-feedback" id="spelling-feedback"></div>
        </div>
    `;
    
    updateGameScore();
    setTimeout(() => document.getElementById('spelling-input')?.focus(), 100);
}

function checkSpelling() {
    const input = document.getElementById('spelling-input');
    const word = state.spellingWords[state.spellingIndex];
    const answer = input.value.trim().toLowerCase();
    const correct = word.word.toLowerCase();
    const feedback = document.getElementById('spelling-feedback');
    
    if (!answer) return;
    
    if (answer === correct) {
        input.classList.add('correct');
        feedback.textContent = '✅ Correct! Well done!';
        feedback.style.color = 'var(--success)';
        state.gameCorrect++;
        state.gameScore += 200;
        progress.totalCorrect++;
        updateWordProgress(word.word, true);
        state.gameResults.push({ word: word.word, correct: true });
    } else {
        input.classList.add('wrong');
        feedback.textContent = `❌ The correct spelling is: ${word.word}`;
        feedback.style.color = 'var(--danger)';
        state.gameWrong++;
        progress.totalWrong++;
        updateWordProgress(word.word, false);
        state.gameResults.push({ word: word.word, correct: false, definition: word.definition });
    }
    
    saveProgress();
    
    setTimeout(() => {
        state.spellingIndex++;
        renderSpellingQuestion();
    }, 2000);
}

// ---- CONTEXT CLUES GAME ----
function startContextClues() {
    state.currentGame = 'context';
    state.gameScore = 0;
    state.gameCorrect = 0;
    state.gameWrong = 0;
    state.gameResults = [];
    state.quizQuestionIndex = 0;
    state.gameStartTime = Date.now();
    
    let words;
    if (state.currentGroup === 'random') {
        words = shuffleArray([...getAllWords()]);
    } else {
        words = shuffleArray([...VOCAB_DATA[state.currentGroup].words]);
    }
    
    // Filter words that have context templates or generate generic ones
    state.quizQuestions = words.slice(0, 10).map(w => {
        const template = CONTEXT_TEMPLATES[w.word] || generateContextSentence(w);
        const wrongWords = shuffleArray(
            getAllWords().filter(aw => aw.word !== w.word)
        ).slice(0, 3).map(aw => aw.word);
        
        return {
            word: w.word,
            sentence: template,
            options: shuffleArray([w.word, ...wrongWords])
        };
    });
    
    showGameArea('🧩 Context Clues');
    renderContextQuestion();
}

function generateContextSentence(wordObj) {
    const templates = [
        `The professor described the theory as ___, noting its ${wordObj.synonyms ? wordObj.synonyms[0] : 'unique'} nature.`,
        `Critics found the approach to be ___, which ${wordObj.definition.toLowerCase().includes('not') ? 'disappointed' : 'impressed'} the audience.`,
        `The situation could best be described as ___, meaning ${wordObj.definition.toLowerCase()}.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function renderContextQuestion() {
    if (state.quizQuestionIndex >= state.quizQuestions.length) {
        endGame();
        return;
    }
    
    const q = state.quizQuestions[state.quizQuestionIndex];
    const sentenceHtml = q.sentence.replace('___', '<span class="context-blank">________</span>');
    
    const content = document.getElementById('game-content');
    content.innerHTML = `
        <div class="context-area">
            <p class="spelling-question-num">Question ${state.quizQuestionIndex + 1} of ${state.quizQuestions.length}</p>
            <div class="context-sentence">${sentenceHtml}</div>
            <div class="context-options">
                ${q.options.map((opt, i) => `
                    <button class="context-option" id="ctx-opt-${i}" onclick="selectContextAnswer(${i})">${opt}</button>
                `).join('')}
            </div>
        </div>
    `;
    
    updateGameScore();
}

function selectContextAnswer(index) {
    const q = state.quizQuestions[state.quizQuestionIndex];
    const selected = q.options[index];
    const isCorrect = selected === q.word;
    
    document.querySelectorAll('.context-option').forEach((btn, i) => {
        btn.style.pointerEvents = 'none';
        if (q.options[i] === q.word) btn.classList.add('correct');
    });
    
    const selectedBtn = document.getElementById(`ctx-opt-${index}`);
    
    if (isCorrect) {
        state.gameCorrect++;
        state.gameScore += 150;
        progress.totalCorrect++;
        updateWordProgress(q.word, true);
        showToast('✅ Correct!', 'success');
    } else {
        selectedBtn.classList.add('wrong');
        state.gameWrong++;
        progress.totalWrong++;
        updateWordProgress(q.word, false);
        showToast(`❌ It was: ${q.word}`, 'error');
    }
    
    state.gameResults.push({ word: q.word, correct: isCorrect });
    saveProgress();
    
    setTimeout(() => {
        state.quizQuestionIndex++;
        renderContextQuestion();
    }, 1500);
}

// ---- SYNONYM SPRINT ----
function startSynonymAntonym() {
    state.currentGame = 'synonym';
    state.gameScore = 0;
    state.gameCorrect = 0;
    state.gameWrong = 0;
    state.gameResults = [];
    state.quizQuestionIndex = 0;
    state.gameStartTime = Date.now();
    
    let words;
    if (state.currentGroup === 'random') {
        words = shuffleArray([...getAllWords()]).filter(w => w.synonyms && w.synonyms.length > 0);
    } else {
        words = shuffleArray([...VOCAB_DATA[state.currentGroup].words]).filter(w => w.synonyms && w.synonyms.length > 0);
    }
    
    const allWords = getAllWords().filter(w => w.synonyms && w.synonyms.length > 0);
    
    state.quizQuestions = words.slice(0, 12).map(w => {
        const isSynonym = Math.random() > 0.4; // More synonym questions
        let correctAnswer, questionType;
        
        if (isSynonym && w.synonyms && w.synonyms.length > 0) {
            correctAnswer = w.synonyms[Math.floor(Math.random() * w.synonyms.length)];
            questionType = 'synonym';
        } else if (w.antonyms && w.antonyms.length > 0) {
            correctAnswer = w.antonyms[Math.floor(Math.random() * w.antonyms.length)];
            questionType = 'antonym';
        } else {
            correctAnswer = w.synonyms[0];
            questionType = 'synonym';
        }
        
        // Generate wrong options from other words' synonyms/antonyms
        const wrongPool = allWords
            .filter(aw => aw.word !== w.word)
            .flatMap(aw => questionType === 'synonym' ? (aw.synonyms || []) : (aw.antonyms || []))
            .filter(s => s !== correctAnswer);
        
        const wrongOptions = shuffleArray(wrongPool).slice(0, 3);
        
        return {
            word: w.word,
            type: questionType,
            correctAnswer,
            options: shuffleArray([correctAnswer, ...wrongOptions])
        };
    });
    
    showGameArea('🔄 Synonym Sprint');
    renderSynonymQuestion();
}

function renderSynonymQuestion() {
    if (state.quizQuestionIndex >= state.quizQuestions.length) {
        endGame();
        return;
    }
    
    const q = state.quizQuestions[state.quizQuestionIndex];
    const label = q.type === 'synonym' ? 'SYNONYM' : 'ANTONYM';
    const labelColor = q.type === 'synonym' ? 'var(--success)' : 'var(--danger)';
    
    const content = document.getElementById('game-content');
    content.innerHTML = `
        <div class="quiz-question">
            <p class="quiz-prompt-label">Select the <span style="color: ${labelColor}; font-weight: 800">${label}</span> of</p>
            <h2 class="quiz-word">${q.word}</h2>
            <p class="quiz-question-number">Question ${state.quizQuestionIndex + 1} of ${state.quizQuestions.length}</p>
        </div>
        <div class="quiz-options">
            ${q.options.map((opt, i) => `
                <button class="quiz-option" id="syn-opt-${i}" onclick="selectSynonymAnswer(${i})">${opt}</button>
            `).join('')}
        </div>
    `;
    
    updateGameScore();
    startQuestionTimer(10);
}

function selectSynonymAnswer(index) {
    clearTimer();
    const q = state.quizQuestions[state.quizQuestionIndex];
    const selected = q.options[index];
    const isCorrect = selected === q.correctAnswer;
    
    document.querySelectorAll('.quiz-option').forEach(btn => btn.classList.add('disabled'));
    
    const selectedBtn = document.getElementById(`syn-opt-${index}`);
    
    if (isCorrect) {
        selectedBtn.classList.add('correct');
        state.gameCorrect++;
        state.gameScore += 120;
        progress.totalCorrect++;
        updateWordProgress(q.word, true);
        showToast('✅ Correct!', 'success');
    } else {
        selectedBtn.classList.add('wrong');
        state.gameWrong++;
        progress.totalWrong++;
        updateWordProgress(q.word, false);
        
        document.querySelectorAll('.quiz-option').forEach((btn, i) => {
            if (q.options[i] === q.correctAnswer) btn.classList.add('reveal');
        });
        showToast(`❌ It was: ${q.correctAnswer}`, 'error');
    }
    
    state.gameResults.push({ word: q.word, correct: isCorrect });
    saveProgress();
    
    setTimeout(() => {
        state.quizQuestionIndex++;
        renderSynonymQuestion();
    }, 1500);
}

// ---- WEAK WORDS REVIEW ----
function startReview() {
    const hardWords = getAllWords().filter(w => {
        const ws = progress.wordsStudied[w.word];
        return ws && (ws.hard || ws.wrongCount > ws.correctCount);
    });
    
    if (hardWords.length < 4) {
        showToast('📚 Not enough hard words yet! Keep studying.', 'info');
        return;
    }
    
    // Temporarily override the current group with hard words
    state.currentGroup = 'random';
    const origGroup = state.currentGroup;
    
    // Start a quiz with only hard words
    state.currentGame = 'quiz';
    state.gameScore = 0;
    state.gameCorrect = 0;
    state.gameWrong = 0;
    state.gameResults = [];
    state.quizQuestionIndex = 0;
    state.gameStartTime = Date.now();
    
    const allWords = getAllWords();
    state.quizQuestions = shuffleArray(hardWords).slice(0, Math.min(10, hardWords.length)).map(w => {
        const wrongOptions = shuffleArray(
            allWords.filter(aw => aw.word !== w.word)
        ).slice(0, 3).map(aw => aw.definition);
        
        return {
            word: w.word,
            correctDefinition: w.definition,
            options: shuffleArray([w.definition, ...wrongOptions])
        };
    });
    
    showGameArea('🔁 Weak Words Review');
    renderQuizQuestion();
}

// ---- GAME FRAMEWORK ----
function showGameArea(title) {
    document.getElementById('game-select').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    document.getElementById('game-results').classList.add('hidden');
    document.getElementById('game-content').classList.remove('hidden');
    document.getElementById('game-title').textContent = title;
    updateGameScore();
}

function exitGame() {
    clearTimer();
    document.getElementById('game-select').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    state.currentGame = null;
    state.currentGroup = parseInt(document.getElementById('game-group-select')?.value) || 1;
}

function updateGameScore() {
    document.getElementById('game-score').textContent = `Score: ${state.gameScore}`;
}

function startQuestionTimer(seconds) {
    clearTimer();
    state.timerSeconds = seconds;
    
    const fill = document.getElementById('timer-fill');
    const text = document.getElementById('timer-text');
    
    fill.style.width = '100%';
    fill.classList.remove('warning');
    text.textContent = seconds + 's';
    
    state.timerInterval = setInterval(() => {
        state.timerSeconds--;
        const pct = (state.timerSeconds / seconds) * 100;
        fill.style.width = pct + '%';
        text.textContent = state.timerSeconds + 's';
        
        if (state.timerSeconds <= 5) fill.classList.add('warning');
        
        if (state.timerSeconds <= 0) {
            clearTimer();
            handleTimerExpired();
        }
    }, 1000);
}

function clearTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

function handleTimerExpired() {
    if (state.currentGame === 'quiz' || state.currentGame === 'synonym') {
        // Auto-wrong for current question
        const q = state.quizQuestions[state.quizQuestionIndex];
        if (q) {
            state.gameWrong++;
            progress.totalWrong++;
            updateWordProgress(q.word, false);
            state.gameResults.push({ word: q.word, correct: false });
            showToast('⏰ Time\'s up!', 'error');
            
            saveProgress();
            
            setTimeout(() => {
                state.quizQuestionIndex++;
                if (state.currentGame === 'quiz') renderQuizQuestion();
                else if (state.currentGame === 'synonym') renderSynonymQuestion();
            }, 1000);
        }
    } else if (state.currentGame === 'matching') {
        endGame();
    }
}

function endGame() {
    clearTimer();
    
    const elapsed = Math.round((Date.now() - state.gameStartTime) / 1000);
    const total = state.gameCorrect + state.gameWrong;
    const accuracy = total > 0 ? Math.round((state.gameCorrect / total) * 100) : 0;
    
    progress.gamesPlayed++;
    saveProgress();
    
    // Determine result emoji and title
    let emoji, title;
    if (accuracy >= 90) { emoji = '🏆'; title = 'Outstanding!'; }
    else if (accuracy >= 70) { emoji = '🎉'; title = 'Great Job!'; }
    else if (accuracy >= 50) { emoji = '💪'; title = 'Good Effort!'; }
    else { emoji = '📚'; title = 'Keep Practicing!'; }
    
    document.getElementById('game-content').classList.add('hidden');
    document.getElementById('game-results').classList.remove('hidden');
    
    document.getElementById('results-emoji').textContent = emoji;
    document.getElementById('results-title').textContent = title;
    document.getElementById('result-correct').textContent = state.gameCorrect;
    document.getElementById('result-wrong').textContent = state.gameWrong;
    document.getElementById('result-accuracy').textContent = accuracy + '%';
    document.getElementById('result-time').textContent = formatTime(elapsed);
    
    // Word results
    const resultsWords = document.getElementById('results-words');
    resultsWords.innerHTML = state.gameResults.map(r => `
        <div class="result-word-item ${r.correct ? 'correct-word' : 'wrong-word'}">
            <span>${r.correct ? '✅' : '❌'}</span>
            <strong>${r.word}</strong>
            ${r.definition ? ` — ${truncate(r.definition, 50)}` : ''}
        </div>
    `).join('');
    
    // Confetti for great performance
    if (accuracy >= 80) {
        launchConfetti();
    }
}

function replayGame() {
    document.getElementById('game-results').classList.add('hidden');
    document.getElementById('game-content').classList.remove('hidden');
    
    switch (state.currentGame) {
        case 'quiz': startQuiz(); break;
        case 'matching': startMatching(); break;
        case 'spelling': startSpelling(); break;
        case 'context': startContextClues(); break;
        case 'synonym': startSynonymAntonym(); break;
        default: startQuiz();
    }
}

// ---- STATS SCREEN ----
function renderStats() {
    updateAllStats();
    renderMasteryGrid();
    renderHardWordsList();
}

function updateAllStats() {
    const wordsStudied = Object.keys(progress.wordsStudied).length;
    const mastered = Object.values(progress.wordsStudied).filter(w => w.correctCount >= 3).length;
    const total = progress.totalCorrect + progress.totalWrong;
    const accuracy = total > 0 ? Math.round((progress.totalCorrect / total) * 100) : 0;
    
    document.getElementById('stat-total-words').textContent = wordsStudied;
    document.getElementById('stat-mastered').textContent = mastered;
    document.getElementById('stat-accuracy').textContent = accuracy + '%';
    document.getElementById('stat-games').textContent = progress.gamesPlayed;
    document.getElementById('stat-streak').textContent = progress.streak;
    document.getElementById('stat-time').textContent = formatTime(progress.totalTimeSeconds);
}

function renderMasteryGrid() {
    const grid = document.getElementById('mastery-grid');
    grid.innerHTML = '';
    
    Object.keys(VOCAB_DATA).forEach(groupNum => {
        const group = VOCAB_DATA[groupNum];
        const total = group.words.length;
        const mastered = group.words.filter(w => {
            const ws = progress.wordsStudied[w.word];
            return ws && ws.correctCount >= 2;
        }).length;
        const pct = Math.round((mastered / total) * 100);
        
        const card = document.createElement('div');
        card.className = 'mastery-card';
        card.innerHTML = `
            <div class="mastery-card-header">
                <span class="mastery-card-title">Group ${groupNum}</span>
                <span class="mastery-percentage">${pct}%</span>
            </div>
            <div class="progress-bar" style="width: 100%">
                <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderHardWordsList() {
    const container = document.getElementById('hard-words-list');
    const hardWords = getAllWords().filter(w => {
        const ws = progress.wordsStudied[w.word];
        return ws && (ws.hard || ws.wrongCount > ws.correctCount);
    });
    
    if (hardWords.length === 0) {
        container.innerHTML = '<p class="empty-state">No hard words yet! Start learning to track your progress.</p>';
        return;
    }
    
    container.innerHTML = hardWords.map(w => `
        <div class="hard-word-card">
            <div class="hard-word-name">${w.word}</div>
            <div class="hard-word-def">${w.definition}</div>
        </div>
    `).join('');
}

function confirmReset() {
    if (confirm('Are you sure you want to reset ALL progress? This cannot be undone!')) {
        localStorage.removeItem('gre_vocab_progress');
        progress = loadProgress();
        renderHome();
        renderStats();
        showToast('🗑️ Progress reset!', 'info');
    }
}

// ---- PROGRESS TRACKING ----
function updateWordProgress(word, correct) {
    if (!progress.wordsStudied[word]) {
        progress.wordsStudied[word] = { seen: true, easy: false, hard: false, correctCount: 0, wrongCount: 0 };
    }
    
    if (correct) {
        progress.wordsStudied[word].correctCount++;
        if (progress.wordsStudied[word].correctCount >= 3) {
            progress.wordsStudied[word].easy = true;
            progress.wordsStudied[word].hard = false;
        }
    } else {
        progress.wordsStudied[word].wrongCount++;
        progress.wordsStudied[word].hard = true;
    }
}

// ---- UTILITY FUNCTIONS ----
function getAllWords() {
    const all = [];
    Object.values(VOCAB_DATA).forEach(group => {
        group.words.forEach(w => all.push(w));
    });
    return all;
}

function findGroupForWord(word) {
    for (const [num, group] of Object.entries(VOCAB_DATA)) {
        if (group.words.find(w => w.word === word)) return num;
    }
    return 1;
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '…';
}

function escapeStr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTime(seconds) {
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}

// ---- TOAST NOTIFICATIONS ----
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ---- PARTICLE BACKGROUND ----
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const particles = [];
    const count = 50;
    
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.3 + 0.1,
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
            ctx.fill();
        });
        
        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(99, 102, 241, ${0.05 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// ---- CONFETTI ----
function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confetti = [];
    const colors = ['#6366f1', '#a78bfa', '#c084fc', '#fbbf24', '#34d399', '#f87171', '#60a5fa'];
    
    for (let i = 0; i < 150; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vy: Math.random() * 3 + 2,
            vx: (Math.random() - 0.5) * 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
        });
    }
    
    let frame = 0;
    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frame++;
        
        let alive = false;
        confetti.forEach(c => {
            if (c.opacity <= 0) return;
            alive = true;
            
            c.y += c.vy;
            c.x += c.vx;
            c.rotation += c.rotationSpeed;
            
            if (frame > 120) c.opacity -= 0.01;
            
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation * Math.PI / 180);
            ctx.globalAlpha = Math.max(0, c.opacity);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
        });
        
        if (alive && frame < 300) {
            requestAnimationFrame(animateConfetti);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    animateConfetti();
}

// ---- KEYBOARD SHORTCUTS ----
document.addEventListener('keydown', (e) => {
    if (state.currentScreen === 'learn') {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            flipCard();
        } else if (e.key === 'ArrowRight' || e.key === 'n') {
            nextCard();
        } else if (e.key === 'ArrowLeft' || e.key === 'p') {
            prevCard();
        } else if (e.key === 'e') {
            markWord('easy');
        } else if (e.key === 'h') {
            markWord('hard');
        }
    }
});
