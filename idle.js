(function () {
    'use strict';

    // ── PNG ASSETS ────────────────────────────────────────────────────────────
    //
    //  assets/sea-far.png    — CW × 400 px, tileable vertically
    //  assets/sea-near.png   — CW × 400 px, tileable vertically
    //  assets/ship.png       — 48 × 64 px, top-down pointing up, transparent bg
    //  assets/ship-burn.png  — ignition frame
    //  assets/ship-cruise.png / ship-cruise2.png — cruising animation frames
    //  assets/enemy1.png     — standard enemy
    //  assets/enemy2.png     — heavy enemy
    //
    // ─────────────────────────────────────────────────────────────────────────

    var panelEl, toggleEl, spmEl, genBarEl, armourBarEl, lockBtn, shipEl, moneyEl, canvasEl, ctx;
    var secondarySlotEl = null;

    var gameOver = false;
    var gameOverEl = null;

    var correctCount = 0;
    var sessionStart = Date.now();
    var open = localStorage.getItem('idle_panel_open') === '1';
    var locked = localStorage.getItem('idle_locked') === '1';

    var MOBILE = window.innerWidth < 768;
    var SCALE = MOBILE ? 0.5 : 1;

    var PANEL_W = 216;
    var CANVAS_GAP = 50;
    var SHIP_W = 48 * SCALE;
    var SHIP_H = 64 * SCALE;
    var CH = window.innerHeight;
    var CW = Math.round(CH * (4 / 10));
    var cardLeft = 0;
    var SEA_TILE_H = 400;

    var imgFar = new Image();
    var imgNear = new Image();
    imgFar.src = 'assets/sea-far.png';
    imgNear.src = 'assets/sea-near.png';

    var lastRaf = performance.now();

    // ── flight ────────────────────────────────────────────────────────────────
    var flightState = 'grounded';
    var ship = { x: 0, y: 0, vx: 0, vy: 0, worldY: 0 };

    // ── generator ─────────────────────────────────────────────────────────────
    var GEN_MAX = 100;
    var gen = GEN_MAX;
    var GEN_AWARD = 5;
    var GEN_COST = 1;
    var GEN_IDLE = 0.3;

    // ── money ─────────────────────────────────────────────────────────────────
    var money = parseInt(localStorage.getItem('idle_money') || '0', 10);
    var MONEY_PER_KILL = 5;

    // ── missile purchase ──────────────────────────────────────────────────────
    var MISSILE_PRICE = 50;
    var secondaryWeapon = null;   // set to missile object when purchased

    // ── shields / armour ──────────────────────────────────────────────────────
    var SHIELD_MAX = 80;
    var ARMOUR_MAX = 20;
    var shields = SHIELD_MAX;
    var armour = ARMOUR_MAX;
    var SHIELD_REGEN = 12;

    // ── projectiles ───────────────────────────────────────────────────────────
    var bullets = [];
    var missiles = [];
    var enemyBullets = [];
    var ENEMY_FIRE_RATE = 1.8;
    var lastFireMs = 0;

    // ── enemies ───────────────────────────────────────────────────────────────
    var enemies = [];
    var obstacles = [];
    var enemyRespawnTimer = 0;

    // ── wave system ───────────────────────────────────────────────────────────
    var waves = [
        { label: 'trickle', duration: 14, gap: 3.5, enemyHp: 3, enemyVy: 70 },
        { label: 'swarm', duration: 10, gap: 1.2, enemyHp: 2, enemyVy: 90 },
        { label: 'silence', duration: 5, gap: 999, enemyHp: 3, enemyVy: 70 },
        { label: 'swarm', duration: 12, gap: 0.8, enemyHp: 2, enemyVy: 110 },
        { label: 'silence', duration: 4, gap: 999, enemyHp: 3, enemyVy: 70 },
        { label: 'heavy', duration: 15, gap: 2.2, enemyHp: 5, enemyVy: 55 },
        { label: 'silence', duration: 6, gap: 999, enemyHp: 3, enemyVy: 70 },
        { label: 'climax', duration: 10, gap: 0.5, enemyHp: 2, enemyVy: 130 },
        { label: 'silence', duration: 8, gap: 999, enemyHp: 3, enemyVy: 70 },
    ];
    var waveIndex = 0;
    var waveTimer = 0;

    function updateWave(dt) {
        var w = waves[waveIndex];
        enemyRespawnTimer -= dt;
        if (enemyRespawnTimer <= 0 && w.label !== 'silence' && enemies.length < 6) {
            spawnEnemyWave(w);
            enemyRespawnTimer = w.gap + Math.random() * 0.4;
        }
        waveTimer += dt;
        if (waveTimer >= w.duration) {
            waveTimer = 0;
            waveIndex = (waveIndex + 1) % waves.length;
            enemyRespawnTimer = waves[waveIndex].gap * 0.5;
        }
    }

    function spawnEnemyWave(w) {
        var el = makeEnemyEl(w.enemyHp > 4 ? 2 : 1);
        enemies.push({
            el: el,
            x: CW * 0.2 + Math.random() * CW * 0.6,
            y: -SHIP_H,
            hp: w.enemyHp,
            maxHp: w.enemyHp,
            vy: w.enemyVy + scrollSpeed() * 0.25,
            phase: Math.random() * Math.PI * 2,
            flash: 0,
            lastFireMs: 0,
            hw: 16 * 1.5,
            hh: 16 * 1.5,
        });
    }

    var burnFrame = 0;
    var burnTimer = 0;
    var BURN_INTERVAL = 0.56;

    // ── canvas positioning ────────────────────────────────────────────────────
    function positionCanvas() {
        var card = document.querySelector('.card');
        if (!card) {
            cardLeft = 0;
            CW = window.innerWidth;
        } else {
            var rect = card.getBoundingClientRect();
            cardLeft = Math.round(rect.left);
            CW = Math.round(rect.width);
        }
        canvasEl.style.left = cardLeft + 'px';
        canvasEl.style.right = '';
        canvasEl.style.width = CW + 'px';
        canvasEl.width = CW;
        canvasEl.height = CH;
    }

    function updateShipDom() {
        if (!shipEl) return;
        shipEl.style.left = Math.round(cardLeft + ship.x - SHIP_W / 2) + 'px';
        shipEl.style.right = '';
        shipEl.style.top = Math.round(ship.y - SHIP_H / 2) + 'px';
    }

    function updateEnemyDom() {
        var dark = document.documentElement.classList.contains('dark');
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            e.el.style.left = Math.round(cardLeft + e.x - SHIP_W / 2) + 'px';
            e.el.style.right = '';
            e.el.style.top = Math.round(e.y - SHIP_H / 2) + 'px';
            e.el.style.filter = e.flash > 0
                ? (dark ? 'invert(1) brightness(2)' : 'brightness(2)')
                : (dark ? 'invert(1)' : 'none');
            e.el.style.display = 'block';
        }
    }

    // ── scroll speed ──────────────────────────────────────────────────────────
    function scrollSpeed() {
        if (flightState === 'grounded') return 0;
        var spm = parseFloat(getSPM()) || 0;
        return 5 + Math.min(spm * 20, 150);
    }

    // ── enemy spawn ───────────────────────────────────────────────────────────
    function spawnEnemy() {
        var type = Math.random() < 0.75 ? 1 : 2;
        var el = makeEnemyEl(type);
        enemies.push({
            el: el,
            x: CW * 0.2 + Math.random() * CW * 0.6,
            y: -SHIP_H,
            hp: type === 1 ? 3 : 9,
            maxHp: type === 1 ? 3 : 9,
            vy: 70 + scrollSpeed() * 0.25,
            phase: Math.random() * Math.PI * 2,
            flash: 0,
            lastFireMs: 0,
            hw: SHIP_W * 0.75,
            hh: SHIP_H * 0.75,
        });
    }

    function spawnLevel() {
        obstacles = [];
        bullets = [];
        missiles = [];
        enemyBullets = [];
    }

    // ── steering ──────────────────────────────────────────────────────────────
    function steer(dt) {
        if (flightState === 'grounded' || flightState === 'ignition') return;

        if (flightState === 'cruising') {
            var spd = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
            if (spd > 20) {
                burnTimer += dt;
                if (burnTimer >= BURN_INTERVAL) {
                    burnTimer = 0;
                    burnFrame = 1 - burnFrame;
                    shipEl.src = burnFrame === 0 ? 'assets/ship-cruise.png' : 'assets/ship-cruise2.png';
                }
            } else {
                shipEl.src = 'assets/ship-cruise.png';
                burnFrame = 0;
            }
        }

        var fx = 0, fy = 0;

        // target lowest (closest to player) enemy
        var target = null;
        for (var i = 0; i < enemies.length; i++) {
            if (!target || enemies[i].y > target.y) target = enemies[i];
        }

        if (target) {
            var leadTime = 0.7;
            var predictedX = target.x + Math.sin(target.phase + leadTime * 0.5) * 18 * leadTime;
            fx += (predictedX - ship.x) * 18.0;
            fy += (CH * 0.75 - ship.y) * 1.8;
        } else {
            fx += (CW * 0.5 - ship.x) * 0.9;
            fy += (CH * 0.75 - ship.y) * 0.9;
        }

        // canvas boundary forces
        var m = 38 * SCALE;
        if (ship.x < m) fx += (m - ship.x) * 4;
        if (ship.x > CW - m) fx += (CW - m - ship.x) * 4;
        if (ship.y < m) fy += (m - ship.y) * 4;
        if (ship.y > CH - m) fy += (CH - m - ship.y) * 4;

        var damp = 0.86;
        ship.vx = (ship.vx + fx * dt) * damp;
        ship.vy = (ship.vy + fy * dt) * damp;

        var spd = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
        var maxSpd = 155;
        if (spd > maxSpd) { ship.vx *= maxSpd / spd; ship.vy *= maxSpd / spd; }

        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
    }

    // ── fire rate ─────────────────────────────────────────────────────────────
    function fireRate() {
        var spm = parseFloat(getSPM()) || 0;
        return Math.min(0.6 + spm * 0.22, 7);
    }

    // ── primary weapon: vulcan ────────────────────────────────────────────────
    function tryFirePrimary(now) {
        if (!enemies.length || gen <= 0) return;
        if (now - lastFireMs < 1000 / fireRate()) return;

        var best = null;
        for (var i = 0; i < enemies.length; i++) {
            if (Math.abs(ship.x - enemies[i].x) <= 36) {
                if (!best || enemies[i].y > best.y) best = enemies[i];
            }
        }
        if (!best) return;

        bullets.push({ x: ship.x, y: ship.y - SHIP_H * 0.45, vx: 0, vy: -385 });
        gen = Math.max(0, gen - GEN_COST);
        lastFireMs = now;
    }

    // ── secondary weapon: missile ─────────────────────────────────────────────
    function tryFireSecondary(now) {
        if (!secondaryWeapon) return;
        if (!enemies.length || gen <= 0) return;
        if (flightState !== 'cruising') return;

        secondaryWeapon.timer -= (now - (secondaryWeapon._last || now)) / 1000;
        secondaryWeapon._last = now;
        if (secondaryWeapon.timer > 0) return;

        var target = null;
        for (var i = 0; i < enemies.length; i++) {
            if (!target || enemies[i].y > target.y) target = enemies[i];
        }
        if (!target) return;

        var offsets = [-10, 10];
        for (var o = 0; o < offsets.length; o++) {
            missiles.push({
                x: ship.x + offsets[o] * SCALE,
                y: ship.y - SHIP_H * 0.3,
                vx: 0,
                vy: 0,
                target: target,
                phase: 'eject',
                age: 0,
                angle: Math.atan2(target.y - ship.y, target.x - ship.x),
                ejectOffset: offsets[o],
                launchDelay: o * 0.05,
                trail: [],
            });
        }

        secondaryWeapon.timer = secondaryWeapon.cooldown;
        gen = Math.max(0, gen - GEN_COST * 4);
    }

    // ── missile physics ───────────────────────────────────────────────────────
    function updateMissiles(dt) {
        for (var i = missiles.length - 1; i >= 0; i--) {
            var m = missiles[i];
            m.age += dt;

            m.trail.push({ x: m.x, y: m.y, age: 0 });
            for (var t = m.trail.length - 1; t >= 0; t--) {
                m.trail[t].age += dt;
                if (m.trail[t].age > 0.35) m.trail.splice(t, 1);
            }

            if (m.launchDelay > 0) { m.launchDelay -= dt; continue; }

            if (m.phase === 'eject') {
                m.x += (m.ejectOffset > 0 ? 1 : -1) * 28 * SCALE * dt;
                m.y += -8 * SCALE * dt;
                if (m.target && m.target.hp > 0) m.angle = Math.atan2(m.target.y - m.y, m.target.x - m.x);
                if (m.age > 0.15) { m.phase = 'hang'; m.age = 0; }

            } else if (m.phase === 'hang') {
                m.x += (m.ejectOffset > 0 ? 1 : -1) * 4 * SCALE * dt;
                m.y += 2 * SCALE * dt;
                if (m.target && m.target.hp > 0) m.angle = Math.atan2(m.target.y - m.y, m.target.x - m.x);
                if (m.age > 0.12) { m.phase = 'lock'; m.age = 0; }

            } else if (m.phase === 'lock') {
                var spd = Math.min(60 + m.age * 100, 620);
                if (!m.target || m.target.hp <= 0) {
                    m.x += Math.cos(m.angle) * spd * dt;
                    m.y += Math.sin(m.angle) * spd * dt;
                } else {
                    var ddx = m.target.x - m.x;
                    var ddy = m.target.y - m.y;
                    var targetAngle = Math.atan2(ddy, ddx);
                    var da = targetAngle - m.angle;
                    while (da > Math.PI) da -= Math.PI * 2;
                    while (da < -Math.PI) da += Math.PI * 2;
                    m.angle += da * Math.min(6 * dt * 8, 1);
                    m.vx = Math.cos(m.angle) * spd;
                    m.vy = Math.sin(m.angle) * spd;
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;
                }
            }

            if (m.y < -80 || m.y > CH + 80 || m.x < -80 || m.x > CW + 80) {
                missiles.splice(i, 1);
                continue;
            }

            var hit = false;
            for (var j = enemies.length - 1; j >= 0; j--) {
                var e = enemies[j];
                if (Math.abs(m.x - e.x) < 22 * SCALE && Math.abs(m.y - e.y) < 22 * SCALE) {
                    e.hp -= 3;
                    e.flash = 0.2;
                    if (e.hp <= 0) {
                        var streakMult = 1 + (window.streak || 0) * 0.1;
                        var earned = Math.round(MONEY_PER_KILL * streakMult);
                        money += earned;
                        localStorage.setItem('idle_money', money);
                        if (moneyEl) moneyEl.textContent = money;
                        if (open || locked) spawnKillFloat(e.x, e.y, earned);
                        e.el.remove();
                        enemies.splice(j, 1);
                    }
                    hit = true;
                    break;
                }
            }
            if (hit) { missiles.splice(i, 1); continue; }
        }
    }

    // ── enemy fire ────────────────────────────────────────────────────────────
    function tryEnemyFire(now) {
        if (flightState !== 'cruising') return;
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (!e.lastFireMs) e.lastFireMs = now;
            if ((now - e.lastFireMs) / 1000 < ENEMY_FIRE_RATE) continue;
            enemyBullets.push({ x: e.x, y: e.y + SHIP_H * 0.45, vy: 320 });
            e.lastFireMs = now;
        }
    }

    // ── damage ────────────────────────────────────────────────────────────────
    function takeDamage(amount) {
        if (gameOver) return;
        var overflow = Math.max(0, amount - shields);
        shields = Math.max(0, shields - amount);
        if (overflow > 0) {
            armour = Math.max(0, armour - overflow);
            if (armour <= 0) triggerGameOver();
        }
    }

    // ── combat update ─────────────────────────────────────────────────────────
    function updateCombat(now, dt) {
        if (gameOver) return;
        if (flightState === 'grounded' || flightState === 'ignition') return;

        // shield regen scales with gen level
        shields = Math.min(SHIELD_MAX, shields + SHIELD_REGEN * (gen / GEN_MAX) * dt);

        gen = Math.max(0, gen - GEN_IDLE * dt);

        tryFirePrimary(now);
        tryFireSecondary(now);
        tryEnemyFire(now);

        // player bullets
        for (var i = bullets.length - 1; i >= 0; i--) {
            bullets[i].x += (bullets[i].vx || 0) * dt;
            bullets[i].y += bullets[i].vy * dt;
            if (bullets[i].y < -12) bullets.splice(i, 1);
        }

        // enemy bullets
        for (var ei = enemyBullets.length - 1; ei >= 0; ei--) {
            enemyBullets[ei].y += enemyBullets[ei].vy * dt;
            if (enemyBullets[ei].y > CH + 12) { enemyBullets.splice(ei, 1); continue; }
            var edx = enemyBullets[ei].x - ship.x;
            var edy = enemyBullets[ei].y - ship.y;
            if (Math.abs(edx) < 18 * SCALE && Math.abs(edy) < 18 * SCALE) {
                takeDamage(10);
                enemyBullets.splice(ei, 1);
            }
        }

        // enemies
        for (var i = enemies.length - 1; i >= 0; i--) {
            var e = enemies[i];
            e.y += e.vy * dt;
            e.phase += dt * 0.5;
            e.x += Math.sin(e.phase) * 18 * dt;
            e.x = Math.max(CW * 0.1, Math.min(CW * 0.9, e.x));
            if (e.flash > 0) e.flash -= dt;

            if (e.y > CH + SHIP_H) {
                e.el.remove();
                enemies.splice(i, 1);
                continue;
            }

            for (var j = bullets.length - 1; j >= 0; j--) {
                var dx = bullets[j].x - e.x;
                var dy = bullets[j].y - e.y;
                if (Math.abs(dx) < e.hw && Math.abs(dy) < e.hh) {
                    e.hp--;
                    e.flash = 0.14;
                    bullets.splice(j, 1);
                    if (e.hp <= 0) {
                        var streakMult = 1 + (window.streak || 0) * 0.1;
                        var earned = Math.round(MONEY_PER_KILL * streakMult);
                        money += earned;
                        localStorage.setItem('idle_money', money);
                        if (moneyEl) moneyEl.textContent = money;
                        if (open || locked) spawnKillFloat(e.x, e.y, earned);
                        e.el.remove();
                        enemies.splice(i, 1);
                        break;
                    }
                }
            }
        }

        updateMissiles(dt);
        updateWave(dt);
    }

    // ── draw ──────────────────────────────────────────────────────────────────
    function drawSeaFar() {
        if (!imgFar.complete || !imgFar.naturalWidth) return;
        var cameraTop = ship.worldY - CH * 0.75;
        var nearScreenY = Math.round(-cameraTop);
        var clipH = nearScreenY > 0 ? Math.min(nearScreenY, CH) : CH;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, CW, clipH);
        ctx.clip();
        var offset = cameraTop * 0.45;
        var startY = -(offset % SEA_TILE_H);
        if (startY > 0) startY -= SEA_TILE_H;
        for (var y = startY; y < clipH; y += SEA_TILE_H) {
            ctx.drawImage(imgFar, 0, y, CW, SEA_TILE_H);
        }
        ctx.restore();
    }

    function drawSeaNear() {
        if (!imgNear.complete || !imgNear.naturalWidth) return;
        var cameraTop = ship.worldY - CH * 0.75;
        var screenY = Math.round(-cameraTop);
        if (screenY >= CH || screenY + SEA_TILE_H <= 0) return;
        ctx.drawImage(imgNear, 0, screenY, CW, SEA_TILE_H);
    }

    function drawCombat() {
        if (flightState === 'grounded') return;
        var dark = document.documentElement.classList.contains('dark');

        // player bullets
        ctx.fillStyle = dark ? 'rgba(200,196,188,0.9)' : 'rgba(26,25,22,0.85)';
        for (var i = 0; i < bullets.length; i++) {
            ctx.fillRect(bullets[i].x - 1.5 * SCALE, bullets[i].y - 5 * SCALE, 3 * SCALE, 9 * SCALE);
        }

        // enemy bullets — slightly wider, dimmer
        ctx.fillStyle = dark ? 'rgba(200,196,188,0.5)' : 'rgba(26,25,22,0.45)';
        for (var i = 0; i < enemyBullets.length; i++) {
            ctx.fillRect(enemyBullets[i].x - 2 * SCALE, enemyBullets[i].y - 5 * SCALE, 4 * SCALE, 9 * SCALE);
        }

        // missiles
        for (var i = 0; i < missiles.length; i++) {
            var m = missiles[i];

            for (var t = 0; t < m.trail.length; t++) {
                var tf = 1 - (m.trail[t].age / 0.35);
                ctx.globalAlpha = tf * (m.phase === 'lock' ? 0.55 : 0.18);
                var ts = (m.phase === 'lock' ? 2.5 : 1.5) * tf * SCALE;
                ctx.fillStyle = dark ? '#c8c4bc' : '#1a1916';
                ctx.beginPath();
                ctx.arc(m.trail[t].x, m.trail[t].y, ts, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            ctx.save();
            ctx.translate(m.x, m.y);
            ctx.rotate(m.angle + Math.PI / 2);
            ctx.globalAlpha = m.phase === 'eject' ? 0.5 : m.phase === 'hang' ? 0.65 : 0.85;
            ctx.fillStyle = dark ? '#c8c4bc' : '#1a1916';

            var bw = 2 * SCALE, bh = 7 * SCALE;
            ctx.fillRect(-bw / 2, -bh, bw, bh + 4 * SCALE);
            ctx.beginPath();
            ctx.moveTo(-bw / 2, -bh);
            ctx.lineTo(0, -bh - 5 * SCALE);
            ctx.lineTo(bw / 2, -bh);
            ctx.fill();

            if (m.phase === 'lock') {
                ctx.globalAlpha = 0.4 + Math.random() * 0.3;
                ctx.fillStyle = dark ? '#e8e4dc' : '#6a6660';
                ctx.fillRect(-bw / 2, 4 * SCALE, bw, (3 + Math.random() * 4) * SCALE);
            }

            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    // ── bars ──────────────────────────────────────────────────────────────────
    function updateGenBar() {
        if (!genBarEl) return;
        genBarEl.style.width = Math.max(0, (gen / GEN_MAX) * 100) + '%';
    }

    function updateArmourBar() {
        if (!armourBarEl) return;
        var total = SHIELD_MAX + ARMOUR_MAX;
        var filled = ((shields + armour) / total) * 100;
        var shieldFraction = shields / (shields + armour + 0.001);
        armourBarEl.style.width = Math.max(0, filled) + '%';
        var dark = document.documentElement.classList.contains('dark');
        armourBarEl.style.background = shieldFraction > 0.05
            ? (dark ? '#c8c4bc' : '#1a1916')
            : '#8a4a3a';
    }

    // ── RAF loop ──────────────────────────────────────────────────────────────
    function rafLoop(now) {
        var dt = Math.min((now - lastRaf) / 1000, 0.1);
        lastRaf = now;

        var spd = scrollSpeed();
        if (flightState !== 'grounded') ship.worldY -= spd * dt;

        steer(dt);
        updateCombat(now, dt);

        if (open || locked) {
            ctx.clearRect(0, 0, CW, CH);
            drawSeaFar();
            drawSeaNear();
            drawCombat();
            updateShipDom();
            updateEnemyDom();
            updateGenBar();
            updateArmourBar();
            updateSecondarySlotEl();
        }

        if (open) updateUI();

        requestAnimationFrame(rafLoop);
    }

    // ── styles ────────────────────────────────────────────────────────────────
    function injectStyles() {
        // All styles in idle.css
    }

    // ── missile purchase ──────────────────────────────────────────────────────
    function buyMissile() {
        if (secondaryWeapon) return;
        if (money < MISSILE_PRICE) return;
        money -= MISSILE_PRICE;
        localStorage.setItem('idle_money', money);
        localStorage.setItem('idle_missile_unlocked', '1');
        if (moneyEl) moneyEl.textContent = money;
        secondaryWeapon = { cooldown: 4.5, timer: 0, _last: 0 };
        updateSecondarySlotEl();
    }

    function updateSecondarySlotEl() {
        if (!secondarySlotEl) return;
        if (secondaryWeapon) {
            secondarySlotEl.textContent = 'M';
            secondarySlotEl.classList.add('equipped');
            secondarySlotEl.title = 'Missile';
        } else {
            secondarySlotEl.textContent = money >= MISSILE_PRICE ? MISSILE_PRICE : '\u2013';
            secondarySlotEl.classList.remove('equipped');
            secondarySlotEl.title = money >= MISSILE_PRICE ? 'Buy missile' : 'Need ' + MISSILE_PRICE;
        }
    }

    // ── loadout slots ─────────────────────────────────────────────────────────
    function buildLoadoutSlots(parentEl) {
        var tooltip = document.createElement('div');
        tooltip.id = 'idle-slot-tooltip';
        document.body.appendChild(tooltip);

        function showTip(anchorEl, lines) {
            tooltip.innerHTML = lines.join('<br>');
            tooltip.style.display = 'block';
            var r = anchorEl.getBoundingClientRect();
            tooltip.style.top = Math.max(4, r.top) + 'px';
            tooltip.style.left = 'auto';
            tooltip.style.right = (window.innerWidth - r.left + 6) + 'px';
        }
        function hideTip() { tooltip.style.display = 'none'; }

        var label = document.createElement('div');
        label.id = 'idle-loadout-label';
        label.textContent = 'loadout';
        parentEl.appendChild(label);

        var row = document.createElement('div');
        row.id = 'idle-loadout-row';

        // ── left column: 4 weapon slots ───────────────────────────────────────
        var weaponsCol = document.createElement('div');
        weaponsCol.id = 'idle-loadout-weapons';

        // Slot 1 — Vulcan, always equipped
        var slot1 = document.createElement('div');
        slot1.className = 'idle-slot equipped';
        slot1.textContent = 'V';
        slot1.addEventListener('mouseenter', function () {
            showTip(slot1, ['Slot\u2009·\u20091\u2009·\u2009Vulcan', 'Primary · always active']);
        });
        slot1.addEventListener('mouseleave', hideTip);
        weaponsCol.appendChild(slot1);

        // Slot 2 — Missile (purchaseable)
        secondarySlotEl = document.createElement('div');
        secondarySlotEl.className = 'idle-slot';
        secondarySlotEl.addEventListener('click', function () { if (!secondaryWeapon) buyMissile(); });
        secondarySlotEl.addEventListener('mouseenter', function () {
            var lines = secondaryWeapon
                ? ['Slot\u2009·\u20092\u2009·\u2009Missile', 'Homing · twin launch']
                : ['Slot\u2009·\u20092\u2009·\u2009Empty', money >= MISSILE_PRICE ? 'Click to buy (' + MISSILE_PRICE + ')' : 'Need ' + MISSILE_PRICE + ' money'];
            showTip(secondarySlotEl, lines);
        });
        secondarySlotEl.addEventListener('mouseleave', hideTip);
        updateSecondarySlotEl();
        weaponsCol.appendChild(secondarySlotEl);

        // Slot 3 — empty, decorative (future)
        var slot3 = document.createElement('div');
        slot3.className = 'idle-slot';
        slot3.textContent = '\u00b7';
        slot3.addEventListener('mouseenter', function () {
            showTip(slot3, ['Slot\u2009·\u20093\u2009·\u2009Empty']);
        });
        slot3.addEventListener('mouseleave', hideTip);
        weaponsCol.appendChild(slot3);

        // Slot 4 — empty, decorative (future)
        var slot4 = document.createElement('div');
        slot4.className = 'idle-slot';
        slot4.textContent = '\u00b7';
        slot4.addEventListener('mouseenter', function () {
            showTip(slot4, ['Slot\u2009·\u20094\u2009·\u2009Empty']);
        });
        slot4.addEventListener('mouseleave', hideTip);
        weaponsCol.appendChild(slot4);

        // ── centre: ship diagram ──────────────────────────────────────────────
        var shipDiagram = document.createElement('div');
        shipDiagram.id = 'idle-ship-diagram';

        // ── right column: generator slot ──────────────────────────────────────
        var gensCol = document.createElement('div');
        gensCol.id = 'idle-loadout-generators';

        var genSlot = document.createElement('div');
        genSlot.className = 'idle-slot equipped';
        genSlot.textContent = 'G';
        genSlot.addEventListener('mouseenter', function () {
            showTip(genSlot, ['Generator\u2009·\u2009Basic', 'Powers shields & weapons']);
        });
        genSlot.addEventListener('mouseleave', hideTip);
        gensCol.appendChild(genSlot);

        row.appendChild(weaponsCol);
        row.appendChild(shipDiagram);
        row.appendChild(gensCol);
        parentEl.appendChild(row);
    }

    // ── DOM ───────────────────────────────────────────────────────────────────
    function buildCanvas() {
        canvasEl = document.createElement('canvas');
        canvasEl.id = 'idle-canvas';
        ctx = canvasEl.getContext('2d');
        document.body.appendChild(canvasEl);
        if (open || locked) canvasEl.classList.add('on');
    }

    function buildShip() {
        shipEl = document.createElement('img');
        shipEl.id = 'idle-ship';
        shipEl.src = 'assets/ship.png';
        document.body.appendChild(shipEl);
        if (open || locked) shipEl.classList.add('on');
    }

    function makeEnemyEl(type) {
        var el = document.createElement('img');
        el.className = 'idle-enemy';
        el.src = type === 2 ? 'assets/enemy2.png' : 'assets/enemy1.png';
        document.body.appendChild(el);
        if (open || locked) el.classList.add('on');
        return el;
    }

    function buildDOM() {
        injectStyles();
        buildCanvas();
        buildShip();
        positionCanvas();

        ship.x = CW / 2;
        ship.y = CH * 0.80;
        ship.worldY = CH * 0.25;
        updateShipDom();

        if (MOBILE) {
            // ── Mobile: inject compact stats into topbar ───────────────────────
            var topbarStats = document.createElement('div');
            topbarStats.id = 'idle-topbar-stats';
            topbarStats.style.display = open ? 'flex' : 'none';

            var topbarGenTrack = document.createElement('div');
            topbarGenTrack.id = 'idle-topbar-gen-track';
            genBarEl = document.createElement('div');
            genBarEl.id = 'idle-topbar-gen-bar';
            topbarGenTrack.appendChild(genBarEl);
            topbarStats.appendChild(topbarGenTrack);

            moneyEl = document.createElement('div');
            moneyEl.id = 'idle-topbar-money';
            moneyEl.textContent = money;
            topbarStats.appendChild(moneyEl);

            var topbarDark = document.getElementById('topbar-dark');
            if (topbarDark && topbarDark.parentNode) {
                topbarDark.parentNode.insertBefore(topbarStats, topbarDark);
            }

            toggleEl = document.createElement('button');
            toggleEl.id = 'idle-toggle';
            toggleEl.setAttribute('aria-label', 'idle');
            toggleEl.textContent = open ? '\u25c9' : '\u25cf';
            toggleEl.style.bottom = '88px';
            toggleEl.style.right = '14px';
            toggleEl.classList.toggle('on', open);
            toggleEl.addEventListener('click', function () {
                open = !open;
                setVisible(open);
                topbarStats.style.display = open ? 'flex' : 'none';
                toggleEl.textContent = open ? '\u25c9' : '\u25cf';
                localStorage.setItem('idle_panel_open', open ? '1' : '0');
                toggleEl.classList.toggle('on', open);
            });
            document.body.appendChild(toggleEl);

        } else {
            // ── Desktop: existing panel + toggle ──────────────────────────────
            toggleEl = document.createElement('button');
            toggleEl.id = 'idle-toggle';
            toggleEl.setAttribute('aria-label', 'idle');
            toggleEl.addEventListener('click', togglePanel);
            toggleEl.textContent = locked ? '\u25c9' : '\u25cf';
            toggleEl.classList.toggle('locked', locked);
            document.body.appendChild(toggleEl);

            panelEl = document.createElement('div');
            panelEl.id = 'idle-panel';

            spmEl = document.createElement('div');
            spmEl.id = 'idle-spm';
            panelEl.appendChild(spmEl);

            var genLabel = document.createElement('div');
            genLabel.id = 'idle-gen-label';
            genLabel.textContent = 'gen';
            panelEl.appendChild(genLabel);

            var genTrack = document.createElement('div');
            genTrack.id = 'idle-gen-track';
            genBarEl = document.createElement('div');
            genBarEl.id = 'idle-gen-bar';
            genTrack.appendChild(genBarEl);
            panelEl.appendChild(genTrack);

            var armourLabel = document.createElement('div');
            armourLabel.id = 'idle-armour-label';
            armourLabel.textContent = '\u26e8 Shields';
            panelEl.appendChild(armourLabel);

            var armourTrack = document.createElement('div');
            armourTrack.id = 'idle-armour-track';
            armourBarEl = document.createElement('div');
            armourBarEl.id = 'idle-armour-bar';
            armourTrack.appendChild(armourBarEl);
            panelEl.appendChild(armourTrack);

            var moneyLabel = document.createElement('div');
            moneyLabel.id = 'idle-money-label';
            moneyLabel.textContent = 'money';
            panelEl.appendChild(moneyLabel);

            moneyEl = document.createElement('div');
            moneyEl.id = 'idle-money';
            moneyEl.textContent = money;
            panelEl.appendChild(moneyEl);

            buildLoadoutSlots(panelEl);

            lockBtn = document.createElement('button');
            lockBtn.id = 'idle-lock';
            lockBtn.textContent = locked ? 'Unpin view' : 'Pin view';
            lockBtn.classList.toggle('on', locked);
            lockBtn.addEventListener('click', toggleLock);
            panelEl.appendChild(lockBtn);

            document.body.appendChild(panelEl);
            panelEl.classList.toggle('on', open);
            toggleEl.classList.toggle('on', open);
        }

        document.body.classList.toggle('idle-minimal', open || locked);
    }

    // ── visibility ────────────────────────────────────────────────────────────
    function setVisible(v) {
        canvasEl.classList.toggle('on', v);
        shipEl.classList.toggle('on', v);
        for (var i = 0; i < enemies.length; i++) {
            enemies[i].el.classList.toggle('on', v);
        }
        document.body.classList.toggle('idle-minimal', v);
    }

    function togglePanel() {
        open = !open;
        panelEl.classList.toggle('on', open);
        toggleEl.classList.toggle('on', open);
        setVisible(open || locked);
        localStorage.setItem('idle_panel_open', open ? '1' : '0');
    }

    function toggleLock() {
        locked = !locked;
        lockBtn.textContent = locked ? 'Unpin view' : 'Pin view';
        lockBtn.classList.toggle('on', locked);
        toggleEl.textContent = locked ? '\u25c9' : '\u25cf';
        toggleEl.classList.toggle('locked', locked);
        setVisible(open || locked);
        localStorage.setItem('idle_locked', locked ? '1' : '0');
    }

    // ── game over ─────────────────────────────────────────────────────────────
    function resetGame() {
        gameOver = false;
        shields = SHIELD_MAX;
        armour = ARMOUR_MAX;
        gen = GEN_MAX;
        for (var i = 0; i < enemies.length; i++) enemies[i].el.remove();
        enemies = [];
        bullets = [];
        missiles = [];
        enemyBullets = [];
        enemyRespawnTimer = 10;
        waveIndex = 0;
        waveTimer = 0;
        if (secondaryWeapon) { secondaryWeapon.timer = 0; secondaryWeapon._last = 0; }
        flightState = 'grounded';
        shipEl.src = 'assets/ship.png';
        ship.x = CW / 2;
        ship.y = CH * 0.80;
        ship.vx = 0; ship.vy = 0;
        ship.worldY = CH * 0.25;
        correctCount = 0;
        sessionStart = Date.now();
        if (gameOverEl) { gameOverEl.remove(); gameOverEl = null; }
    }

    function triggerGameOver() {
        gameOver = true;
        flightState = 'grounded';
        shipEl.src = 'assets/ship.png';

        if (!open && !locked) { setTimeout(resetGame, 0); return; }

        gameOverEl = document.createElement('div');
        gameOverEl.id = 'idle-gameover';

        var msg = document.createElement('div');
        msg.id = 'idle-gameover-msg';
        msg.textContent = 'Ship destroyed.';
        gameOverEl.appendChild(msg);

        var btn = document.createElement('button');
        btn.id = 'idle-gameover-btn';
        btn.textContent = 'Retry?';
        btn.addEventListener('click', resetGame);
        gameOverEl.appendChild(btn);

        document.body.appendChild(gameOverEl);
    }

    // ── floats ────────────────────────────────────────────────────────────────
    function spawnEnergyFloat(amount) {
        var q = document.getElementById('question');
        var x, y;
        if (q) {
            var r = q.getBoundingClientRect();
            x = r.left + r.width / 2 - 20;
            y = r.top;
        } else {
            x = window.innerWidth / 2;
            y = window.innerHeight * 0.4;
        }
        var el = document.createElement('span');
        el.className = 'idle-float';
        el.textContent = '\u2042' + (amount || GEN_AWARD);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        el.addEventListener('animationend', function () { el.remove(); });
    }

    function spawnKillFloat(canvasX, canvasY, amount) {
        var el = document.createElement('span');
        el.className = 'idle-float-kill';
        el.textContent = '+' + amount;
        el.style.left = Math.round(cardLeft + canvasX - 16) + 'px';
        el.style.top = Math.round(canvasY) + 'px';
        document.body.appendChild(el);
        el.addEventListener('animationend', function () { el.remove(); });
    }

    function getSPM() {
        var mins = (Date.now() - sessionStart) / 60000;
        if (mins < 0.1) return '0.0';
        return (correctCount / mins).toFixed(1);
    }

    function takeoff() {
        if (flightState === 'grounded') {
            flightState = 'ignition';
            shipEl.src = 'assets/ship-burn.png';
            return;
        }
        if (flightState === 'ignition') {
            flightState = 'cruising';
            shipEl.src = 'assets/ship-cruise.png';
        }
    }

    function award(n, timePct) {
        correctCount++;
        var actual = Math.round(GEN_AWARD * (1 + (timePct || 0)));
        gen = Math.min(GEN_MAX, gen + actual);
        takeoff();
        if (open || locked) spawnEnergyFloat(actual);
    }

    function updateUI() {
        if (!spmEl) return;
        spmEl.textContent = correctCount > 0 ? getSPM() + '\u2009/spm' : '';
    }

    // ── submit patch ──────────────────────────────────────────────────────────
    function patchSubmitAnswer() {
        if (typeof window.submitAnswer !== 'function') return;
        var orig = window.submitAnswer;
        window.submitAnswer = function () {
            var timerFill = document.getElementById('timer-fill');
            var timePct = timerFill ? (parseFloat(timerFill.style.width) || 0) / 100 : 0;
            orig.apply(this, arguments);
            var fb = document.getElementById('feedback');
            if (fb && fb.className.indexOf('correct') !== -1) {
                var path = window.location.pathname;
                var amt =
                    path.indexOf('index') !== -1 ? 0.1 :
                        path.indexOf('division') !== -1 ? 0.25 :
                            path.indexOf('addsubtract') !== -1 ? (window.idleQuestionValue || 0.3) :
                                path.indexOf('fractions') !== -1 ? 5 : 0.1;
                award(amt, timePct);
            }
        };
    }

    // ── init ──────────────────────────────────────────────────────────────────
    window.addEventListener('DOMContentLoaded', function () {
        // restore missile unlock across sessions
        if (localStorage.getItem('idle_missile_unlocked') === '1') {
            secondaryWeapon = { cooldown: 4.5, timer: 0, _last: 0 };
        }

        buildDOM();

        if (MOBILE && window.visualViewport) {
            function updateCanvasToViewport() {
                var vv = window.visualViewport;
                CH = Math.round(vv.height);
                canvasEl.style.top = Math.round(vv.offsetTop) + 'px';
                canvasEl.style.height = CH + 'px';
                canvasEl.height = CH;
                positionCanvas();
                if (toggleEl) {
                    var kbH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                    toggleEl.style.bottom = (kbH + 96) + 'px';
                }
            }
            window.visualViewport.addEventListener('resize', updateCanvasToViewport);
            window.visualViewport.addEventListener('scroll', updateCanvasToViewport);
            updateCanvasToViewport();
        }

        patchSubmitAnswer();
        spawnLevel();
        enemyRespawnTimer = 17;
        ship.worldY = CH * 0.25;
        updateUI();
        lastRaf = performance.now();
        requestAnimationFrame(rafLoop);
    });

    window.addEventListener('resize', function () {
        CH = window.innerHeight;
        CW = Math.round(CH * (4 / 10));
        positionCanvas();
        if (flightState === 'grounded') {
            ship.x = CW / 2;
            ship.y = CH * 0.8;
        }
    });

}());