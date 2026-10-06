(() => {
  const GAME_WIDTH = 360;
  const GAME_HEIGHT = 640;

  const BASE_PLAYER = {
    width: 30,
    height: 30,
    baseSpeed: 240,
    maxHp: 10,
    shotInterval: 0.34,
    bulletDamage: 1
  };

  const DAMAGE_COOLDOWN = 0.35;
  const BUFF_DURATIONS = {
    timedInvincible: 5,
    attackUp: 8,
    attackSpeedUp: 8,
    moveSpeedUp: 8
  };

  const ATTACK_SPEED_FACTOR = 0.6;
  const ATTACK_SPEED_MIN_INTERVAL = 0.12;

  const ENEMY_TYPES = {
    normal: {
      color: "#e44",
      width: 26,
      height: 26,
      hp: 2,
      speed: 90,
      score: 100,
      damage: 1,
      dropRate: 0.23
    },
    tough: {
      color: "#b45ce8",
      width: 34,
      height: 34,
      hp: 5,
      speed: 65,
      score: 220,
      damage: 2,
      dropRate: 0.37
    },
    fast: {
      color: "#f0b43a",
      width: 22,
      height: 22,
      hp: 1,
      speed: 155,
      score: 140,
      damage: 1,
      dropRate: 0.18
    }
  };

  const ITEM_TYPES = {
    shield: {
      color: "#6ec8ff",
      label: "S",
      apply: (state) => {
        state.player.shieldCount += 1;
      }
    },
    timedInvincible: {
      color: "#fff34f",
      label: "I",
      apply: (state) => {
        state.timers.timedInvincible += BUFF_DURATIONS.timedInvincible;
      }
    },
    attackUp: {
      color: "#ff7a7a",
      label: "P",
      apply: (state) => {
        state.timers.attackUp += BUFF_DURATIONS.attackUp;
      }
    },
    attackSpeedUp: {
      color: "#4fc4ff",
      label: "R",
      apply: (state) => {
        state.timers.attackSpeedUp += BUFF_DURATIONS.attackSpeedUp;
      }
    },
    moveSpeedUp: {
      color: "#84f27a",
      label: "M",
      apply: (state) => {
        state.timers.moveSpeedUp += BUFF_DURATIONS.moveSpeedUp;
      }
    },
    heal: {
      color: "#53d896",
      label: "H",
      apply: (state) => {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 3);
      }
    }
  };

  const ITEM_DROP_TABLE = [
    { type: "shield", weight: 20 },
    { type: "timedInvincible", weight: 14 },
    { type: "attackUp", weight: 20 },
    { type: "attackSpeedUp", weight: 20 },
    { type: "moveSpeedUp", weight: 20 },
    { type: "heal", weight: 16 }
  ];

  const ENEMY_SPAWN_TABLE = [
    { type: "normal", weight: 55 },
    { type: "tough", weight: 20 },
    { type: "fast", weight: 25 }
  ];

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const leftButton = document.getElementById("left-button");
  const rightButton = document.getElementById("right-button");
  const restartButton = document.getElementById("restart-button");
  const orientationOverlay = document.getElementById("orientation-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const finalScoreEl = document.getElementById("final-score");

  const hud = {
    score: document.getElementById("score"),
    hp: document.getElementById("hp"),
    shield: document.getElementById("shield"),
    invincible: document.getElementById("invincible-time"),
    attackUp: document.getElementById("attack-up-time"),
    attackSpeedUp: document.getElementById("attack-speed-time"),
    moveSpeedUp: document.getElementById("move-speed-time")
  };

  const inputState = { left: false, right: false };

  let state = createInitialState();
  let previousTime = 0;

  function createInitialState() {
    return {
      running: true,
      gameOver: false,
      score: 0,
      elapsed: 0,
      player: {
        x: GAME_WIDTH / 2 - BASE_PLAYER.width / 2,
        y: GAME_HEIGHT - 68,
        width: BASE_PLAYER.width,
        height: BASE_PLAYER.height,
        hp: BASE_PLAYER.maxHp,
        maxHp: BASE_PLAYER.maxHp,
        shieldCount: 0,
        hitCooldown: 0
      },
      bullets: [],
      enemies: [],
      items: [],
      shootTimer: 0,
      enemySpawnTimer: 0,
      enemySpawnInterval: 0.85,
      timers: {
        timedInvincible: 0,
        attackUp: 0,
        attackSpeedUp: 0,
        moveSpeedUp: 0
      }
    };
  }

  function isPortrait() {
    return window.innerHeight >= window.innerWidth;
  }

  function updateOrientationState() {
    const portrait = isPortrait();
    state.running = portrait && !state.gameOver;
    orientationOverlay.classList.toggle("hidden", portrait);
  }

  function weightedPick(table) {
    const total = table.reduce((sum, row) => sum + row.weight, 0);
    let roll = Math.random() * total;
    for (const row of table) {
      roll -= row.weight;
      if (roll <= 0) {
        return row.type;
      }
    }
    return table[table.length - 1].type;
  }

  function getAttackDamage() {
    return state.timers.attackUp > 0 ? BASE_PLAYER.bulletDamage + 1 : BASE_PLAYER.bulletDamage;
  }

  function getShotInterval() {
    if (state.timers.attackSpeedUp <= 0) {
      return BASE_PLAYER.shotInterval;
    }
    return Math.max(ATTACK_SPEED_MIN_INTERVAL, BASE_PLAYER.shotInterval * ATTACK_SPEED_FACTOR);
  }

  function getMoveSpeed() {
    return state.timers.moveSpeedUp > 0 ? BASE_PLAYER.baseSpeed * 1.45 : BASE_PLAYER.baseSpeed;
  }

  function spawnEnemy() {
    const enemyType = weightedPick(ENEMY_SPAWN_TABLE);
    const base = ENEMY_TYPES[enemyType];
    const difficulty = Math.min(2.2, 1 + state.elapsed / 70);
    const width = base.width;
    const x = Math.random() * (GAME_WIDTH - width);

    state.enemies.push({
      type: enemyType,
      x,
      y: -base.height,
      width: base.width,
      height: base.height,
      hp: Math.max(1, Math.round(base.hp * (0.85 + difficulty * 0.15))),
      speed: base.speed * (0.8 + difficulty * 0.2),
      score: base.score,
      damage: base.damage,
      dropRate: base.dropRate,
      color: base.color
    });
  }

  function fireBullet() {
    state.bullets.push({
      x: state.player.x + state.player.width / 2 - 3,
      y: state.player.y - 8,
      width: 6,
      height: 12,
      speed: 420,
      damage: getAttackDamage()
    });
  }

  function tryDropItem(enemy) {
    if (Math.random() > enemy.dropRate) {
      return;
    }

    const itemType = weightedPick(ITEM_DROP_TABLE);
    state.items.push({
      type: itemType,
      x: enemy.x + enemy.width / 2 - 11,
      y: enemy.y + enemy.height / 2 - 11,
      width: 22,
      height: 22,
      speed: 95
    });
  }

  function intersects(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function applyPlayerDamage(damage) {
    if (state.timers.timedInvincible > 0) {
      return;
    }
    if (state.player.shieldCount > 0) {
      state.player.shieldCount -= 1;
      return;
    }
    if (state.player.hitCooldown > 0) {
      return;
    }

    state.player.hp -= damage;
    state.player.hitCooldown = DAMAGE_COOLDOWN;

    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.gameOver = true;
      state.running = false;
      finalScoreEl.textContent = String(state.score);
      gameoverOverlay.classList.remove("hidden");
    }
  }

  function updateTimers(delta) {
    state.player.hitCooldown = Math.max(0, state.player.hitCooldown - delta);
    Object.keys(state.timers).forEach((key) => {
      state.timers[key] = Math.max(0, state.timers[key] - delta);
    });
  }

  function updatePlayer(delta) {
    const moveSpeed = getMoveSpeed();
    if (inputState.left && !inputState.right) {
      state.player.x -= moveSpeed * delta;
    } else if (inputState.right && !inputState.left) {
      state.player.x += moveSpeed * delta;
    }

    state.player.x = Math.max(0, Math.min(GAME_WIDTH - state.player.width, state.player.x));

    state.shootTimer -= delta;
    const interval = getShotInterval();
    while (state.shootTimer <= 0) {
      fireBullet();
      state.shootTimer += interval;
    }
  }

  function updateBullets(delta) {
    state.bullets.forEach((bullet) => {
      bullet.y -= bullet.speed * delta;
    });
    state.bullets = state.bullets.filter((bullet) => bullet.y + bullet.height >= -4);
  }

  function updateEnemies(delta) {
    state.enemySpawnTimer -= delta;
    const dynamicInterval = Math.max(0.28, state.enemySpawnInterval - state.elapsed * 0.0022);

    while (state.enemySpawnTimer <= 0) {
      spawnEnemy();
      state.enemySpawnTimer += dynamicInterval;
    }

    state.enemies.forEach((enemy) => {
      enemy.y += enemy.speed * delta;
    });
  }

  function updateItems(delta) {
    state.items.forEach((item) => {
      item.y += item.speed * delta;
    });
    state.items = state.items.filter((item) => item.y <= GAME_HEIGHT + item.height);
  }

  function resolveBulletEnemyCollisions() {
    for (const bullet of state.bullets) {
      for (const enemy of state.enemies) {
        if (bullet.removed || enemy.removed) {
          continue;
        }
        if (!intersects(bullet, enemy)) {
          continue;
        }

        enemy.hp -= bullet.damage;
        bullet.removed = true;
        if (enemy.hp <= 0) {
          enemy.removed = true;
          state.score += enemy.score;
          tryDropItem(enemy);
        }
      }
    }

    state.bullets = state.bullets.filter((bullet) => !bullet.removed);
    state.enemies = state.enemies.filter((enemy) => !enemy.removed);
  }

  function resolvePlayerEnemyCollisions() {
    for (const enemy of state.enemies) {
      if (enemy.removed) {
        continue;
      }
      if (!intersects(enemy, state.player)) {
        continue;
      }

      applyPlayerDamage(enemy.damage);
      enemy.removed = true;
      if (state.gameOver) {
        break;
      }
    }
    state.enemies = state.enemies.filter((enemy) => !enemy.removed && enemy.y <= GAME_HEIGHT + enemy.height);
  }

  function resolvePlayerItemCollisions() {
    for (const item of state.items) {
      if (item.removed) {
        continue;
      }
      if (!intersects(item, state.player)) {
        continue;
      }

      ITEM_TYPES[item.type].apply(state);
      item.removed = true;
    }

    state.items = state.items.filter((item) => !item.removed);
  }

  function updateHud() {
    hud.score.textContent = String(state.score);
    hud.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
    hud.shield.textContent = String(state.player.shieldCount);
    hud.invincible.textContent = state.timers.timedInvincible.toFixed(1);
    hud.attackUp.textContent = state.timers.attackUp.toFixed(1);
    hud.attackSpeedUp.textContent = state.timers.attackSpeedUp.toFixed(1);
    hud.moveSpeedUp.textContent = state.timers.moveSpeedUp.toFixed(1);
  }

  function drawBackground() {
    ctx.fillStyle = "#080d1a";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GAME_WIDTH, y);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = state.player;
    ctx.fillStyle = state.timers.timedInvincible > 0 ? "#fff34f" : "#4f9bff";
    ctx.beginPath();
    ctx.moveTo(p.x + p.width / 2, p.y);
    ctx.lineTo(p.x + p.width, p.y + p.height);
    ctx.lineTo(p.x, p.y + p.height);
    ctx.closePath();
    ctx.fill();

    if (p.shieldCount > 0) {
      ctx.strokeStyle = "#6ec8ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 3, p.y - 3, p.width + 6, p.height + 6);
    }
  }

  function drawBullets() {
    ctx.fillStyle = "#e3f2ff";
    state.bullets.forEach((b) => {
      ctx.fillRect(b.x, b.y, b.width, b.height);
    });
  }

  function drawEnemies() {
    state.enemies.forEach((e) => {
      ctx.fillStyle = e.color;
      if (e.type === "fast") {
        ctx.beginPath();
        ctx.arc(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(e.x, e.y, e.width, e.height);
      }

      if (e.type === "tough") {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(e.x + 4, e.y + 4, e.width - 8, 4);
      }
    });
  }

  function drawItems() {
    state.items.forEach((item) => {
      const config = ITEM_TYPES[item.type];
      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.label, item.x + item.width / 2, item.y + item.height / 2 + 1);
    });
  }

  function render() {
    drawBackground();
    drawBullets();
    drawEnemies();
    drawItems();
    drawPlayer();
  }

  function update(delta) {
    if (!state.running) {
      return;
    }

    state.elapsed += delta;
    updateTimers(delta);
    updatePlayer(delta);
    updateBullets(delta);
    updateEnemies(delta);
    updateItems(delta);
    resolveBulletEnemyCollisions();
    resolvePlayerEnemyCollisions();
    resolvePlayerItemCollisions();
    updateHud();
  }

  function loop(timestamp) {
    if (!previousTime) {
      previousTime = timestamp;
    }

    const delta = Math.min(0.05, (timestamp - previousTime) / 1000);
    previousTime = timestamp;

    update(delta);
    render();
    requestAnimationFrame(loop);
  }

  function setButtonInput(button, key, active) {
    if (!button) {
      return;
    }

    button.addEventListener(key, (event) => {
      event.preventDefault();
      active(true);
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      button.addEventListener(eventName, (event) => {
        event.preventDefault();
        active(false);
      });
    });
  }

  setButtonInput(leftButton, "pointerdown", (value) => {
    inputState.left = value;
  });

  setButtonInput(rightButton, "pointerdown", (value) => {
    inputState.right = value;
  });

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) {
      event.preventDefault();
    }

    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      inputState.left = true;
    }
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      inputState.right = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      inputState.left = false;
    }
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      inputState.right = false;
    }
  });

  window.addEventListener("blur", () => {
    inputState.left = false;
    inputState.right = false;
  });

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("resize", () => {
    updateOrientationState();
  });

  restartButton.addEventListener("click", () => {
    state = createInitialState();
    inputState.left = false;
    inputState.right = false;
    gameoverOverlay.classList.add("hidden");
    updateOrientationState();
    updateHud();
  });

  updateOrientationState();
  updateHud();
  requestAnimationFrame(loop);
})();
