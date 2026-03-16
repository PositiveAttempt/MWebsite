// ── SHARED — loaded by all 6 drill pages ────────────────────────────────────

const HINTS = {
    '2': n => `${n} + ${n} = ${n * 2}`,
    '3': n => `Double ${n}, add ${n} — ${n * 2} + ${n} = ${n * 3}`,
    '4': n => `Double ${n} = ${n * 2}, double again = ${n * 4}`,
    '5': n => `Half of ${n * 10} — 10 × ${n} ÷ 2 = ${n * 5}`,
    '6': n => `5 × ${n} + ${n} = ${5 * n} + ${n} = ${n * 6}`,
    '7': n => `5 × ${n} + 2 × ${n} = ${5 * n} + ${2 * n} = ${n * 7}`,
    '8': n => `Double ${n} = ${n * 2}, double = ${n * 4}, double = ${n * 8}`,
    '9': n => `10 × ${n} − ${n} = ${10 * n} − ${n} = ${n * 9}`,
    '10': n => `${n} × 10 = ${n * 10}`,
    '11': n => n <= 9 ? `Repeat the digit — ${n}${n} = ${n * 11}` : `10 × ${n} + ${n} = ${10 * n} + ${n} = ${n * 11}`,
    '12': n => `10 × ${n} + 2 × ${n} = ${10 * n} + ${2 * n} = ${n * 12}`,
};


function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── TIMER ────────────────────────────────────────────────────────────────────
// Generation counter kills stale rAF callbacks instantly.
// _clearTimer() always runs before startMCTimer() so there is never
// more than one active loop at a time.
// All pages use id="timer-fill" for the animated bar element.

let _timerGen = 0, _timerTimeout = null, _timerRaf = null, _timerStart = null;
let mcDur = 5000;

function startMCTimer() {
    _clearTimer();
    const gen = ++_timerGen;
    _timerStart = performance.now();
    function tick(now) {
        if (_timerGen !== gen) return;
        const pct = Math.max(0, 1 - (now - _timerStart) / mcDur);
        document.getElementById('timer-fill').style.width = (pct * 100) + '%';
        if (pct > 0) _timerRaf = requestAnimationFrame(tick);
    }
    _timerRaf = requestAnimationFrame(tick);
    _timerTimeout = setTimeout(() => {
        if (_timerGen !== gen) return;
        showMC();
    }, mcDur);
}

function _clearTimer() {
    _timerGen++;
    if (_timerTimeout) { clearTimeout(_timerTimeout); _timerTimeout = null; }
    if (_timerRaf)     { cancelAnimationFrame(_timerRaf); _timerRaf = null; }
    _timerStart = null;
    document.getElementById('timer-fill').style.width = '100%';
}

// ── STATS / PROGRESS ─────────────────────────────────────────────────────────
// All pages use id="s-correct", id="s-wrong", id="s-streak",
// id="prog-fill", and the variable doneCount.

function updateStats() {
    document.getElementById('s-correct').textContent = correct;
    document.getElementById('s-wrong').textContent   = wrong;
    document.getElementById('s-streak').textContent  = streak;
}

function updateProgress() {
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    document.getElementById('prog-fill').style.width = pct + '%';
}

// ── HISTORY ──────────────────────────────────────────────────────────────────

function fmtDrillTime(ms) {
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function saveDrillResult(key, pct, timeStr, sizeLabel) {
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
    const d = new Date();
    hist.unshift({ date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), accuracy: pct, time: timeStr, size: sizeLabel });
    if (hist.length > 5) hist.length = 5;
    try { localStorage.setItem(key, JSON.stringify(hist)); } catch(e) {}
    return hist;
}

function renderDrillHistory(hist) {
    if (!hist.length) return '';
    return '<div class="done-history"><div class="done-history-label">Recent</div>'
        + hist.map(r => `<div class="done-history-row">${r.date} &middot; ${r.size || 'Full'} &middot; ${r.accuracy}% &middot; ${r.time}</div>`).join('')
        + '</div>';
}

// ── DARK MODE ─────────────────────────────────────────────────────────────────

function toggleDark() {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('dark', dark ? '1' : '0'); } catch(e) {}
}
