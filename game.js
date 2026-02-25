/**
 * ReihanWing Mobile - Core Game Engine
 */

const gameConfig = {
    playerSize: 60, // Larger like EverWing
    bulletSpeed: 14,
    enemySpeed: 3,
    spawnRate: 1500,
    maxBullets: 40,
    maxEnemies: 30,
    fireRate: 150, // ms
    enemySize: 60, // Larger base size
    starCount: 50,
    bossInterval: 500, // score threshold
    powerUpChance: 0.15,
    powerUpDuration: 5000, // 5 seconds
    powerUpSpeed: 8,
    bulletWidth: 10,
    bulletHeight: 25,
    bossAttackRate: 2000, // ms
    bossWarningDuration: 5000,
    bossGracePeriod: 3000,
    coinSpeed: 8,
    gemValue: 50,
    gemChance: 0.1,
    magnetRange: 350, // Increased for major WOW factor
    magnetDuration: 8000
};

const gameState = {
    isRunning: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('reihanwing_mobile_highscore')) || 0,
    attackPower: 10,
    health: 100,
    playerPosition: { x: window.innerWidth / 2, y: window.innerHeight - 100 },
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

// Initialization
function init() {
    highScoreEl.textContent = `HIGH: ${gameState.highScore}`;
    attackPowerEl.textContent = `POW: ${gameState.attackPower}`;
    createStarField();
    setupControls();
    updatePlayerPosition();

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // Initial static loop for stars
    requestAnimationFrame(backgroundLoop);
}

function createStarField() {
    const starField = document.createElement('div');
    starField.id = 'star-field';
    gameContainer.insertBefore(starField, gameWorld);

    for (let i = 0; i < gameConfig.starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;

        const x = Math.random() * gameContainer.offsetWidth;
        const y = Math.random() * gameContainer.offsetHeight;
        const speed = Math.random() * 2 + 1;

        star.style.transform = `translate(${x}px, ${y}px)`;
        starField.appendChild(star);
        gameState.stars.push({ el: star, x, y, speed });
    }
}

function setupControls() {
    // Touch movement
    gameContainer.addEventListener('touchstart', (e) => {
        if (!gameState.isRunning) return;
        const touch = e.touches[0];
        gameState.touchX = touch.clientX;
        gameState.touchY = touch.clientY;
    });

    gameContainer.addEventListener('touchmove', (e) => {
        if (!gameState.isRunning) return;
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];

        // Calculate new position based on touch drag (X and Y)
        const deltaX = touch.clientX - gameState.touchX;
        const deltaY = touch.clientY - gameState.touchY;

        gameState.touchX = touch.clientX;
        gameState.touchY = touch.clientY;

        gameState.playerPosition.x += deltaX;
        gameState.playerPosition.y += deltaY;

        // Constrain to bounds
        const containerWidth = gameContainer.offsetWidth;
        const containerHeight = gameContainer.offsetHeight;
        const halfWidth = gameConfig.playerSize / 2;
        const halfHeight = gameConfig.playerSize / 2;

        if (gameState.playerPosition.x < halfWidth) gameState.playerPosition.x = halfWidth;
        if (gameState.playerPosition.x > containerWidth - halfWidth) gameState.playerPosition.x = containerWidth - halfWidth;

        if (gameState.playerPosition.y < halfHeight) gameState.playerPosition.y = halfHeight;
        if (gameState.playerPosition.y > containerHeight - halfHeight) gameState.playerPosition.y = containerHeight - halfHeight;

        updatePlayerPosition();
    }, { passive: false });

    // Mouse fallback for testing (2D)
    gameContainer.addEventListener('mousemove', (e) => {
        if (!gameState.isRunning) return;
        const rect = gameContainer.getBoundingClientRect();
        gameState.playerPosition.x = e.clientX - rect.left;
        gameState.playerPosition.y = e.clientY - rect.top;
        updatePlayerPosition();
    });
}

function updatePlayerPosition() {
    playerEl.style.transform = `translate(${gameState.playerPosition.x}px, ${gameState.playerPosition.y}px) translate(-50%, -50%)`;
}

function startGame() {
    gameState.isRunning = true;
    gameState.score = 0;
    gameState.health = 100;
    gameState.attackPower = 10;
    gameState.difficultyScale = 1.0;
    gameState.nextBossScore = gameConfig.bossInterval;
    gameState.isBossWarning = false;
    gameState.bossDefeatTime = 0;
    bossWarningEl.classList.remove('active');
    playerEl.classList.remove('shielded', 'magnetized');

    // Clear previous entities
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
        puEl.style.width = '40px'; // Larger powerups
        puEl.style.height = '40px';
        gameWorld.appendChild(puEl);
    }

    // Color coding and Symbols
    puEl.innerHTML = ''; // Clear previous symbol if any
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

    const rowCount = 5; // EverWing uses 5
    const gap = 4; // Slightly larger gap for bigger enemies
    const containerWidth = gameWorld.offsetWidth || 500;

    // Dynamically calculate enemy size to fill the entire row
    const enemySize = (containerWidth - (gap * (rowCount - 1))) / rowCount;

    for (let i = 0; i < rowCount; i++) {
        const hp = Math.floor(10 * gameState.difficultyScale);
        let enemy, visual, hpBarContainer, hpBarFill;

        if (gameState.pools.enemies.length > 0) {
            enemy = gameState.pools.enemies.pop();
            enemy.style.display = 'flex'; // Use flex for HP bar positioning
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

        // Apply dynamic size
        enemy.style.width = `${enemySize}px`;
        enemy.style.height = `${enemySize}px`;

        // Calculate center of each slot (Total width Divided by 5)
        const x = (i * containerWidth / rowCount) + (containerWidth / rowCount / 2);
        const y = -enemySize;

        enemy.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
        gameState.enemies.push({
            el: enemy,
            hpBarEl: hpBarFill,
            maxHp: hp,
            x,
            y,
            hp: hp
        });
    }
}

function spawnBoss() {
    gameState.isBossWarning = true;

    // Stop spawning enemies and show warning
    bossWarningEl.classList.add('active');

    const name = gameState.bossNames[Math.floor(Math.random() * gameState.bossNames.length)];
    bossNameEl.textContent = name;

    // Higher duration for more impact
    setTimeout(() => {
        if (!gameState.isRunning) return;

        bossWarningEl.classList.remove('active');
        gameState.isBossWarning = false;

        // Clear existing regular enemies for the duel
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

        const x = gameWorld.offsetWidth / 2;
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
            movePhase: 0 // For wavy or dash patterns
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

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
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

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    gameState.gems.push({ el, x, y, vx, vy });
}


function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
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

        gameState.particles.push({
            el: p,
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            life: 1.0,
            decay: Math.random() * 0.05 + 0.015
        });
    }
}

function backgroundLoop() {
    // Stars move regardless of game state
    for (const star of gameState.stars) {
        star.y += star.speed;
        if (star.y > gameContainer.offsetHeight) {
            star.y = -10;
            star.x = Math.random() * gameContainer.offsetWidth;
        }
        star.el.style.transform = `translate(${star.x}px, ${star.y}px)`;
    }

    if (!gameState.isRunning) {
        requestAnimationFrame(backgroundLoop);
    }
}

function checkCollision(rect1, rect2) {
    return !(rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom);
}

function gameLoop(timestamp) {
    if (!gameState.isRunning) return;

    // Power-up expiration
    for (const key in gameState.activePowerUps) {
        if (gameState.activePowerUps[key] > 0 && timestamp > gameState.activePowerUps[key]) {
            gameState.activePowerUps[key] = 0;
            if (key === 'shield') playerEl.classList.remove('shielded');
            if (key === 'magnet') playerEl.classList.remove('magnetized');
        }
    }

    // Background stars
    const starSpeedMult = gameState.activePowerUps.rush ? 5 : 1;
    for (const star of gameState.stars) {
        star.y += star.speed * starSpeedMult;
        if (star.y > gameContainer.offsetHeight) {
            star.y = -10;
            star.x = Math.random() * gameContainer.offsetWidth;
        }
        star.el.style.transform = `translate(${star.x}px, ${star.y}px)`;
    }

    // Shooting logic
    if (timestamp - gameState.lastFireTime > gameConfig.fireRate) {
        if (gameState.activePowerUps.tripleShot) {
            spawnBullet(0);
            spawnBullet(-15);
            spawnBullet(15);
        } else {
            spawnBullet(0);
        }
        gameState.lastFireTime = timestamp;
    }

    // Spawning logic (with Boss and Grace Period checks)
    const isGracePeriod = timestamp < gameState.bossDefeatTime + gameConfig.bossGracePeriod;
    if (!gameState.boss && !gameState.isBossWarning && !isGracePeriod && timestamp - gameState.lastSpawnTime > (gameConfig.spawnRate / gameState.difficultyScale)) {
        spawnEnemyRow();
        gameState.lastSpawnTime = timestamp;
    }

    // Boss spawning trigger
    if (!gameState.boss && !gameState.isBossWarning && gameState.score >= gameState.nextBossScore) {
        spawnBoss();
        gameState.nextBossScore += gameConfig.bossInterval;
    }

    // Difficulty scaling
    gameState.difficultyScale = 1.0 + (gameState.score / 2000);

    // Update Boss
    if (gameState.boss) {
        const b = gameState.boss;
        const timeFactor = timestamp / 1000;

        // Entry movement
        if (b.y < b.targetY) {
            b.y += 1;
        } else {
            // Unique Movement Patterns
            if (b.name === "ELDER PENTAGUARD") {
                // Steady Oscillation
                b.x += b.vx;
                if (b.x < b.size / 2 || b.x > gameWorld.offsetWidth - b.size / 2) {
                    b.vx *= -1;
                }
            } else if (b.name === "NEON SERPENT") {
                // Sinuous Wave
                b.movePhase += 0.05;
                b.x = (gameWorld.offsetWidth / 2) + Math.sin(b.movePhase) * (gameWorld.offsetWidth * 0.4);
                b.y = b.targetY + Math.cos(b.movePhase * 2) * 20;
            } else if (b.name === "VOID REAPER") {
                // Dash and Pause
                b.movePhase += 0.02;
                if (Math.sin(b.movePhase) > 0.8) {
                    // Dash
                    b.x += b.vx * 3;
                } else {
                    // Slow Float
                    b.x += b.vx * 0.5;
                }
                if (b.x < b.size / 2 || b.x > gameWorld.offsetWidth - b.size / 2) {
                    b.vx *= -1;
                }
            } else if (b.name === "CYBER HIVE") {
                // Erratic Jitter
                b.x += (Math.random() - 0.5) * 10 + b.vx;
                b.y = b.targetY + (Math.random() - 0.5) * 5;
                if (b.x < b.size / 2 || b.x > gameWorld.offsetWidth - b.size / 2) {
                    b.vx *= -1;
                }
            } else if (b.name === "STALKER PRIME") {
                // Pursuer: Tracks player slowly in both X and Y
                const dx = gameState.playerPosition.x - b.x;
                const dy = gameState.playerPosition.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    b.x += (dx / dist) * (1.5 * gameState.difficultyScale);
                    b.y += (dy / dist) * (1.5 * gameState.difficultyScale);
                }
            }
        }
        b.el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`;

        // Contact Damage logic
        const bossRect = b.el.getBoundingClientRect();
        const pRect = playerEl.getBoundingClientRect();
        if (checkCollision(bossRect, pRect)) {
            if (!gameState.activePowerUps.shield) {
                gameState.health -= 0.5; // Constant damage while touching
                healthBarEl.style.width = `${Math.max(0, gameState.health)}%`;
                if (Math.random() > 0.9) createExplosion(gameState.playerPosition.x, gameState.playerPosition.y, b.color);
                if (gameState.health <= 0) endGame();
            }
        }

        // Boss Bullet collision
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const bul = gameState.bullets[j];
            if (checkCollision(bul.el.getBoundingClientRect(), bossRect)) {
                b.health--;
                createExplosion(bul.x, bul.y, 'var(--neon-purple)');

                bul.el.style.display = 'none';
                gameState.pools.bullets.push(bul.el);
                gameState.bullets.splice(j, 1);

                if (b.health <= 0) {
                    createExplosion(b.x, b.y, 'var(--neon-purple)');

                    // Clear boss projectiles for safe reward collection
                    gameState.bossBullets.forEach(bb => {
                        bb.el.style.display = 'none';
                        gameState.pools.bossBullets.push(bb.el);
                    });
                    gameState.bossBullets = [];

                    // Fountain of coins and gems!
                    for (let c = 0; c < 25; c++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 8 + 4;
                        const vx = Math.cos(angle) * speed;
                        const vy = Math.sin(angle) * speed;
                        if (c < 5) {
                            spawnGem(b.x, b.y, vx, vy);
                        } else {
                            spawnCoin(b.x, b.y, vx, vy);
                        }
                    }

                    b.el.remove(); // Boss is unique, no pool
                    gameState.boss = null;
                    gameState.bossDefeatTime = timestamp;
                    break;
                }
            }
        }
    }

    // Update Boss Attacks
    bossAttack(timestamp);

    // Update Boss Bullets
    const pRect = playerEl.getBoundingClientRect();
    for (let i = gameState.bossBullets.length - 1; i >= 0; i--) {
        const bb = gameState.bossBullets[i];
        bb.x += bb.vx;
        bb.y += bb.vy;
        bb.el.style.transform = `translate(${bb.x}px, ${bb.y}px) translateX(-50%)`;

        const bbRect = bb.el.getBoundingClientRect();

        // Collision with player
        if (checkCollision(bbRect, pRect)) {
            if (!gameState.activePowerUps.shield) {
                gameState.health -= 20;
                healthBarEl.style.width = `${Math.max(0, gameState.health)}%`;
                createExplosion(gameState.playerPosition.x, gameState.playerPosition.y, 'var(--neon-cyan)');
                if (gameState.health <= 0) endGame();
            }

            bb.el.style.display = 'none';
            gameState.pools.bossBullets.push(bb.el);
            gameState.bossBullets.splice(i, 1);
            continue;
        }

        // Out of bounds
        if (bb.y > window.innerHeight + 20 || bb.y < -50 || bb.x < -20 || bb.x > window.innerWidth + 20) {
            bb.el.style.display = 'none';
            gameState.pools.bossBullets.push(bb.el);
            gameState.bossBullets.splice(i, 1);
        }
    }

    // Update Coins
    for (let i = gameState.coins.length - 1; i >= 0; i--) {
        const c = gameState.coins[i];

        // Magnet effect
        if (gameState.activePowerUps.magnet) {
            const dx = gameState.playerPosition.x - c.x;
            const dy = gameState.playerPosition.y - c.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < gameConfig.magnetRange) {
                const pullForce = (gameConfig.magnetRange - dist) / gameConfig.magnetRange;
                c.vx += (dx / dist) * pullForce * 2.5; // Boosted pull
                c.vy += (dy / dist) * pullForce * 2.5;
            }
        }

        // Apply movement
        c.x += c.vx;
        c.y += c.vy;

        // Physics damping
        if (!gameState.activePowerUps.magnet) {
            c.vx *= 0.95; // Gradually stop horizontal movement
            if (Math.abs(c.vx) < 0.1) c.vx = 0;

            // Settle into constant vertical drop
            if (c.vy < gameConfig.coinSpeed) {
                c.vy += 0.2; // Gravity-like acceleration until terminal speed
            } else {
                c.vy = gameConfig.coinSpeed;
            }
        } else {
            // Magnet pull
            c.vx *= 0.95;
            c.vy *= 0.95;
            if (Math.abs(c.vy) < gameConfig.coinSpeed) c.vy = gameConfig.coinSpeed;
        }

        c.el.style.left = `${c.x}px`;
        c.el.style.top = `${c.y}px`;

        // Collection
        const rect = c.el.getBoundingClientRect();
        if (checkCollision(rect, pRect)) {
            gameState.score += 5;
            scoreEl.textContent = `SCORE: ${gameState.score}`;

            c.el.style.display = 'none';
            gameState.pools.coins.push(c.el);
            gameState.coins.splice(i, 1);
            continue;
        }

        // Out of bounds
        if (c.y > window.innerHeight + 50) {
            c.el.style.display = 'none';
            gameState.pools.coins.push(c.el);
            gameState.coins.splice(i, 1);
        }
    }

    // Update particles
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

    // Update Gems
    for (let i = gameState.gems.length - 1; i >= 0; i--) {
        const g = gameState.gems[i];

        // Magnet effect
        if (gameState.activePowerUps.magnet) {
            const dx = gameState.playerPosition.x - g.x;
            const dy = gameState.playerPosition.y - g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < gameConfig.magnetRange) {
                const pullForce = (gameConfig.magnetRange - dist) / gameConfig.magnetRange;
                g.vx += (dx / dist) * pullForce * 2.0;
                g.vy += (dy / dist) * pullForce * 2.0;
            }
        }

        g.x += g.vx;
        g.y += g.vy;
        g.vy += 0.08; // Slightly less gravity than coins
        g.vx *= 0.98;

        const rect = g.el.getBoundingClientRect();
        const playerRect = playerEl.getBoundingClientRect();

        if (checkCollision(rect, playerRect)) {
            gameState.score += gameConfig.gemValue;
            scoreEl.textContent = `SCORE: ${gameState.score}`;

            createExplosion(g.x, g.y, 'var(--neon-cyan)', 5);

            g.el.style.display = 'none';
            gameState.pools.gems.push(g.el);
            gameState.gems.splice(i, 1);
            continue;
        }

        if (g.y > window.innerHeight + 50) {
            g.el.style.display = 'none';
            gameState.pools.gems.push(g.el);
            gameState.gems.splice(i, 1);
            continue;
        }

        g.el.style.left = `${g.x}px`;
        g.el.style.top = `${g.y}px`;
    }

    // Update power-ups
    for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
        const pu = gameState.powerUps[i];
        pu.y += gameConfig.powerUpSpeed; // Faster fall
        pu.el.style.transform = `translate(${pu.x}px, ${pu.y}px) translateX(-50%)`;

        const rect = pu.el.getBoundingClientRect();
        const playerRect = playerEl.getBoundingClientRect();

        if (checkCollision(rect, playerRect)) {
            if (pu.type === 'damageUpgrade') {
                gameState.attackPower += 5;
                attackPowerEl.textContent = `POW: ${gameState.attackPower}`;
                // Double pulse effect on UI
                attackPowerEl.animate([
                    { transform: 'scale(1)', filter: 'brightness(1)' },
                    { transform: 'scale(1.5)', filter: 'brightness(2)' },
                    { transform: 'scale(1)', filter: 'brightness(1)' }
                ], { duration: 500 });
            } else {
                gameState.activePowerUps[pu.type] = timestamp + (pu.type === 'magnet' ? gameConfig.magnetDuration : gameConfig.powerUpDuration);
                if (pu.type === 'shield') playerEl.classList.add('shielded');
                if (pu.type === 'magnet') playerEl.classList.add('magnetized');
            }

            pu.el.style.display = 'none';
            gameState.pools.powerUps.push(pu.el);
            gameState.powerUps.splice(i, 1);
            continue;
        }

        if (pu.y > window.innerHeight + 50) {
            pu.el.style.display = 'none';
            gameState.pools.powerUps.push(pu.el);
            gameState.powerUps.splice(i, 1);
        }
    }

    // Update bullets
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

    // Update enemies
    const playerRect = playerEl.getBoundingClientRect();
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const e = gameState.enemies[i];
        const eSpeed = gameState.activePowerUps.rush ? 10 : (gameConfig.enemySpeed * gameState.difficultyScale);
        e.y += eSpeed;
        e.el.style.transform = `translate(${e.x}px, ${e.y}px) translateX(-50%)`;

        const enemyRect = e.el.getBoundingClientRect();

        // Player collision
        if (checkCollision(playerRect, enemyRect)) {
            if (gameState.activePowerUps.rush) {
                // Rush destroys enemies
                createExplosion(e.x, e.y, 'var(--neon-red)');
                if (Math.random() < gameConfig.gemChance) {
                    spawnGem(e.x, e.y);
                } else {
                    for (let c = 0; c < 3; c++) spawnCoin(e.x, e.y);
                }
                createExplosion(e.x, e.y, 'var(--neon-red)');
                e.el.style.display = 'none';
                gameState.pools.enemies.push(e.el);
                gameState.enemies.splice(i, 1);
                continue;
            }

            if (gameState.activePowerUps.shield) {
                // Shield protects player
                createExplosion(e.x, e.y, 'var(--neon-red)');
                e.el.style.display = 'none';
                gameState.pools.enemies.push(e.el);
                gameState.enemies.splice(i, 1);
                continue;
            }

            gameState.health -= 15;
            healthBarEl.style.width = `${Math.max(0, gameState.health)}%`;

            createExplosion(e.x, e.y, 'var(--neon-red)');
            createExplosion(gameState.playerPosition.x, gameState.playerPosition.y, 'var(--neon-cyan)');

            e.el.style.display = 'none';
            gameState.pools.enemies.push(e.el);
            gameState.enemies.splice(i, 1);
            if (gameState.health <= 0) endGame();
            continue;
        }

        // Bullet collision
        for (let j = gameState.bullets.length - 1; j >= 0; j--) {
            const b = gameState.bullets[j];
            const bulletRect = b.el.getBoundingClientRect();

            if (checkCollision(bulletRect, enemyRect)) {
                e.hp -= gameState.attackPower;

                // Update HP bar visual & color
                const hpPercent = Math.max(0, (e.hp / e.maxHp) * 100);
                e.hpBarEl.style.width = `${hpPercent}%`;

                if (hpPercent > 60) e.hpBarEl.style.background = '#33ff33'; // Green
                else if (hpPercent > 30) e.hpBarEl.style.background = '#ffff33'; // Yellow
                else e.hpBarEl.style.background = '#ff3333'; // Red

                if (e.hp <= 0) {
                    if (Math.random() < gameConfig.gemChance) {
                        spawnGem(e.x, e.y);
                    } else {
                        const coinCount = 1 + Math.floor(Math.random() * 3);
                        for (let c = 0; c < coinCount; c++) spawnCoin(e.x, e.y);
                    }
                    createExplosion(e.x, e.y, 'var(--neon-red)');

                    // Spawn power-up chance
                    if (Math.random() < gameConfig.powerUpChance) {
                        spawnPowerUp(e.x, e.y);
                    }

                    e.el.style.display = 'none';
                    gameState.pools.enemies.push(e.el);
                    gameState.enemies.splice(i, 1);
                } else {
                    // Flash enemy on hit
                    e.el.style.filter = 'brightness(3) drop-shadow(0 0 15px white)';
                    setTimeout(() => {
                        if (e.el.style.display !== 'none') {
                            e.el.style.filter = 'drop-shadow(0 0 8px var(--neon-red))';
                        }
                    }, 50);
                }

                b.el.style.display = 'none';
                gameState.pools.bullets.push(b.el);
                gameState.bullets.splice(j, 1);
                break;
            }
        }

        if (e.y > window.innerHeight + 50) {
            e.el.style.display = 'none';
            gameState.pools.enemies.push(e.el);
            gameState.enemies.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Start Initialization
window.onload = init;
