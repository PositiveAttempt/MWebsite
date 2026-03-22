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
    if (_timerRaf) { cancelAnimationFrame(_timerRaf); _timerRaf = null; }
    _timerStart = null;
    document.getElementById('timer-fill').style.width = '100%';
}

// ── STATS / PROGRESS ─────────────────────────────────────────────────────────
// All pages use id="s-correct", id="s-wrong", id="s-streak",
// id="prog-fill", and the variable doneCount.

function updateStats() {
    document.getElementById('s-correct').textContent = correct;
    document.getElementById('s-wrong').textContent = wrong;
    document.getElementById('s-streak').textContent = streak;
    updateProgress();
}

function updateProgress() {
    const done = total > 0 ? (doneCount / (doneCount + queue.length)) * 100 : 0;
    const pendingWrong = Object.keys(missed).length;
    const wrongPct = Math.min((pendingWrong / (doneCount + queue.length + pendingWrong)) * 100, 100 - done);
    document.getElementById('prog-fill').style.width = done + '%';
    const wrongEl = document.getElementById('prog-wrong');
    if (wrongEl) wrongEl.style.width = wrongPct + '%';
}

// ── HISTORY ──────────────────────────────────────────────────────────────────next

function fmtDrillTime(ms) {
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function _parseTimeSecs(t) {
    const p = (t || '').split(':');
    if (p.length !== 2) return 9999;
    return parseInt(p[0]) * 60 + parseInt(p[1]);
}

function saveDrillResult(baseKey, sessionKey, pct, timeStr, sizeLabel, spm) {
    const d = new Date();
    const entry = {
        date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        accuracy: pct, time: timeStr, size: sizeLabel, spm: spm
    };

    // recent: saved against base key (all session sizes merged)
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem(baseKey) || '[]'); } catch (e) { }
    hist.unshift(entry);
    if (hist.length > 5) hist.length = 5;
    try { localStorage.setItem(baseKey, JSON.stringify(hist)); } catch (e) { }

    // leaderboard: saved against session key (per session size)
    const lbKey = sessionKey + '_lb';
    let lb = [];
    try { lb = JSON.parse(localStorage.getItem(lbKey) || '[]'); } catch (e) { }
    lb.push(entry);
    lb.sort((a, b) => b.accuracy - a.accuracy || _parseTimeSecs(a.time) - _parseTimeSecs(b.time));
    if (lb.length > 5) lb.length = 5;
    try { localStorage.setItem(lbKey, JSON.stringify(lb)); } catch (e) { }

    const isNewBest = lb[0].accuracy === pct && lb[0].time === timeStr && lb[0].date === entry.date;
    return { hist, lb, isNewBest };
}

function renderArcadePanels(hist, lb, isNewBest) {
    const medals = ['gold', 'silver', 'bronze'];

    const fmtRecent = (r) =>
        `<div class="lb-panel-row">
            <span class="lb-acc">${r.accuracy}%</span>
            <span class="lb-meta">${r.time} · ${r.size || 'Full'} · ${r.date}</span>
        </div>`;

    const fmtLb = (r, i) =>
        `<div class="lb-panel-row ${i === 0 && isNewBest ? 'new-best' : ''}">
            <span class="lb-rank ${i < 3 ? medals[i] : ''}">${i + 1}</span>
            <span class="lb-acc">${r.accuracy}%</span>
            <span class="lb-meta">${r.time} · ${r.size || 'Full'} · ${r.date}${i === 0 && isNewBest ? '<span class="lb-best-badge">best</span>' : ''}</span>
        </div>`;

    const recentHtml = hist.length
        ? hist.map(fmtRecent).join('')
        : '<div style="color:#c8c4bc;font-size:12px;padding:4px 0">None yet</div>';

    const lbHtml = lb.length
        ? lb.map(fmtLb).join('')
        : '<div style="color:#c8c4bc;font-size:12px;padding:4px 0">None yet</div>';

    return `<div class="done-panels">
        <div class="lb-panel">
            <div class="lb-panel-label">Recent</div>
            ${recentHtml}
        </div>
        <div class="lb-panel">
            <div class="lb-panel-label">Best</div>
            ${lbHtml}
        </div>
    </div>`;
}

function renderDrillHistory({ hist, lb, isNewBest }) {
    if (!hist.length && !lb.length) return '';
    return renderArcadePanels(hist, lb, isNewBest);
}

// ── WEAKNESS TRACKING ────────────────────────────────────────────────────────

function recordWeakness(factKey, isWrong) {
    let data = {};
    try { data = JSON.parse(localStorage.getItem('weaknesses') || '{}'); } catch (e) {}
    if (!data[factKey]) data[factKey] = { attempts: 0, wrong: 0 };
    data[factKey].attempts++;
    if (isWrong) data[factKey].wrong++;
    try { localStorage.setItem('weaknesses', JSON.stringify(data)); } catch (e) {}
}

function renderWeaknessPanel() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem('weaknesses') || '{}'); } catch (e) {}
    const qualified = Object.entries(data)
        .filter(([, v]) => v.attempts >= 3)
        .map(([k, v]) => ({ key: k, ratio: v.wrong / v.attempts, wrong: v.wrong, attempts: v.attempts }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 8);
    if (!qualified.length) return '';
    const rows = qualified.map(({ key, wrong, attempts }) => {
        const label = key.includes('/')
            ? key.replace('/', ' ÷ ')
            : key.replace('x', ' × ');
        return `<div class="lb-panel-row">
            <span style="flex:1">${label}</span>
            <span style="font-size:11px;color:#9a8060;letter-spacing:.04em">${wrong}/${attempts}</span>
        </div>`;
    }).join('');
    return `<div class="lb-panel" style="margin-top:1rem;grid-column:1/-1">
        <div class="lb-panel-label">Weaknesses</div>
        ${rows}
    </div>`;
}

// ── DARK MODE ─────────────────────────────────────────────────────────────────

function toggleDark() {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('dark', dark ? '1' : '0'); } catch (e) { }
}

// ── LEADERBOARD SHORTCUT ──────────────────────────────────────────────────────
// Call initLeaderboardShortcut(histKey) on any drill page.
// Press L to open, Escape or click backdrop to close.

function initLeaderboardShortcut(baseKeyOrFn, sessionKeyOrFn) {
    const getBaseKey = typeof baseKeyOrFn === 'function' ? baseKeyOrFn : () => baseKeyOrFn;
    const getSessionKey = typeof sessionKeyOrFn === 'function' ? sessionKeyOrFn : () => sessionKeyOrFn;

    function buildOverlay() {
        const el = document.createElement('div');
        el.id = 'lb-shortcut-overlay';
        el.style.cssText = `
            display:none;position:fixed;inset:0;z-index:999;
            background:rgba(26,25,22,0.45);backdrop-filter:blur(3px);
            align-items:center;justify-content:center;
        `;
        el.innerHTML = `
            <div id="lb-shortcut-card" style="
                background:#faf9f7;border:0.5px solid #c8c4bc;border-radius:2px;
                padding:2rem 2.5rem;width:100%;max-width:520px;margin:1rem;
                font-family:'EB Garamond',serif;
            ">
                <div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:500;margin-bottom:1.4rem;letter-spacing:.05em;">Leaderboard</div>
                <div id="lb-shortcut-body"></div>
                <div style="margin-top:1.4rem;font-size:11px;color:#c8c4bc;letter-spacing:.12em;text-transform:uppercase;">L or Esc to close</div>
            </div>
        `;
        document.body.appendChild(el);
        return el;
    }

    function openOverlay() {
        let overlay = document.getElementById('lb-shortcut-overlay');
        if (!overlay) overlay = buildOverlay();

        const histKey = getBaseKey();
        const lbKey = getSessionKey() + '_lb';
        let hist = [], lb = [];
        try { hist = JSON.parse(localStorage.getItem(histKey) || '[]'); } catch (e) { }
        try { lb = JSON.parse(localStorage.getItem(lbKey) || '[]'); } catch (e) { }

        const body = document.getElementById('lb-shortcut-body');
        body.innerHTML = renderArcadePanels(hist, lb, false) + renderWeaknessPanel();

        // dark mode
        const dark = document.documentElement.classList.contains('dark');
        const card = document.getElementById('lb-shortcut-card');
        card.style.background = dark ? '#0d0f12' : '#faf9f7';
        card.style.borderColor = dark ? '#252830' : '#c8c4bc';
        card.style.color = dark ? '#c8c4bc' : '#1a1916';

        overlay.style.display = 'flex';
    }

    function closeOverlay() {
        const overlay = document.getElementById('lb-shortcut-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'l' || e.key === 'L') {
            const overlay = document.getElementById('lb-shortcut-overlay');
            if (overlay && overlay.style.display === 'flex') { closeOverlay(); return; }
            openOverlay();
        }
        if (e.key === 'Escape') closeOverlay();
    });
}