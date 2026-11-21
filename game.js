(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // UI Elements
  const hudEl = document.getElementById('hud');
  const starsCountEl = document.getElementById('stars-count');
  const distanceCountEl = document.getElementById('distance-count');
  const heartsDisplayEl = document.getElementById('hearts-display');
  const scoreCountEl = document.getElementById('score-count');
  const trickBannerEl = document.getElementById('trick-banner');
  const touchControlsEl = document.getElementById('touch-controls');
  const touchControlsSkiEl = document.getElementById('touch-controls-ski');

  const startScreen = document.getElementById('start-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const gameoverScreen = document.getElementById('gameover-screen');

  const bestScoreDisplay = document.getElementById('best-score-display');
  const gameoverBest = document.getElementById('gameover-best');
  const finalScoreEl = document.getElementById('final-score');
  const finalDistanceEl = document.getElementById('final-distance');
  const finalStarsEl = document.getElementById('final-stars');
  const finalFlipsEl = document.getElementById('final-flips');
  const finalTricksLabelEl = document.getElementById('final-tricks-label');

  const muteBtn = document.getElementById('mute-btn');
  const pauseBtn = document.getElementById('pause-btn');

  let activeGame = 'atv'; // 'atv' | 'ski'

  // Buttons
  document.getElementById('start-atv-btn').addEventListener('click', () => startGame('atv'));
  document.getElementById('start-ski-btn').addEventListener('click', () => startGame('ski'));
  document.getElementById('resume-btn').addEventListener('click', togglePause);
  document.getElementById('restart-pause-btn').addEventListener('click', () => {
    pauseScreen.classList.add('hidden');
    startGame(activeGame);
  });
  document.getElementById('menu-pause-btn').addEventListener('click', showMenu);
  document.getElementById('play-again-btn').addEventListener('click', () => startGame(activeGame));
  document.getElementById('menu-gameover-btn').addEventListener('click', showMenu);
  pauseBtn.addEventListener('click', togglePause);
  muteBtn.addEventListener('click', toggleMute);

  // Storage
  const BEST_KEY = 'khusi_dune_dash_best_v1';
  let bestScore = Number(localStorage.getItem(BEST_KEY) || 0);
  bestScoreDisplay.textContent = `Best Score: ${bestScore}`;

  // Sound System (Web Audio API)
  let audioCtx = null;
  let isMuted = false;

  function ensureAudio() {
    if (!audioCtx && !isMuted) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.12, slideTo = null) {
    if (isMuted || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playStarSound() {
    playTone(660, 0.09, 'triangle', 0.14, 990);
    setTimeout(() => playTone(990, 0.12, 'triangle', 0.12, 1320), 55);
  }

  function playJumpSound() {
    playTone(220, 0.18, 'sine', 0.14, 480);
  }

  function playFlipSound() {
    playTone(523, 0.1, 'triangle', 0.15);
    setTimeout(() => playTone(659, 0.1, 'triangle', 0.15), 70);
    setTimeout(() => playTone(784, 0.18, 'triangle', 0.16), 140);
  }

  function playBoostSound() {
    playTone(300, 0.25, 'sawtooth', 0.08, 720);
  }

  function playBonkSound() {
    playTone(180, 0.22, 'sawtooth', 0.14, 70);
  }

  function toggleMute() {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
  }

  // Input State
  const keys = {
    gas: false,
    brake: false,
    left: false,
    right: false,
    jump: false,
    tuck: false,
  };

  let jumpPressedOnce = false;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keys.right = true;
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      keys.gas = true;
      keys.tuck = true;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      keys.brake = true;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keys.left = true;
    }
    if (e.code === 'Space') {
      if (!keys.jump) jumpPressedOnce = true;
      keys.jump = true;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state.mode === 'playing' || state.mode === 'paused') {
        togglePause();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keys.right = false;
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      keys.gas = false;
      keys.tuck = false;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      keys.brake = false;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keys.left = false;
    }
    if (e.code === 'Space') {
      keys.jump = false;
    }
  });

  // Touch / Pointer Controls
  function bindHoldButton(el, onDown, onUp) {
    const start = (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      onDown();
    };
    const end = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
      onUp();
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('pointercancel', end);
  }

  bindHoldButton(
    document.getElementById('btn-gas'),
    () => { keys.gas = true; keys.tuck = true; },
    () => { keys.gas = false; keys.tuck = false; }
  );
  bindHoldButton(
    document.getElementById('btn-tilt-back'),
    () => { keys.left = true; },
    () => { keys.left = false; }
  );
  bindHoldButton(
    document.getElementById('btn-tilt-fwd'),
    () => { keys.right = true; },
    () => { keys.right = false; }
  );
  bindHoldButton(
    document.getElementById('btn-jump'),
    () => { jumpPressedOnce = true; keys.jump = true; },
    () => { keys.jump = false; }
  );
  bindHoldButton(
    document.getElementById('btn-ski-left'),
    () => { keys.left = true; },
    () => { keys.left = false; }
  );
  bindHoldButton(
    document.getElementById('btn-ski-right'),
    () => { keys.right = true; },
    () => { keys.right = false; }
  );
  bindHoldButton(
    document.getElementById('btn-ski-jump'),
    () => { jumpPressedOnce = true; keys.jump = true; },
    () => { keys.jump = false; }
  );
  bindHoldButton(
    document.getElementById('btn-ski-tuck'),
    () => { keys.tuck = true; },
    () => { keys.tuck = false; }
  );

  // Canvas Resize
  let width = 1280;
  let height = 720;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Terrain Generator (Smooth rolling sand dunes with gentle downhill flow)
  function getTerrainY(x) {
    const gentleSlope = x * 0.055;
    const bigDune = Math.sin(x * 0.0024) * 115;
    const midDune = Math.sin(x * 0.0061 + 1.3) * 52;
    const smallRipple = Math.sin(x * 0.015 + 0.7) * 14;
    return 360 + gentleSlope + bigDune + midDune + smallRipple;
  }

  function getTerrainSlope(x) {
    const dx = 3;
    return (getTerrainY(x + dx) - getTerrainY(x - dx)) / (dx * 2);
  }

  function getTerrainAngle(x) {
    return Math.atan(getTerrainSlope(x));
  }

  // Game State
  const state = {
    mode: 'menu', // 'menu' | 'playing' | 'paused' | 'gameover'
    cameraX: 0,
    cameraY: 0,
    score: 0,
    bonusScore: 0,
    stars: 0,
    flips: 0,
    hearts: 3,
    distance: 0,
    startX: 120,
    nextSpawnX: 480,
    nextPropX: 250,
    nextMilestone: 250,
    bannerTimer: 0,
    time: 0,
  };

  const atv = {
    x: 120,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVel: 0,
    onGround: true,
    wheelRot: 0,
    airTime: 0,
    flipAccum: 0,
    lastAngle: 0,
    invulnTimer: 0,
    boostTimer: 0,
    scarfPhase: 0,
  };

  let collectibles = []; // { x, y, r, collected, pulse }
  let boostPads = [];    // { x, triggered }
  let props = [];        // { x, type, scale }
  let particles = [];    // { x, y, vx, vy, life, maxLife, size, color }
  let clouds = [];       // { x, y, scale, speed }

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random() * 1600,
        y: 50 + Math.random() * 160,
        scale: 0.6 + Math.random() * 0.8,
        speed: 8 + Math.random() * 14,
      });
    }
  }
  initClouds();

  function resetGame() {
    state.startX = 120;
    state.score = 0;
    state.bonusScore = 0;
    state.stars = 0;
    state.flips = 0;
    state.hearts = 3;
    state.distance = 0;
    state.nextSpawnX = 460;
    state.nextPropX = 220;
    state.nextMilestone = 250;
    state.bannerTimer = 0;
    trickBannerEl.classList.add('hidden');

    atv.x = state.startX;
    atv.y = getTerrainY(atv.x);
    atv.vx = 180;
    atv.vy = 0;
    atv.angle = getTerrainAngle(atv.x);
    atv.angularVel = 0;
    atv.onGround = true;
    atv.wheelRot = 0;
    atv.airTime = 0;
    atv.flipAccum = 0;
    atv.lastAngle = atv.angle;
    atv.invulnTimer = 0;
    atv.boostTimer = 0;

    state.cameraX = atv.x - width * 0.25;
    state.cameraY = atv.y - height * 0.6;

    collectibles = [];
    boostPads = [];
    props = [];
    particles = [];

    // Pre-populate ahead
    spawnAhead(atv.x + width + 900);
    updateHUD();
  }

  function startGame(gameMode = 'atv') {
    activeGame = gameMode;
    ensureAudio();
    state.bannerTimer = 0;
    trickBannerEl.classList.add('hidden');
    const modeObj = activeGame === 'ski' ? window.SkiMode : window.AtvRaceMode;
    modeObj.reset();
    const s = modeObj.getStats();
    state.score = s.score;
    state.distance = s.distance;
    state.stars = s.stars;
    state.hearts = s.hearts;
    state.flips = s.tricks;
    updateHUD();

    if (activeGame === 'ski') {
      touchControlsEl.classList.add('hidden');
      touchControlsSkiEl.classList.remove('hidden');
    } else {
      touchControlsSkiEl.classList.add('hidden');
      touchControlsEl.classList.remove('hidden');
    }
    state.mode = 'playing';
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
  }

  function showMenu() {
    state.mode = 'menu';
    pauseScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    hudEl.classList.add('hidden');
    touchControlsEl.classList.add('hidden');
    touchControlsSkiEl.classList.add('hidden');
    startScreen.classList.remove('hidden');
    bestScoreDisplay.textContent = `Best Score: ${bestScore}`;
  }

  function togglePause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      pauseScreen.classList.remove('hidden');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      pauseScreen.classList.add('hidden');
    }
  }

  function triggerGameOver() {
    state.mode = 'gameover';
    hudEl.classList.add('hidden');
    touchControlsEl.classList.add('hidden');
    touchControlsSkiEl.classList.add('hidden');
    gameoverScreen.classList.remove('hidden');

    const modeObj = activeGame === 'ski' ? window.SkiMode : window.AtvRaceMode;
    const s = modeObj.getStats();
    state.score = s.score;
    state.distance = s.distance;
    state.stars = s.stars;
    state.flips = s.tricks;
    finalTricksLabelEl.textContent = 'Tricks';

    if (state.score > bestScore) {
      bestScore = state.score;
      localStorage.setItem(BEST_KEY, String(bestScore));
    }

    finalScoreEl.textContent = state.score;
    finalDistanceEl.textContent = `${state.distance}m`;
    finalStarsEl.textContent = state.stars;
    finalFlipsEl.textContent = state.flips;
    gameoverBest.textContent = `Best Score: ${bestScore}`;
  }

  function showBanner(text) {
    trickBannerEl.textContent = text;
    trickBannerEl.classList.remove('hidden');
    // Restart animation
    trickBannerEl.style.animation = 'none';
    void trickBannerEl.offsetWidth;
    trickBannerEl.style.animation = '';
    state.bannerTimer = 1.6;
  }

  function updateHUD() {
    starsCountEl.textContent = state.stars;
    distanceCountEl.textContent = `${state.distance}m`;
    scoreCountEl.textContent = state.score;
    heartsDisplayEl.textContent = '❤️'.repeat(Math.max(0, state.hearts)) + '🤍'.repeat(Math.max(0, 3 - state.hearts));
  }

  // Spawning Stars, Boost Pads, and Desert Props
  function spawnAhead(targetX) {
    while (state.nextSpawnX < targetX) {
      const baseX = state.nextSpawnX;
      const pattern = Math.random();

      if (pattern < 0.65) {
        // Arc of stars over the dune
        const count = 4 + Math.floor(Math.random() * 3);
        const spacing = 58;
        const arcHeight = 55 + Math.random() * 65;
        for (let i = 0; i < count; i++) {
          const sx = baseX + i * spacing;
          const t = count > 1 ? i / (count - 1) : 0.5;
          const lift = Math.sin(t * Math.PI) * arcHeight + 36;
          collectibles.push({
            x: sx,
            y: getTerrainY(sx) - lift,
            r: 16,
            collected: false,
            pulse: Math.random() * Math.PI * 2,
          });
        }
        state.nextSpawnX += count * spacing + 220 + Math.random() * 180;
      } else {
        // Boost pad + trailing stars
        boostPads.push({ x: baseX, triggered: false });
        for (let i = 1; i <= 3; i++) {
          const sx = baseX + i * 75;
          collectibles.push({
            x: sx,
            y: getTerrainY(sx) - 42,
            r: 16,
            collected: false,
            pulse: i * 0.6,
          });
        }
        state.nextSpawnX += 460 + Math.random() * 200;
      }
    }

    while (state.nextPropX < targetX) {
      const types = ['cactus', 'rock', 'palm', 'shrub'];
      const type = types[Math.floor(Math.random() * types.length)];
      props.push({
        x: state.nextPropX,
        type,
        scale: 0.8 + Math.random() * 0.55,
      });
      state.nextPropX += 160 + Math.random() * 240;
    }

    // Distance milestone flags every 250m (1m = 20px)
    const milestoneWorldX = state.startX + state.nextMilestone * 20;
    if (milestoneWorldX < targetX) {
      props.push({
        x: milestoneWorldX,
        type: 'flag',
        label: `${state.nextMilestone}m`,
        scale: 1,
      });
      state.nextMilestone += 250;
    }
  }

  function emitParticles(x, y, count, color, speedMin, speedMax, life = 0.45) {
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * Math.random();
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        life,
        maxLife: life,
        size: 3 + Math.random() * 5,
        color,
      });
    }
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  // Physics Update
  function update(dt) {
    state.time += dt;

    // Clouds drift
    for (const c of clouds) {
      c.x -= c.speed * dt;
      if (c.x < -200) c.x = width + 220;
    }

    if (state.mode !== 'playing') return;

    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        trickBannerEl.classList.add('hidden');
      }
    }

    const jumpNow = jumpPressedOnce;
    jumpPressedOnce = false;
    const modeObj = activeGame === 'ski' ? window.SkiMode : window.AtvRaceMode;
    modeObj.update(dt, keys, jumpNow, {
      playStar: playStarSound,
      playJump: playJumpSound,
      playFlip: playFlipSound,
      playBoost: playBoostSound,
      playBonk: playBonkSound,
      showBanner,
      triggerGameOver,
    }, state.time);
    if (state.mode === 'playing') {
      const s = modeObj.getStats();
      state.stars = s.stars;
      state.distance = s.distance;
      state.hearts = s.hearts;
      state.flips = s.tricks;
      state.score = s.score;
      updateHUD();
    }
    return;

    if (atv.invulnTimer > 0) atv.invulnTimer -= dt;
    if (atv.boostTimer > 0) atv.boostTimer -= dt;

    const gravity = 980;
    const terrainY = getTerrainY(atv.x);
    const terrainAngle = getTerrainAngle(atv.x);

    if (atv.onGround) {
      // Ground movement
      const speed = Math.hypot(atv.vx, atv.vy);
      const maxSpeed = atv.boostTimer > 0 ? 780 : 540;
      const accel = atv.boostTimer > 0 ? 760 : 460;

      // Project velocity along terrain direction
      let forwardSpeed = atv.vx * Math.cos(terrainAngle) + atv.vy * Math.sin(terrainAngle);

      // Gravity along slope
      forwardSpeed += gravity * Math.sin(terrainAngle) * dt * 0.85;

      if (keys.gas) {
        forwardSpeed += accel * dt;
      } else if (keys.brake) {
        forwardSpeed -= 420 * dt;
      } else {
        // Gentle rolling friction
        forwardSpeed *= Math.pow(0.92, dt * 60 * 0.15);
      }

      // Keep minimum gentle forward roll so kids don't get stuck
      if (forwardSpeed < 70 && !keys.brake) forwardSpeed = 70;
      if (forwardSpeed > maxSpeed) forwardSpeed = maxSpeed;
      if (forwardSpeed < -140) forwardSpeed = -140;

      atv.vx = forwardSpeed * Math.cos(terrainAngle);
      atv.vy = forwardSpeed * Math.sin(terrainAngle);

      // Hop
      if (jumpPressedOnce) {
        atv.vy -= 400;
        atv.onGround = false;
        atv.airTime = 0;
        atv.flipAccum = 0;
        atv.lastAngle = atv.angle;
        playJumpSound();
        emitParticles(atv.x - 18, atv.y, 10, '#f4c27a', 40, 140, 0.5);
      } else {
        // Check if going fast enough over a crest to launch into the air
        const nextX = atv.x + atv.vx * dt;
        const nextTerrainY = getTerrainY(nextX);
        const expectedY = atv.y + atv.vy * dt + 0.5 * gravity * dt * dt;
        if (nextTerrainY - expectedY > 4.5 && forwardSpeed > 260) {
          atv.onGround = false;
          atv.airTime = 0;
          atv.flipAccum = 0;
          atv.lastAngle = atv.angle;
        }
      }

      atv.x += atv.vx * dt;
      if (atv.onGround) {
        atv.y = getTerrainY(atv.x);
        const targetAng = getTerrainAngle(atv.x);
        atv.angle += normalizeAngle(targetAng - atv.angle) * Math.min(1, dt * 16);
        atv.angularVel = 0;

        // Kick up sand dust when moving fast
        if (Math.abs(forwardSpeed) > 150 && Math.random() < 0.55) {
          const dustColor = atv.boostTimer > 0 ? '#ff9f1c' : '#e9b872';
          emitParticles(atv.x - 22, atv.y - 2, 1, dustColor, 20, 75, 0.35);
        }
      }
      atv.wheelRot += (forwardSpeed * dt) / 14;
    } else {
      // Airborne physics
      atv.airTime += dt;
      atv.vy += gravity * dt;
      atv.x += atv.vx * dt;
      atv.y += atv.vy * dt;

      // Air rotation controls
      const rotSpeed = 5.4;
      if (keys.left) {
        atv.angularVel = -rotSpeed;
      } else if (keys.right) {
        atv.angularVel = rotSpeed;
      } else {
        // Gentle auto-leveling when not holding tilt
        atv.angularVel *= Math.pow(0.88, dt * 60 * 0.2);
      }

      const prevAngle = atv.angle;
      atv.angle += atv.angularVel * dt;
      atv.flipAccum += normalizeAngle(atv.angle - prevAngle);
      atv.wheelRot += 8 * dt;

      // Landing check
      const groundY = getTerrainY(atv.x);
      if (atv.y >= groundY) {
        atv.y = groundY;
        atv.onGround = true;

        const landSlopeAng = getTerrainAngle(atv.x);
        const diff = Math.abs(normalizeAngle(atv.angle - landSlopeAng));

        if (diff > 1.85 && atv.invulnTimer <= 0) {
          // Upside-down bonk!
          state.hearts -= 1;
          playBonkSound();
          emitParticles(atv.x, atv.y - 10, 16, '#ff6b6b', 60, 190, 0.6);

          if (state.hearts <= 0) {
            updateHUD();
            triggerGameOver();
            return;
          } else {
            atv.invulnTimer = 1.6;
            atv.vy = -220;
            atv.vx = Math.max(180, atv.vx * 0.65);
            atv.onGround = false;
            atv.angle = landSlopeAng;
            atv.flipAccum = 0;
            showBanner('Oops! Watch your landing! ❤️');
          }
        } else {
          // Clean landing!
          const flipsDone = Math.floor((Math.abs(atv.flipAccum) + 0.45) / (Math.PI * 2));
          if (flipsDone >= 1) {
            state.flips += flipsDone;
            const pts = flipsDone * 50;
            state.bonusScore += pts;
            playFlipSound();
            const label = flipsDone === 1
              ? (atv.flipAccum < 0 ? `Backflip! +${pts}` : `Frontflip! +${pts}`)
              : `${flipsDone}x Flip! +${pts}`;
            showBanner(label);
            emitParticles(atv.x, atv.y, 18, '#ffd166', 60, 210, 0.65);
          } else if (atv.airTime > 1.05) {
            state.bonusScore += 30;
            showBanner('Big Air! +30');
            emitParticles(atv.x, atv.y, 12, '#f4c27a', 40, 140, 0.45);
          } else {
            emitParticles(atv.x, atv.y, 6, '#e9b872', 30, 90, 0.35);
          }

          // Smoothly convert downward momentum into forward speed on downslopes
          const speed = Math.hypot(atv.vx, atv.vy);
          atv.vx = Math.max(atv.vx, speed * Math.cos(landSlopeAng) * 0.92);
          atv.vy = atv.vx * Math.tan(landSlopeAng);
          atv.angle = landSlopeAng;
        }
        atv.flipAccum = 0;
      }
    }

    jumpPressedOnce = false;
    atv.scarfPhase += dt * (6 + Math.hypot(atv.vx, atv.vy) * 0.02);

    // Collectibles collision
    for (const item of collectibles) {
      if (item.collected) continue;
      const dx = item.x - atv.x;
      const dy = item.y - (atv.y - 22);
      if (dx * dx + dy * dy < 38 * 38) {
        item.collected = true;
        state.stars += 1;
        state.bonusScore += 15;
        playStarSound();
        emitParticles(item.x, item.y, 10, '#ffd166', 40, 150, 0.45);
      }
    }

    // Boost pads collision
    for (const pad of boostPads) {
      if (!pad.triggered && Math.abs(atv.x - pad.x) < 34 && atv.onGround) {
        pad.triggered = true;
        atv.boostTimer = 2.0;
        atv.vx = Math.max(atv.vx, 680);
        state.bonusScore += 25;
        playBoostSound();
        showBanner('Turbo Boost! ⚡');
        emitParticles(atv.x, atv.y - 8, 16, '#ff9f1c', 70, 220, 0.55);
      }
    }

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Cleanup passed objects & spawn ahead
    const cullX = atv.x - width * 0.6;
    collectibles = collectibles.filter((c) => !c.collected && c.x > cullX);
    boostPads = boostPads.filter((b) => b.x > cullX);
    props = props.filter((p) => p.x > cullX);
    spawnAhead(atv.x + width + 700);

    // Update camera smoothly
    const targetCamX = atv.x - width * 0.28;
    const targetCamY = atv.y - height * 0.62;
    state.cameraX += (targetCamX - state.cameraX) * Math.min(1, dt * 10);
    state.cameraY += (targetCamY - state.cameraY) * Math.min(1, dt * 6);

    // Distance & Score
    state.distance = Math.max(0, Math.floor((atv.x - state.startX) / 20));
    state.score = state.distance + state.bonusScore;
    updateHUD();
  }

  // Rendering
  function drawSky() {
    // Warm desert sky that subtly shifts toward golden sunset as distance increases
    const sunsetFactor = Math.min(1, state.distance / 1500);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, sunsetFactor < 0.5 ? '#56cfe1' : '#ff7b54');
    grad.addColorStop(0.55, sunsetFactor < 0.5 ? '#a8e6cf' : '#ffb26b');
    grad.addColorStop(1, '#ffe5b4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Sun
    const sunX = width * 0.8;
    const sunY = height * 0.2 + sunsetFactor * 80;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 110);
    sunGlow.addColorStop(0, 'rgba(255, 245, 190, 0.95)');
    sunGlow.addColorStop(0.4, 'rgba(255, 210, 110, 0.45)');
    sunGlow.addColorStop(1, 'rgba(255, 210, 110, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff5cc';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 36, 0, Math.PI * 2);
    ctx.fill();

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    for (const c of clouds) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.arc(22, -6, 28, 0, Math.PI * 2);
      ctx.arc(48, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParallaxDunes(parallax, baseY, amp, freq, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    const step = 28;
    for (let sx = 0; sx <= width + step; sx += step) {
      const wx = sx + state.cameraX * parallax;
      const y = baseY + Math.sin(wx * freq) * amp + Math.sin(wx * freq * 2.1 + 1) * (amp * 0.35);
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  function drawProp(p) {
    const sx = p.x - state.cameraX;
    const sy = getTerrainY(p.x) - state.cameraY;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(p.scale, p.scale);

    if (p.type === 'cactus') {
      ctx.fillStyle = '#4ea854';
      ctx.beginPath();
      ctx.roundRect(-7, -54, 14, 56, 7);
      ctx.roundRect(-22, -40, 18, 10, 5);
      ctx.roundRect(-22, -52, 10, 18, 5);
      ctx.roundRect(4, -32, 18, 10, 5);
      ctx.roundRect(12, -46, 10, 20, 5);
      ctx.fill();
    } else if (p.type === 'rock') {
      ctx.fillStyle = '#c48f5a';
      ctx.beginPath();
      ctx.moveTo(-20, 2);
      ctx.lineTo(-12, -18);
      ctx.lineTo(6, -22);
      ctx.lineTo(20, 2);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'shrub') {
      ctx.fillStyle = '#8ab17d';
      ctx.beginPath();
      ctx.arc(-8, -6, 9, 0, Math.PI * 2);
      ctx.arc(4, -10, 11, 0, Math.PI * 2);
      ctx.arc(14, -5, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'palm') {
      ctx.strokeStyle = '#9c6644';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(8, -38, 2, -74);
      ctx.stroke();

      ctx.fillStyle = '#52b788';
      for (let a = -2; a <= 2; a++) {
        ctx.save();
        ctx.translate(2, -74);
        ctx.rotate(a * 0.55);
        ctx.beginPath();
        ctx.ellipse(18, 0, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (p.type === 'flag') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -68);
      ctx.stroke();

      ctx.fillStyle = '#ff5400';
      ctx.beginPath();
      ctx.moveTo(2, -66);
      ctx.lineTo(44, -54);
      ctx.lineTo(2, -42);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#3a2010';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(p.label, -10, -74);
    }

    ctx.restore();
  }

  function drawTerrain() {
    // Main sand dune
    const grad = ctx.createLinearGradient(0, height * 0.45, 0, height);
    grad.addColorStop(0, '#f6bd60');
    grad.addColorStop(0.4, '#f29e4c');
    grad.addColorStop(1, '#d97736');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, height);
    const step = 12;
    for (let sx = 0; sx <= width + step; sx += step) {
      const wx = sx + state.cameraX;
      const wy = getTerrainY(wx) - state.cameraY;
      ctx.lineTo(sx, wy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Bright sand crest highlight
    ctx.strokeStyle = '#ffe8a3';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let sx = 0; sx <= width + step; sx += step) {
      const wx = sx + state.cameraX;
      const wy = getTerrainY(wx) - state.cameraY;
      if (sx === 0) ctx.moveTo(sx, wy);
      else ctx.lineTo(sx, wy);
    }
    ctx.stroke();
  }

  function drawBoostPad(pad) {
    const sx = pad.x - state.cameraX;
    const sy = getTerrainY(pad.x) - state.cameraY;
    const ang = getTerrainAngle(pad.x);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.fillStyle = pad.triggered ? '#ffd166' : '#00bbf9';
    ctx.beginPath();
    ctx.roundRect(-24, -7, 48, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡⚡', 0, -11);
    ctx.restore();
  }

  function drawStar(item) {
    const sx = item.x - state.cameraX;
    const sy = item.y - state.cameraY + Math.sin(state.time * 4 + item.pulse) * 5;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.sin(state.time * 2.5 + item.pulse) * 0.15);

    // Glow
    ctx.fillStyle = 'rgba(255, 214, 70, 0.32)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    // 5-point star
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#f77f00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 14 : 6.5;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawWheel(x, y, radius, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Tire
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Tread nubs
    ctx.fillStyle = '#1a1b28';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (radius - 1), Math.sin(a) * (radius - 1), 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rim
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
    ctx.fill();

    // Hubcap spoke
    ctx.strokeStyle = '#e05a2b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, 0);
    ctx.lineTo(radius * 0.4, 0);
    ctx.moveTo(0, -radius * 0.4);
    ctx.lineTo(0, radius * 0.4);
    ctx.stroke();

    ctx.restore();
  }

  function drawATV() {
    const sx = atv.x - state.cameraX;
    const sy = atv.y - state.cameraY;

    // Blink during invulnerability
    if (atv.invulnTimer > 0 && Math.floor(atv.invulnTimer * 12) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(atv.angle);

    // Suspension bounce
    const bounce = atv.onGround ? Math.sin(state.time * 18) * 1.2 : 0;

    // Flowing scarf behind rider
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -34 + bounce);
    ctx.quadraticCurveTo(
      -24,
      -38 + Math.sin(atv.scarfPhase) * 6,
      -40,
      -31 + Math.cos(atv.scarfPhase * 1.3) * 7
    );
    ctx.stroke();

    // Rider body
    ctx.fillStyle = '#48cae4';
    ctx.beginPath();
    ctx.roundRect(-10, -38 + bounce, 16, 18, 6);
    ctx.fill();

    // Rider arm holding handlebars
    ctx.strokeStyle = '#48cae4';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(2, -32 + bounce);
    ctx.lineTo(15, -26 + bounce);
    ctx.stroke();

    // Helmet
    ctx.fillStyle = '#ff5400';
    ctx.beginPath();
    ctx.arc(-1, -44 + bounce, 10, 0, Math.PI * 2);
    ctx.fill();

    // Goggles / Visor
    ctx.fillStyle = '#caf0f8';
    ctx.beginPath();
    ctx.roundRect(2, -48 + bounce, 8, 6, 3);
    ctx.fill();

    // ATV Body / Frame
    ctx.fillStyle = atv.boostTimer > 0 ? '#ff006e' : '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(-26, -16 + bounce);
    ctx.lineTo(-14, -26 + bounce);
    ctx.lineTo(18, -26 + bounce);
    ctx.lineTo(28, -14 + bounce);
    ctx.lineTo(22, -8 + bounce);
    ctx.lineTo(-22, -8 + bounce);
    ctx.closePath();
    ctx.fill();

    // Seat
    ctx.fillStyle = '#3a2010';
    ctx.beginPath();
    ctx.roundRect(-15, -28 + bounce, 16, 5, 3);
    ctx.fill();

    // Handlebars
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, -25 + bounce);
    ctx.lineTo(17, -33 + bounce);
    ctx.stroke();

    // Wheels
    drawWheel(-18, -10, 12, atv.wheelRot);
    drawWheel(18, -10, 12, atv.wheelRot);

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - state.cameraX, p.y - state.cameraY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    if (state.mode !== 'menu') {
      const modeObj = activeGame === 'ski' ? window.SkiMode : window.AtvRaceMode;
      modeObj.render(ctx, width, height, state.time);
      return;
    }

    drawSky();
    drawParallaxDunes(0.15, height * 0.56, 48, 0.002, 'rgba(235, 168, 95, 0.55)');
    drawParallaxDunes(0.32, height * 0.66, 62, 0.003, 'rgba(224, 145, 72, 0.72)');
    drawTerrain();

    for (const p of props) drawProp(p);
    for (const pad of boostPads) drawBoostPad(pad);
    for (const item of collectibles) {
      if (!item.collected) drawStar(item);
    }

    drawParticles();
    drawATV();
  }

  // Main Loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;

    // Gentle idle animation on menu
    if (state.mode === 'menu') {
      state.cameraX += 90 * dt;
      atv.x = state.cameraX + width * 0.28;
      atv.y = getTerrainY(atv.x);
      atv.angle = getTerrainAngle(atv.x);
      atv.wheelRot += 5 * dt;
      atv.scarfPhase += dt * 8;
      state.cameraY = atv.y - height * 0.62;
    }

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
})();
