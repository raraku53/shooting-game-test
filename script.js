(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const overlay = document.getElementById("overlay");
  const restartButton = document.getElementById("restartButton");
  const leftButton = document.getElementById("leftButton");
  const rightButton = document.getElementById("rightButton");

  const game = {
    width: 360,
    height: 640,
    running: true,
    score: 0,
    lastTime: 0,
    enemySpawnTimer: 0,
    shootTimer: 0,
    moveDirection: 0,
    keys: { left: false, right: false },
    player: {
      width: 34,
      height: 20,
      x: 163,
      y: 602,
      speed: 220,
    },
    bullets: [],
    enemies: [],
  };

  const random = (min, max) => Math.random() * (max - min) + min;

  function resizeCanvas() {
    const parent = canvas.parentElement;
    const width = Math.max(240, parent.clientWidth);
    const height = Math.max(320, parent.clientHeight);
    game.width = width;
    game.height = height;
    canvas.width = width;
    canvas.height = height;
    game.player.y = game.height - game.player.height - 12;
    game.player.x = Math.min(game.player.x, game.width - game.player.width);
  }

  function preventDefault(event) {
    event.preventDefault();
  }

  function handleControlStart(direction, event) {
    preventDefault(event);
    game.moveDirection = direction;
  }

  function handleControlEnd(event) {
    preventDefault(event);
    game.moveDirection = 0;
  }

  function bindControlButton(button, direction) {
    button.addEventListener("pointerdown", (event) => handleControlStart(direction, event));
    button.addEventListener("pointerup", handleControlEnd);
    button.addEventListener("pointercancel", handleControlEnd);
    button.addEventListener("pointerleave", (event) => {
      if (event.buttons === 0) {
        handleControlEnd(event);
      }
    });
    button.addEventListener("contextmenu", preventDefault);
  }

  function spawnEnemy() {
    const size = random(24, 38);
    game.enemies.push({
      width: size,
      height: size,
      x: random(0, Math.max(1, game.width - size)),
      y: -size,
      speed: random(90, 150),
    });
  }

  function shootBullet() {
    game.bullets.push({
      width: 6,
      height: 12,
      x: game.player.x + game.player.width / 2 - 3,
      y: game.player.y - 12,
      speed: 420,
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

  function gameOver() {
    game.running = false;
    overlay.classList.remove("hidden");
  }

  function resetGame() {
    game.running = true;
    game.score = 0;
    game.enemySpawnTimer = 0;
    game.shootTimer = 0;
    game.moveDirection = 0;
    game.keys.left = false;
    game.keys.right = false;
    game.bullets = [];
    game.enemies = [];
    game.player.x = game.width / 2 - game.player.width / 2;
    scoreElement.textContent = "Score: 0";
    overlay.classList.add("hidden");
  }

  function update(delta) {
    if (!game.running) {
      return;
    }

    const keyDirection = (game.keys.right ? 1 : 0) - (game.keys.left ? 1 : 0);
    const direction = game.moveDirection !== 0 ? game.moveDirection : keyDirection;
    game.player.x += direction * game.player.speed * delta;
    game.player.x = Math.max(0, Math.min(game.player.x, game.width - game.player.width));

    game.shootTimer += delta;
    if (game.shootTimer >= 0.3) {
      game.shootTimer = 0;
      shootBullet();
    }

    game.enemySpawnTimer += delta;
    if (game.enemySpawnTimer >= 0.65) {
      game.enemySpawnTimer = 0;
      spawnEnemy();
    }

    for (const bullet of game.bullets) {
      bullet.y -= bullet.speed * delta;
    }
    game.bullets = game.bullets.filter((bullet) => bullet.y + bullet.height > 0);

    for (const enemy of game.enemies) {
      enemy.y += enemy.speed * delta;
      if (enemy.y >= game.height) {
        gameOver();
      }
      if (intersects(enemy, game.player)) {
        gameOver();
      }
    }

    const survivingEnemies = [];
    for (const enemy of game.enemies) {
      let hit = false;
      for (const bullet of game.bullets) {
        if (intersects(enemy, bullet)) {
          bullet.y = -999;
          hit = true;
          game.score += 10;
          scoreElement.textContent = `Score: ${game.score}`;
          break;
        }
      }
      if (!hit) {
        survivingEnemies.push(enemy);
      }
    }
    game.enemies = survivingEnemies;
    game.bullets = game.bullets.filter((bullet) => bullet.y > -100);
  }

  function draw() {
    ctx.clearRect(0, 0, game.width, game.height);

    ctx.fillStyle = "#051128";
    ctx.fillRect(0, 0, game.width, game.height);

    ctx.fillStyle = "#2dff88";
    ctx.fillRect(game.player.x, game.player.y, game.player.width, game.player.height);

    ctx.fillStyle = "#f4ff4f";
    for (const bullet of game.bullets) {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }

    ctx.fillStyle = "#ff4d4d";
    for (const enemy of game.enemies) {
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
  }

  function tick(timestamp) {
    if (!game.lastTime) {
      game.lastTime = timestamp;
    }
    const delta = Math.min((timestamp - game.lastTime) / 1000, 0.05);
    game.lastTime = timestamp;
    update(delta);
    draw();
    requestAnimationFrame(tick);
  }

  function handleKey(event, isDown) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      game.keys.left = isDown;
      event.preventDefault();
    }
    if (key === "arrowright" || key === "d") {
      game.keys.right = isDown;
      event.preventDefault();
    }
  }

  bindControlButton(leftButton, -1);
  bindControlButton(rightButton, 1);

  window.addEventListener("keydown", (event) => handleKey(event, true), { passive: false });
  window.addEventListener("keyup", (event) => handleKey(event, false), { passive: false });
  window.addEventListener("resize", resizeCanvas);
  document.body.addEventListener("touchmove", preventDefault, { passive: false });
  restartButton.addEventListener("click", resetGame);

  resizeCanvas();
  resetGame();
  requestAnimationFrame(tick);
})();
