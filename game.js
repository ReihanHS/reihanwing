/**
 * ReihanWing Mobile - Core Game Engine (Mobile Optimized)
 */

const gameConfig = {
    playerSize: 60,
    bulletSpeed: 14,
    enemySpeed: 3,
    spawnRate: 1500,
    maxBullets: 20,          // ↓ was 40
    maxEnemies: 15,          // ↓ was 30
    fireRate: 150,
    enemySize: 60,
    starCount: 30,           // ↓ was 50
    bossInterval: 500,
    powerUpChance: 0.15,
    powerUpDuration: 5000,
    powerUpSpeed: 8,
    bulletWidth: 10,
    bulletHeight: 25,
    bossAttackRate: 2000,
    bossWarningDuration: 5000,
    bossGracePeriod: 3000,
    coinSpeed: 8,
    gemValue: 50,
    gemChance: 0.1,
    magnetRange: 350,
    magnetDuration: 8000
};

const gameState = {
    isRunning: false,
    isPaused: false,
    pauseStartTime: 0,
    totalPausedTime: 0,
    score: 0,
    highScore: parseInt(localStorage.getItem('reihanwing_mobile_highscore')) || 0,
    attackPower: 10,
    health: 100,
    playerPosition: { x: 0, y: 0 },
    touchX: 0,
    touchY: 0,
    lastFireTime: 0,
    lastSpawnTime: 0,
    bullets: [],
    bossBullets: [],
    enemies: [],
    powerUps: [],
    stars: [],
    particles: [],
    coins: [],
    gems: [],
    boss: null,
    difficultyScale: 1.0,
    nextBossScore: 500,
    activePowerUps: {
        tripleShot: 0,
        shield: 0,
        rush: 0,
        magnet: 0
    },
    pools: {
        bullets: [],
        enemies: [],
        particles: [],
        powerUps: [],
        bossBullets: [],
        coins: [],
        gems: []
    },
    isBossWarning: false,
    bossDefeatTime: 0,
    bossNames: ["ELDER PENTAGUARD", "NEON SERPENT", "VOID REAPER", "CYBER HIVE", "STALKER PRIME"]
};

// DOM Elements
const playerEl = document.getElementById('player');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const healthBarEl = document.getElementById('health-bar');
const menuScreen = document.getElementById('menu-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const gameContainer = document.getElementById('game-container');
const gameWorld = document.getElementById('game-world');
const attackPowerEl = document.getElementById('attack-power');
const bossWarningEl = document.getElementById('boss-warning');
const bossNameEl = document.getElementById('boss-name');
const pauseButton = document.getElementById('pause-button');
const resumeButton = document.getElementById('resume-button');
const pauseMenu = document.getElementById('pause-menu');
const starCanvas = document.getElementById('star-canvas');
const starCtx = starCanvas.getContext('2d');

// Cached container dimensions — avoids layout reads inside the game loop
let containerW = 0;
let containerH = 0;

function cacheContainerSize() {
    containerW = gameContainer.offsetWidth;
    containerH = gameContainer.offsetHeight;
    starCanvas.width = containerW;
    starCanvas.height = containerH;
}

// Initialization
function init() {
    cacheContainerSize();
    window.addEventListener('resize', cacheContainerSize);

    highScoreEl.textContent = `HIGH: ${gameState.highScore}`;
    attackPowerEl.textContent = `POW: ${gameState.attackPower}`;
    initStarField();
    setupControls();

    gameState.playerPosition.x = containerW / 2;
    gameState.playerPosition.y = containerH - 100;
    updatePlayerPosition();

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);
    resumeButton.addEventListener('click', togglePause);

    requestAnimationFrame(backgroundLoop);
}

// Canvas-based star field — replaces 50 individual DOM elements
function initStarField() {
    gameState.stars = [];
    for (let i = 0; i < gameConfig.starCount; i++) {
        gameState.stars.push({
            x: Math.random() * containerW,
            y: Math.random() * containerH,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.3
        });
    }
}

function drawStars(speedMult = 1) {
    starCtx.clearRect(0, 0, containerW, containerH);
    for (const star of gameState.stars) {
        star.y += star.speed * speedMult;
        if (star.y > containerH) {
            star.y = -4;
            star.x = Math.random() * containerW;
        }
        starCtx.globalAlpha = star.opacity;
        starCtx.fillStyle = 'white';
        starCtx.beginPath();
        starCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        starCtx.fill();
    }
    starCtx.globalAlpha = 1;
}

function setupControls() {
    // passive: true lets browser optimize — we don't call preventDefault here
    gameContainer.addEventListener('touchstart', (e) => {
        if (!gameState.isRunning) return;
        const touch = e.touches[0];
        gameState.touchX = touch.clientX;
        gameState.touchY = touch.clientY;
    }, { passive: true });

    gameContainer.addEventListener('touchmove', (e) => {
        if (!gameState.isRunning) return;
        e.preventDefault();
        const touch = e.touches[0];

        const deltaX = touch.clientX - gameState.touchX;
        const deltaY = touch.clientY - gameState.touchY;
        gameState.touchX = touch.clientX;
        gameState.touchY = touch.clientY;

        gameState.playerPosition.x += deltaX;
        gameState.playerPosition.y += deltaY;

        // Use cached dimensions — no offsetWidth/Height call
        const halfSize = gameConfig.playerSize / 2;
        gameState.playerPosition.x = Math.max(halfSize, Math.min(containerW - halfSize, gameState.playerPosition.x));
        gameState.playerPosition.y = Math.max(halfSize, Math.min(containerH - halfSize, gameState.playerPosition.y));

        updatePlayerPosition();
    }, { passive: false });

    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    gameContainer.addEventListener('mousedown', (e) => {
        if (!gameState.isRunning || gameState.isPaused) return;
        isMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        gameContainer.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!gameState.isRunning || !isMouseDown) return;

        const sensitivity = 2.0;
        const deltaX = (e.clientX - lastMouseX) * sensitivity;
        const deltaY = (e.clientY - lastMouseY) * sensitivity;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        gameState.playerPosition.x += deltaX;
        gameState.playerPosition.y += deltaY;

        const halfSize = gameConfig.playerSize / 2;
        gameState.playerPosition.x = Math.max(halfSize, Math.min(containerW - halfSize, gameState.playerPosition.x));
        gameState.playerPosition.y = Math.max(halfSize, Math.min(containerH - halfSize, gameState.playerPosition.y));

        updatePlayerPosition();
    });

    document.addEventListener('mouseup', () => {
        isMouseDown = false;
        gameContainer.style.cursor = 'crosshair';
    });
}

function updatePlayerPosition() {
    playerEl.style.transform = `translate(${gameState.playerPosition.x}px, ${gameState.playerPosition.y}px) translate(-50%, -50%)`;
}

function startGame() {
    gameState.isRunning = true;
    gameState.isPaused = false;
    gameState.totalPausedTime = 0;
    gameState.score = 0;
    gameState.health = 100;
    gameState.attackPower = 10;
    gameState.difficultyScale = 1.0;
    gameState.nextBossScore = gameConfig.bossInterval;
    gameState.isBossWarning = false;
    gameState.bossDefeatTime = 0;
    bossWarningEl.classList.remove('active');
    playerEl.classList.remove('shielded', 'magnetized');

    gameState.bullets.forEach(b => b.el.remove());
    gameState.enemies.forEach(e => e.el.remove());
    if (gameState.boss) {
        gameState.boss.el.remove();
        gameState.boss = null;
    }
    gameState.bullets = [];
    gameState.enemies = [];

    scoreEl.textContent = `SCORE: 0`;
    attackPowerEl.textContent = `POW: 10`;
    healthBarEl.style.width = '100%';

    menuScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    gameState.lastFireTime = 0;
    gameState.lastSpawnTime = 0;

    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameState.isRunning = false;
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('reihanwing_mobile_highscore', gameState.highScore);
        highScoreEl.textContent = `HIGH: ${gameState.highScore}`;
    }
    finalScoreEl.textContent = `SCORE: ${gameState.score}`;
    gameOverScreen.classList.add('active');
}

function spawnBullet(xOffset = 0) {
    if (gameState.bullets.length >= gameConfig.maxBullets) return;
    let bullet;
    if (gameState.pools.bullets.length > 0) {
        bullet = gameState.pools.bullets.pop();
        bullet.style.display = 'block';
    } else {
        bullet = document.createElement('div');
        bullet.className = 'bullet neon-entity';
        bullet.style.width = `${gameConfig.bulletWidth}px`;
        bullet.style.height = `${gameConfig.bulletHeight}px`;
        bullet.style.background = 'var(--neon-cyan)';
        bullet.style.boxShadow = '0 0 10px var(--neon-cyan)';
        gameWorld.appendChild(bullet);
    }

    const x = gameState.playerPosition.x + xOffset;
    const y = gameState.playerPosition.y - 20;
    bullet.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    gameState.bullets.push({ el: bullet, x, y });
}

function spawnPowerUp(x, y) {
    const types = ['tripleShot', 'shield', 'rush', 'damageUpgrade', 'magnet'];
    const type = types[Math.floor(Math.random() * types.length)];

    let puEl;
    if (gameState.pools.powerUps.length > 0) {
        puEl = gameState.pools.powerUps.pop();
        puEl.style.display = 'block';
    } else {
        puEl = document.createElement('div');
        puEl.className = 'powerup neon-entity';
        puEl.style.width = '40px';
        puEl.style.height = '40px';
        gameWorld.appendChild(puEl);
    }

    puEl.innerHTML = '';
    const symbol = document.createElement('div');
    symbol.style.color = 'white';
    symbol.style.fontSize = '24px';
    symbol.style.fontWeight = 'bold';
    symbol.style.textShadow = '0 0 5px rgba(0,0,0,0.5)';

    if (type === 'tripleShot') {
        puEl.style.background = 'var(--neon-yellow)';
        symbol.textContent = 'III';
    } else if (type === 'shield') {
        puEl.style.background = 'var(--neon-purple)';
        symbol.textContent = '🛡';
    } else if (type === 'rush') {
        puEl.style.background = '#6600ff';
        symbol.textContent = '⚡';
    } else if (type === 'damageUpgrade') {
        puEl.style.background = 'var(--neon-pink)';
        symbol.textContent = '✚';
    } else if (type === 'magnet') {
        puEl.style.background = 'var(--neon-orange)';
        symbol.textContent = '🧲';
    }

    puEl.appendChild(symbol);
    puEl.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    gameState.powerUps.push({ el: puEl, x, y, type });
}

function spawnEnemyRow() {
    if (gameState.boss) return;

    const rowCount = 5;
    const gap = 4;
    const cW = containerW || gameWorld.offsetWidth || 500;
    const enemySize = (cW - (gap * (rowCount - 1))) / rowCount;

    for (let i = 0; i < rowCount; i++) {
        if (gameState.enemies.length >= gameConfig.maxEnemies) break;

        const hp = Math.floor(10 * gameState.difficultyScale);
        let enemy, visual, hpBarContainer, hpBarFill;

        if (gameState.pools.enemies.length > 0) {
            enemy = gameState.pools.enemies.pop();
            enemy.style.display = 'flex';
            visual = enemy.querySelector('.enemy-visual');
            hpBarFill = enemy.querySelector('.hp-bar-fill');
            hpBarFill.style.width = '100%';
            hpBarFill.style.background = '#33ff33';
        } else {
            enemy = document.createElement('div');
            enemy.className = 'enemy neon-entity';

            visual = document.createElement('div');
            visual.className = 'enemy-visual';
            enemy.appendChild(visual);

            hpBarContainer = document.createElement('div');
            hpBarContainer.className = 'hp-bar-container';
            hpBarFill = document.createElement('div');
            hpBarFill.className = 'hp-bar-fill';
            hpBarContainer.appendChild(hpBarFill);
            enemy.appendChild(hpBarContainer);

            gameWorld.appendChild(enemy);
        }

        enemy.style.width = `${enemySize}px`;
        enemy.style.height = `${enemySize}px`;

        const x = (i * cW / rowCount) + (cW / rowCount / 2);
        const y = -enemySize;
        enemy.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;

        gameState.enemies.push({
            el: enemy,
            hpBarEl: hpBarFill,
            maxHp: hp,
            x,
            y,
            hp,
            size: enemySize,   // FIX: was never stored — caused NaN in hitTest
            flashUntil: 0      // FIX: replaces setTimeout for hit flash
        });
    }
}

function spawnBoss() {
    gameState.isBossWarning = true;
    bossWarningEl.classList.add('active');

    const name = gameState.bossNames[Math.floor(Math.random() * gameState.bossNames.length)];
    bossNameEl.textContent = name;

    setTimeout(() => {
        if (!gameState.isRunning) return;

        bossWarningEl.classList.remove('active');
        gameState.isBossWarning = false;

        gameState.enemies.forEach(e => {
            e.el.style.display = 'none';
            gameState.pools.enemies.push(e.el);
        });
        gameState.enemies = [];

        const bossSize = 80;
        const boss = document.createElement('div');
        boss.className = 'boss neon-entity';
        boss.style.width = `${bossSize}px`;
        boss.style.height = `${bossSize}px`;

        let color = 'var(--neon-purple)';
        if (name === "ELDER PENTAGUARD") {
            boss.classList.add('boss-pentaguard');
            color = 'var(--neon-purple)';
        } else if (name === "NEON SERPENT") {
            boss.classList.add('boss-serpent');
            color = '#00ff88';
        } else if (name === "VOID REAPER") {
            boss.classList.add('boss-reaper');
            color = 'var(--neon-red)';
        } else if (name === "CYBER HIVE") {
            boss.classList.add('boss-hive');
            color = 'var(--neon-yellow)';
        } else if (name === "STALKER PRIME") {
            boss.classList.add('boss-stalker');
            color = '#ff4d00';
        }

        const x = containerW / 2;
        const y = -bossSize;
        boss.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        gameWorld.appendChild(boss);

        gameState.boss = {
            el: boss,
            name: name,
            x: x,
            y: y,
            health: 20 + (gameState.difficultyScale * 10),
            targetY: 100,
            vx: 2 * gameState.difficultyScale,
            size: bossSize,
            color: color,
            lastAttackTime: 0,
            attackRateScale: Math.max(0.4, 1.0 - (gameState.difficultyScale - 1) * 0.2),
            movePhase: 0
        };
    }, gameConfig.bossWarningDuration);
}

function spawnBossBullet(x, y, vx, vy, color) {
    let bullet;
    if (gameState.pools.bossBullets.length > 0) {
        bullet = gameState.pools.bossBullets.pop();
        bullet.style.display = 'block';
    } else {
        bullet = document.createElement('div');
        bullet.className = 'boss-bullet neon-entity';
        gameWorld.appendChild(bullet);
    }

    bullet.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    bullet.style.boxShadow = `0 0 15px ${vy < 0 ? 'var(--neon-cyan)' : color}`;
    gameState.bossBullets.push({ el: bullet, x, y, vx, vy, color });
}

function bossAttack(timestamp) {
    if (!gameState.boss) return;
    const b = gameState.boss;

    if (timestamp - b.lastAttackTime < gameConfig.bossAttackRate * b.attackRateScale) return;
    b.lastAttackTime = timestamp;

    const centerX = b.x;
    const centerY = b.y;
    const pSpeed = 1.0 + (gameState.difficultyScale - 1) * 0.3;
    const color = b.color;

    if (b.name === "ELDER PENTAGUARD") {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            spawnBossBullet(centerX, centerY, Math.cos(angle) * 4 * pSpeed, Math.sin(angle) * 4 * pSpeed, color);
        }
    } else if (b.name === "NEON SERPENT") {
        for (let i = -1; i <= 1; i++) {
            spawnBossBullet(centerX + i * 20, centerY, i * 2 * pSpeed, 5 * pSpeed, color);
        }
    } else if (b.name === "VOID REAPER") {
        const dx = gameState.playerPosition.x - centerX;
        const dy = gameState.playerPosition.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        spawnBossBullet(centerX, centerY, (dx / dist) * 6 * pSpeed, (dy / dist) * 6 * pSpeed, color);
    } else if (b.name === "CYBER HIVE") {
        for (let i = 0; i < 5; i++) {
            const angle = Math.PI / 2 + (Math.random() - 0.5);
            spawnBossBullet(centerX, centerY, Math.cos(angle) * 5 * pSpeed, Math.sin(angle) * 5 * pSpeed, color);
        }
    }
}

function spawnCoin(x, y, vx = 0, vy = gameConfig.coinSpeed) {
    let el;
    if (gameState.pools.coins.length > 0) {
        el = gameState.pools.coins.pop();
        el.style.display = 'block';
    } else {
        el = document.createElement('div');
        el.className = 'coin neon-entity';
        gameWorld.appendChild(el);
    }
    // Use transform (not left/top) to avoid layout triggers
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    gameState.coins.push({ el, x, y, vx, vy });
}

function spawnGem(x, y, vx = 0, vy = gameConfig.coinSpeed * 0.8) {
    let el;
    if (gameState.pools.gems.length > 0) {
        el = gameState.pools.gems.pop();
        el.style.display = 'block';
    } else {
        el = document.createElement('div');
        el.className = 'gem neon-entity';
        gameWorld.appendChild(el);
    }
    // Use transform (not left/top) to avoid layout triggers
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    gameState.gems.push({ el, x, y, vx, vy });
}

function createExplosion(x, y, color) {
    const count = 5; // Reduced from 8 — meaningful perf win on mobile
    for (let i = 0; i < count; i++) {
        let p;
        if (gameState.pools.particles.length > 0) {
            p = gameState.pools.particles.pop();
            p.style.display = 'block';
            p.style.background = color;
            p.style.boxShadow = `0 0 10px ${color}`;
        } else {
            p = document.createElement('div');
            p.className = 'explosion-particle';
            p.style.width = '4px';
            p.style.height = '4px';
            p.style.background = color;
            p.style.boxShadow = `0 0 10px ${color}`;
            gameWorld.appendChild(p);
        }

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        p.style.transform = `translate(${x}px, ${y}px)`;

        gameState.particles.push({ el: p, x, y, vx, vy, life: 1.0, decay: Math.random() * 0.05 + 0.015 });
    }
}

function backgroundLoop() {
    drawStars(1);
    if (!gameState.isRunning) {
        requestAnimationFrame(backgroundLoop);
    }
}

function togglePause() {
    if (!gameState.isRunning) return;

    gameState.isPaused = !gameState.isPaused;
    if (gameState.isPaused) {
        gameState.pauseStartTime = performance.now();
        pauseMenu.classList.add('active');
    } else {
        gameState.totalPausedTime += performance.now() - gameState.pauseStartTime;
        pauseMenu.classList.remove('active');
        requestAnimationFrame(gameLoop);
    }
}

// Pure math collision — zero layout reads, zero reflow
function hitTest(x1, y1, r1, x2, y2, r2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const minDist = r1 + r2;
    return (dx * dx + dy * dy) < (minDist * minDist);
}

function gameLoop(timestamp) {
    if (!gameState.isRunning || gameState.isPaused) return;

    const gameTime = timestamp - gameState.totalPausedTime;

    // Cache bounds once per frame — no repeated layout reads in entity loops
    const cW = containerW;
    const cH = containerH;
    const pX = gameState.playerPosition.x;
    const pY = gameState.playerPosition.y;
    const pR = gameConfig.playerSize / 2;

    // Power-up expiration
    for (const key in gameState.activePowerUps) {
        if (gameState.activePowerUps[key] > 0 && gameTime > gameState.activePowerUps[key]) {
            gameState.activePowerUps[key] = 0;
            if (key === 'shield') playerEl.classList.remove('shielded');
            if (key === 'magnet') playerEl.classList.remove('magnetized');
        }
    }

    // Stars drawn to canvas — no DOM manipulation
    const starSpeedMult = gameState.activePowerUps.rush ? 5 : 1;
    drawStars(starSpeedMult);

    // Shooting logic
    if (gameTime - gameState.lastFireTime > gameConfig.fireRate) {
        if (gameState.activePowerUps.tripleShot) {
            spawnBullet(0);
            spawnBullet(-15);
            spawnBullet(15);
        } else {
            spawnBullet(0);
        }
        gameState.lastFireTime = gameTime;
    }

    // Spawning logic (with Boss and Grace Period checks)
    const isGracePeriod = gameTime < gameState.bossDefeatTime + gameConfig.bossGracePeriod;
    if (!gameState.boss && !gameState.isBossWarning && !isGracePeriod && gameTime - gameState.lastSpawnTime > (gameConfig.spawnRate / gameState.difficultyScale)) {
        spawnEnemyRow();
        gameState.lastSpawnTime = gameTime;
    }

    // Boss spawning trigger
    if (!gameState.boss && !gameState.isBossWarning && gameState.score >= gameState.nextBossScore) {
        spawnBoss();
        gameState.nextBossScore += gameConfig.bossInterval;
    }

    // Difficulty scaling
    gameState.difficultyScale = 1.0 + (gameState.score / 2000);

    // ── Update Boss ──────────────────────────────────────────────────────────
    if (gameState.boss) {
        const b = gameState.boss;

        // Entry movement
        if (b.y < b.targetY) {
            b.y += 1;
        } else {
            // Unique Movement Patterns
            if (b.name === "ELDER PENTAGUARD") {
                b.x += b.vx;
                if (b.x < b.size / 2 || b.x > cW - b.size / 2) b.vx *= -1;
            } else if (b.name === "NEON SERPENT") {
                b.movePhase += 0.05;
                b.x = (cW / 2) + Math.sin(b.movePhase) * (cW * 0.4);
                b.y = b.targetY + Math.cos(b.movePhase * 2) * 20;
            } else if (b.name === "VOID REAPER") {
                b.movePhase += 0.02;
                b.x += Math.sin(b.movePhase) > 0.8 ? b.vx * 3 : b.vx * 0.5;
                if (b.x < b.size / 2 || b.x > cW - b.size / 2) b.vx *= -1;
            } else if (b.name === "CYBER HIVE") {
                b.x += (Math.random() - 0.5) * 10 + b.vx;
                b.y = b.targetY + (Math.random() - 0.5) * 5;
                if (b.x < b.size / 2 || b.x > cW - b.size / 2) b.vx *= -1;
            } else if (b.name === "STALKER PRIME") {
                const dx = pX - b.x;
                const dy = pY - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    b.x += (dx / dist) * (1.5 * gameState.difficultyScale);
                    b.y += (dy / dist) * (1.5 * gameState.difficultyScale);
                }
            }
        }
        b.el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`;

        // Contact damage — hitTest only, no getBoundingClientRect
        if (hitTest(b.x, b.y, b.size / 2, pX, pY, pR)) {
            if (!gameState.activePowerUps.shield) {
                gameState.health -= 0.5;
                healthBarEl.style.width = `${Math.max(0, gameState.health)}%`;
                if (Math.random() > 0.9) createExplosion(pX, pY, b.color);
                if (gameState.health <= 0) endGame();
            }
        }

        // Boss vs player bullets — hitTest only, no getBoundingClientRect
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const bul = gameState.bullets[j];
            if (hitTest(bul.x, bul.y, 4, b.x, b.y, b.size / 2)) {
                b.health--;
                createExplosion(bul.x, bul.y, 'var(--neon-purple)');

                bul.el.style.display = 'none';
                gameState.pools.bullets.push(bul.el);
                gameState.bullets.splice(j, 1);

                if (b.health <= 0) {
                    createExplosion(b.x, b.y, 'var(--neon-purple)');

                    gameState.bossBullets.forEach(bb => {
                        bb.el.style.display = 'none';
                        gameState.pools.bossBullets.push(bb.el);
                    });
                    gameState.bossBullets = [];

                    for (let c = 0; c < 25; c++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 8 + 4;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        if (c < 5) { spawnGem(b.x, b.y, vx, vy); }
                        else { spawnCoin(b.x, b.y, vx, vy); }
                    }

                    b.el.remove();
                    gameState.boss = null;
                    gameState.bossDefeatTime = gameTime;
                    break;
                }
            }
        }
    }

    // Update Boss Attacks
    bossAttack(gameTime);

    // ── Update Boss Bullets ──────────────────────────────────────────────────
    for (let i = gameState.bossBullets.length - 1; i >= 0; i--) {
        const bb = gameState.bossBullets[i];
        bb.x += bb.vx;
        bb.y += bb.vy;
        bb.el.style.transform = `translate(${bb.x}px, ${bb.y}px) translateX(-50%)`;

        if (hitTest(bb.x, bb.y, 6, pX, pY, pR)) {
            if (!gameState.activePowerUps.shield) {
                gameState.health -= 20;
                healthBarEl.style.width = `${Math.max(0, gameState.health)}%`;
                createExplosion(pX, pY, 'var(--neon-cyan)');
                if (gameState.health <= 0) endGame();
            }
            bb.el.style.display = 'none';
            gameState.pools.bossBullets.push(bb.el);
            gameState.bossBullets.splice(i, 1);
            continue;
        }

        if (bb.y > cH + 20 || bb.y < -50 || bb.x < -20 || bb.x > cW + 20) {
            bb.el.style.display = 'none';
            gameState.pools.bossBullets.push(bb.el);
            gameState.bossBullets.splice(i, 1);
        }
    }

    // ── Update Coins ─────────────────────────────────────────────────────────
    for (let i = gameState.coins.length - 1; i >= 0; i--) {
        const c = gameState.coins[i];

        if (gameState.activePowerUps.magnet) {
            const dx = pX - c.x;
            const dy = pY - c.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < gameConfig.magnetRange) {
                const pullForce = (gameConfig.magnetRange - dist) / gameConfig.magnetRange;
                c.vx += (dx / dist) * pullForce * 2.5;
                c.vy += (dy / dist) * pullForce * 2.5;
            }
        }

        c.x += c.vx;
        c.y += c.vy;

        if (!gameState.activePowerUps.magnet) {
            c.vx *= 0.95;
            if (Math.abs(c.vx) < 0.1) c.vx = 0;
            if (c.vy < gameConfig.coinSpeed) { c.vy += 0.2; }
            else { c.vy = gameConfig.coinSpeed; }
        } else {
            c.vx *= 0.95;
            c.vy *= 0.95;
            if (Math.abs(c.vy) < gameConfig.coinSpeed) c.vy = gameConfig.coinSpeed;
        }

        // transform instead of left/top — no layout trigger
        c.el.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`;

        if (hitTest(c.x, c.y, 8, pX, pY, pR)) {
            gameState.score += 5;
            scoreEl.textContent = `SCORE: ${gameState.score}`;
            c.el.style.display = 'none';
            gameState.pools.coins.push(c.el);
            gameState.coins.splice(i, 1);
            continue;
        }

        if (c.y > cH + 50) {
            c.el.style.display = 'none';
            gameState.pools.coins.push(c.el);
            gameState.coins.splice(i, 1);
        }
    }

    // ── Update Particles ──────────────────────────────────────────────────────
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
            p.el.style.display = 'none';
            gameState.pools.particles.push(p.el);
            gameState.particles.splice(i, 1);
        } else {
            p.el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.life})`;
            p.el.style.opacity = p.life;
        }
    }

    // ── Update Gems ───────────────────────────────────────────────────────────
    for (let i = gameState.gems.length - 1; i >= 0; i--) {
        const g = gameState.gems[i];

        if (gameState.activePowerUps.magnet) {
            const dx = pX - g.x;
            const dy = pY - g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < gameConfig.magnetRange) {
                const pullForce = (gameConfig.magnetRange - dist) / gameConfig.magnetRange;
                g.vx += (dx / dist) * pullForce * 2.0;
                g.vy += (dy / dist) * pullForce * 2.0;
            }
        }

        g.x += g.vx;
        g.y += g.vy;
        g.vy += 0.08;
        g.vx *= 0.98;

        if (hitTest(g.x, g.y, 10, pX, pY, pR)) {
            gameState.score += gameConfig.gemValue;
            scoreEl.textContent = `SCORE: ${gameState.score}`;
            createExplosion(g.x, g.y, '#00ffcc');
            g.el.style.display = 'none';
            gameState.pools.gems.push(g.el);
            gameState.gems.splice(i, 1);
            continue;
        }

        if (g.y > cH + 50) {
            g.el.style.display = 'none';
            gameState.pools.gems.push(g.el);
            gameState.gems.splice(i, 1);
            continue;
        }

        // transform instead of left/top — no layout trigger
        g.el.style.transform = `translate(${g.x}px, ${g.y}px) translate(-50%, -50%)`;
    }

    // ── Update Power-Ups ──────────────────────────────────────────────────────
    for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
        const pu = gameState.powerUps[i];
        pu.y += gameConfig.powerUpSpeed;
        pu.el.style.transform = `translate(${pu.x}px, ${pu.y}px) translateX(-50%)`;

        if (hitTest(pu.x, pu.y, 20, pX, pY, pR)) {
            if (pu.type === 'damageUpgrade') {
                gameState.attackPower += 5;
                attackPowerEl.textContent = `POW: ${gameState.attackPower}`;
                attackPowerEl.animate([
                    { transform: 'scale(1)', filter: 'brightness(1)' },
                    { transform: 'scale(1.5)', filter: 'brightness(2)' },
                    { transform: 'scale(1)', filter: 'brightness(1)' }
                ], { duration: 500 });
            } else {
                gameState.activePowerUps[pu.type] = gameTime + (pu.type === 'magnet' ? gameConfig.magnetDuration : gameConfig.powerUpDuration);
                if (pu.type === 'shield') playerEl.classList.add('shielded');
                if (pu.type === 'magnet') playerEl.classList.add('magnetized');
            }

            pu.el.style.display = 'none';
            gameState.pools.powerUps.push(pu.el);
            gameState.powerUps.splice(i, 1);
            continue;
        }

        if (pu.y > cH + 50) {
            pu.el.style.display = 'none';
            gameState.pools.powerUps.push(pu.el);
            gameState.powerUps.splice(i, 1);
        }
    }

    // ── Update Bullets ────────────────────────────────────────────────────────
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const b = gameState.bullets[i];
        b.y -= gameConfig.bulletSpeed;
        b.el.style.transform = `translate(${b.x}px, ${b.y}px) translateX(-50%)`;

        if (b.y < -20) {
            b.el.style.display = 'none';
            gameState.pools.bullets.push(b.el);
            gameState.bullets.splice(i, 1);
        }
    }

    // ── Update Enemies ────────────────────────────────────────────────────────
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const e = gameState.enemies[i];
        const eSpeed = gameState.activePowerUps.rush ? 10 : (gameConfig.enemySpeed * gameState.difficultyScale);
        e.y += eSpeed;
        e.el.style.transform = `translate(${e.x}px, ${e.y}px) translateX(-50%)`;

        // Resolve hit flash with timestamp — no setTimeout
        if (e.flashUntil > 0 && gameTime >= e.flashUntil) {
            e.flashUntil = 0;
            if (e.el.style.display !== 'none') {
                e.el.style.filter = 'drop-shadow(0 0 8px var(--neon-red))';
            }
        }

        // Player collision
        if (hitTest(e.x, e.y, e.size / 2, pX, pY, pR)) {
            if (gameState.activePowerUps.rush) {
                createExplosion(e.x, e.y, 'var(--neon-red)');
                if (Math.random() < gameConfig.gemChance) { spawnGem(e.x, e.y); }
                else { for (let c = 0; c < 3; c++) spawnCoin(e.x, e.y); }
                createExplosion(e.x, e.y, 'var(--neon-red)');
                e.el.style.display = 'none';
                gameState.pools.enemies.push(e.el);
                gameState.enemies.splice(i, 1);
                continue;
            }

            if (gameState.activePowerUps.shield) {
                createExplosion(e.x, e.y, 'var(--neon-red)');
                e.el.style.display = 'none';
                gameState.pools.enemies.push(e.el);
                gameState.enemies.splice(i, 1);
                continue;
            }

            gameState.health -= 15;
            healthBarEl.style.width = `${Math.max(0, gameState.health)}%`;
            createExplosion(e.x, e.y, 'var(--neon-red)');
            createExplosion(pX, pY, 'var(--neon-cyan)');
            e.el.style.display = 'none';
            gameState.pools.enemies.push(e.el);
            gameState.enemies.splice(i, 1);
            if (gameState.health <= 0) endGame();
            continue;
        }

        // Bullet collision
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const b = gameState.bullets[j];

            if (hitTest(b.x, b.y, 4, e.x, e.y, e.size / 2)) {
                e.hp -= gameState.attackPower;

                const hpPercent = Math.max(0, (e.hp / e.maxHp) * 100);
                e.hpBarEl.style.width = `${hpPercent}%`;

                if (hpPercent > 60) e.hpBarEl.style.background = '#33ff33';
                else if (hpPercent > 30) e.hpBarEl.style.background = '#ffff33';
                else e.hpBarEl.style.background = '#ff3333';

                if (e.hp <= 0) {
                    if (Math.random() < gameConfig.gemChance) {
                        spawnGem(e.x, e.y);
                    } else {
                        const coinCount = 1 + Math.floor(Math.random() * 3);
                        for (let c = 0; c < coinCount; c++) spawnCoin(e.x, e.y);
                    }
                    createExplosion(e.x, e.y, 'var(--neon-red)');

                    if (Math.random() < gameConfig.powerUpChance) {
                        spawnPowerUp(e.x, e.y);
                    }

                    e.el.style.display = 'none';
                    gameState.pools.enemies.push(e.el);
                    gameState.enemies.splice(i, 1);
                } else {
                    // Timestamp-based flash — no setTimeout garbage collection
                    e.el.style.filter = 'brightness(3) drop-shadow(0 0 15px white)';
                    e.flashUntil = gameTime + 50;
                }

                b.el.style.display = 'none';
                gameState.pools.bullets.push(b.el);
                gameState.bullets.splice(j, 1);
                break;
            }
        }

        if (e.y > cH + 50) {
            e.el.style.display = 'none';
            gameState.pools.enemies.push(e.el);
            gameState.enemies.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Start Initialization
window.onload = init;
