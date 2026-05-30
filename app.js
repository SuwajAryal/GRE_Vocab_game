// ============================================
// GRE Vocab Mountain — Flashcard Logic
// ============================================

let state = {
    currentGroup: 1,
    currentCardIndex: 0,
    isFlipped: false,
    isAnimating: false
};

let progress = {
    wordsStudied: {}, // { "word": { seen: true, easy: bool, hard: bool } }
    groupProgress: {}, // { "1": { cardsViewed: 5, completed: false } }
    streak: 0,
    lastStudyDate: null
};

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    updateStreak();
    initGroupSelector();
    initParticles();
    initTouchSwipes();
    
    // Start with last group or 1
    let startGroup = 1;
    for (let i = 1; i <= Object.keys(VOCAB_DATA).length; i++) {
        const gp = progress.groupProgress[i];
        if (!gp || !gp.completed) {
            startGroup = i;
            break;
        }
    }
    
    document.getElementById('group-select').value = startGroup;
    startLearning(startGroup);
});

// ---- PERSISTENCE ----
function loadProgress() {
    try {
        const saved = localStorage.getItem('gre_vocab_premium');
        if (saved) {
            const parsed = JSON.parse(saved);
            progress = { ...progress, ...parsed };
        }
    } catch (e) { /* ignore */ }
}

function saveProgress() {
    try {
        localStorage.setItem('gre_vocab_premium', JSON.stringify(progress));
    } catch (e) { /* ignore */ }
}

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

// ---- UI LOGIC ----
function initGroupSelector() {
    const select = document.getElementById('group-select');
    select.innerHTML = '';
    Object.keys(VOCAB_DATA).forEach(num => {
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = `Group ${num}`;
        select.appendChild(opt);
    });
}

function changeGroup() {
    const newGroup = parseInt(document.getElementById('group-select').value);
    startLearning(newGroup);
}

function startLearning(groupNum) {
    state.currentGroup = groupNum;
    state.currentCardIndex = 0;
    state.isFlipped = false;
    state.isAnimating = false;
    
    renderFlashcard();
    updateProgressUI();
}

function renderFlashcard() {
    const group = VOCAB_DATA[state.currentGroup];
    const word = group.words[state.currentCardIndex];
    
    document.getElementById('flash-word').textContent = word.word;
    document.getElementById('flash-word-back').textContent = word.word;
    document.getElementById('flash-definition').textContent = word.definition;
    document.getElementById('flash-example').textContent = word.example ? `"${word.example}"` : '';
    
    // Reset flip
    state.isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');
    
    // Mark as studied
    if (!progress.wordsStudied[word.word]) {
        progress.wordsStudied[word.word] = { seen: true, easy: false, hard: false };
    }
    
    if (!progress.groupProgress[state.currentGroup]) {
        progress.groupProgress[state.currentGroup] = { cardsViewed: 0, completed: false };
    }
    progress.groupProgress[state.currentGroup].cardsViewed = 
        Math.max(progress.groupProgress[state.currentGroup].cardsViewed, state.currentCardIndex + 1);
    
    saveProgress();
}

function updateProgressUI() {
    const group = VOCAB_DATA[state.currentGroup];
    const total = group.words.length;
    const current = state.currentCardIndex + 1;
    
    const pct = (current / total) * 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${current} / ${total}`;
    
    if (current === total && !progress.groupProgress[state.currentGroup].completed) {
        progress.groupProgress[state.currentGroup].completed = true;
        saveProgress();
        showToast('🎉 Group Completed!', 'success');
        triggerConfetti();
    }
}

// ---- FLASHCARD INTERACTIONS ----
function flipCard() {
    if (state.isAnimating) return;
    state.isFlipped = !state.isFlipped;
    document.getElementById('flashcard').classList.toggle('flipped');
}

function animateCardChange(direction) {
    if (state.isAnimating) return;
    state.isAnimating = true;
    
    const flashcard = document.getElementById('flashcard');
    
    // Animate out
    if (direction === 'next') {
        flashcard.classList.add('slide-out-left');
    } else {
        flashcard.classList.add('slide-out-right');
    }
    
    setTimeout(() => {
        // Change data
        const group = VOCAB_DATA[state.currentGroup];
        if (direction === 'next') {
            state.currentCardIndex = (state.currentCardIndex + 1) % group.words.length;
        } else {
            state.currentCardIndex = (state.currentCardIndex - 1 + group.words.length) % group.words.length;
        }
        
        renderFlashcard();
        updateProgressUI();
        
        // Swap classes for slide in
        flashcard.classList.remove('slide-out-left', 'slide-out-right');
        if (direction === 'next') {
            flashcard.classList.add('slide-in-right');
        } else {
            flashcard.classList.add('slide-in-left');
        }
        
        // Cleanup
        setTimeout(() => {
            flashcard.classList.remove('slide-in-right', 'slide-in-left');
            state.isAnimating = false;
        }, 800);
    }, 400); // Wait halfway through the 800ms animation to swap contents
}

function nextCard() { animateCardChange('next'); }
function prevCard() { animateCardChange('prev'); }

function markWord(difficulty, e) {
    e.stopPropagation(); // prevent card flip
    const group = VOCAB_DATA[state.currentGroup];
    const word = group.words[state.currentCardIndex];
    
    if (!progress.wordsStudied[word.word]) {
        progress.wordsStudied[word.word] = { seen: true, easy: false, hard: false };
    }
    
    if (difficulty === 'easy') {
        progress.wordsStudied[word.word].easy = true;
        progress.wordsStudied[word.word].hard = false;
        showToast('😎 Easy!', 'success');
    } else {
        progress.wordsStudied[word.word].hard = true;
        progress.wordsStudied[word.word].easy = false;
        showToast('😓 Hard', 'error');
    }
    
    saveProgress();
    nextCard();
}

// ---- MOBILE TOUCH SWIPES ----
function initTouchSwipes() {
    const flashcardArea = document.getElementById('flashcard-area');
    if (!flashcardArea) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    flashcardArea.addEventListener('touchstart', e => {
        if (e.target.closest('button')) return; // Don't block button clicks
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    flashcardArea.addEventListener('touchend', e => {
        if (e.target.closest('button')) return;
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const threshold = 50; 
        const distance = touchEndX - touchStartX;
        
        if (distance > threshold) {
            prevCard(); // Swipe right = previous
        } else if (distance < -threshold) {
            nextCard(); // Swipe left = next
        }
    }
}

// ---- KEYBOARD CONTROLS ----
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
        nextCard();
    } else if (e.key === 'ArrowLeft') {
        prevCard();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        flipCard();
    }
});

// ---- UTILS ----
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
    }, 2500);
}

// ---- PARTICLES & CONFETTI ----
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    
    const particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.1
    }));
    
    function draw() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }
    draw();
    
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });
}

function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const colors = ['#6366f1', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];
    
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            r: Math.random() * 6 + 4,
            dx: Math.random() * 20 - 10,
            dy: Math.random() * -15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            p.dy += 0.5; // gravity
            if (p.y < canvas.height) active = true;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        
        if (active) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    animate();
}
