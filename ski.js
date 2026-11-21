(() => {
  'use strict';

  const FAR_Z = 76;
  const NEAR_Z = 2.2;
  const SKIER_Z_OFFSET = 4.2;

  const ski = {
    x: 0,
    z: 0,
    y: 0,        // world Y position of skier
    vy: 0,       // vertical velocity
    vx: 0,       // lateral velocity
    vz: 20,      // forward speed down the slope
    camX: 0,
    camY: 2.5,
    camPitch: 0,
    onGround: true,
    lean: 0,
    pitch: 0,
    spinAngle: 0,
    trickDone: false,
    invulnTimer: 0,
    boostTimer: 0,
    scarfPhase: 0,
    nextSpawnZ: 18,
    stars: 0,
    tricks: 0,
    hearts: 3,
    bonusScore: 0,
    distance: 0,
  };

  let items = [];     // { type: 'tree'|'rock'|'ramp'|'star'|'boost', x, z, yOffset, hit, pulse }
  let tracks = [];    // { x, z, y }
  let particles = []; // { x, y, z, vx, vy, vz, life, maxLife, size, color }
  let snowflakes = [];
  let mountains = [];

  function initEnvironment() {
    snowflakes = [];
    for (let i = 0; i < 60; i++) {
      snowflakes.push({
        x: Math.random(),
        y: Math.random(),
        r: 1.5 + Math.random() * 2.4,
        speed: 0.06 + Math.random() * 0.09,
        drift: Math.random() * Math.PI * 2,
      });
    }

    mountains = [];
    for (let i = 0; i < 14; i++) {
      mountains.push({
        x: i / 13,
        h: 0.09 + Math.random() * 0.13,
        w: 0.12 + Math.random() * 0.08,
      });
    }
  }
  initEnvironment();

  // Steep 3D Mountain Ski Slope Heightfield (100% freeform, endless in all directions)
  function getHillY(wx, wz) {
    const downhillDrop = -wz * 0.24;
    const rollers = Math.sin(wz * 0.055) * 6.5 + Math.cos(wz * 0.022) * 5.0;
    const crossContour = Math.sin(wx * 0.075 + wz * 0.03) * 2.2;
    return downhillDrop + rollers + crossContour;
  }

  function getHillSlopeZ(wx, wz) {
    const dz = 0.5;
    return (getHillY(wx, wz + dz) - getHillY(wx, wz - dz)) / (dz * 2);
  }

  function reset() {
    ski.x = 0;
    ski.z = 0;
    const startGround = getHillY(0, SKIER_Z_OFFSET);
    ski.y = startGround;
    ski.vy = 0;
    ski.vx = 0;
    ski.vz = 18;
    ski.camX = 0;
    ski.camY = startGround + 2.2;
    ski.camPitch = getHillSlopeZ(0, SKIER_Z_OFFSET) * 0.65;
    ski.onGround = true;
    ski.lean = 0;
    ski.pitch = 0;
    ski.spinAngle = 0;
    ski.trickDone = false;
    ski.invulnTimer = 0;
    ski.boostTimer = 0;
    ski.scarfPhase = 0;
    ski.nextSpawnZ = 16;
    ski.stars = 0;
    ski.tricks = 0;
    ski.hearts = 3;
    ski.bonusScore = 0;
    ski.distance = 0;

    items = [];
    tracks = [];
    particles = [];

    spawnAhead(FAR_Z);
  }

  function spawnAhead(targetZ) {
    while (ski.nextSpawnZ < targetZ) {
      const z = ski.nextSpawnZ;
      const center = ski.x;
      const roll = Math.random();

      if (roll < 0.30) {
        // Slalom curve of stars
        const dir = Math.random() < 0.5 ? -1 : 1;
        const startX = center + (Math.random() - 0.5) * 14;
        for (let i = 0; i < 5; i++) {
          items.push({
            type: 'star',
            x: startX + dir * Math.sin(i * 0.7) * 3.5,
            z: z + i * 2.8,
            yOffset: 0.75,
            hit: false,
            pulse: i * 0.6,
          });
        }
      } else if (roll < 0.46) {
        // Ski Jump Ramp + airborne star arc!
        const rx = center + (Math.random() - 0.5) * 14;
        items.push({ type: 'ramp', x: rx, z, yOffset: 0, hit: false, pulse: 0 });
        for (let i = 1; i <= 3; i++) {
          items.push({
            type: 'star',
            x: rx,
            z: z + i * 3.6,
            yOffset: 1.0 + Math.sin((i / 4) * Math.PI) * 2.4,
            hit: false,
            pulse: i * 0.5,
          });
        }
      } else if (roll < 0.56) {
        // Speed Boost Gate
        const bx = center + (Math.random() - 0.5) * 16;
        items.push({ type: 'boost', x: bx, z, yOffset: 0, hit: false, pulse: 0 });
      }

      // Scatter trees & rocks across wide freeform mountain
      const obstacleCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < obstacleCount; i++) {
        const ox = center + (Math.random() - 0.5) * 58;
        if (z < 24 && Math.abs(ox) < 3.5) continue;
        const tRoll = Math.random();
        items.push({
          type: tRoll < 0.6 ? 'tree' : tRoll < 0.82 ? 'bush' : 'rock',
          x: ox,
          z: z + Math.random() * 3,
          yOffset: 0,
          hit: false,
          pulse: Math.random() * 0.35 + 0.85,
        });
      }

      ski.nextSpawnZ += 4.6 + Math.random() * 2.8;
    }
  }

  function emitSnow(x, y, z, count, color = '#ffffff') {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 7,
        vy: 1.5 + Math.random() * 4.5,
        vz: (Math.random() - 0.5) * 4,
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  // True 3D perspective projection pitched downhill with the mountain slope
  function project(wx, wy, wz, width, height) {
    const relZ = wz - ski.z;
    if (relZ < 0.5 || relZ > FAR_Z + 8) return null;

    const horizonY = height * 0.32;
    const focal = Math.min(width, height) * 0.95;
    const persp = focal / relZ;

    const relY = wy - ski.camY - relZ * ski.camPitch;
    const screenX = width * 0.5 + (wx - ski.camX) * persp * 0.085;
    const screenY = horizonY + (relZ * 0.08 - relY * 0.95) * persp * 0.22;

    return { x: screenX, y: screenY, persp: persp / 240, relZ };
  }

  function update(dt, keys, jumpOnce, callbacks) {
    if (ski.invulnTimer > 0) ski.invulnTimer -= dt;
    if (ski.boostTimer > 0) ski.boostTimer -= dt;

    const skierWorldZ = ski.z + SKIER_Z_OFFSET;
    const slopeZ = getHillSlopeZ(ski.x, skierWorldZ);

    // Forward speed control (tuck / brake + natural downhill acceleration)
    const targetSpeed = ski.boostTimer > 0
      ? 36
      : keys.tuck
        ? 29
        : keys.brake
          ? 12
          : 20 + Math.min(8, ski.distance / 450) - slopeZ * 4.5;

    ski.vz += (targetSpeed - ski.vz) * Math.min(1, dt * 3.8);

    // Freeform lateral carving
    const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const maxLatSpeed = 16;
    const latAccel = 44;

    if (steerInput !== 0) {
      ski.vx += steerInput * latAccel * dt;
      ski.vx = Math.max(-maxLatSpeed, Math.min(maxLatSpeed, ski.vx));
    } else {
      ski.vx *= Math.pow(0.04, dt);
    }

    ski.lean += (steerInput * 0.42 - ski.lean) * Math.min(1, dt * 10);

    // Jump
    if (jumpOnce && ski.onGround) {
      ski.vy = 10.2;
      ski.onGround = false;
      ski.trickDone = false;
      callbacks.playJump();
      emitSnow(ski.x, ski.y + 0.1, skierWorldZ, 10);
    }

    // Advance X and Z
    ski.x += ski.vx * dt;
    ski.z += ski.vz * dt;
    const nextWorldZ = ski.z + SKIER_Z_OFFSET;
    const groundY = getHillY(ski.x, nextWorldZ);

    if (ski.onGround) {
      // Check if cresting a hill fast enough to catch air naturally!
      const expectedY = ski.y + slopeZ * ski.vz * dt;
      if (expectedY - groundY > 0.22 && ski.vz > 21) {
        ski.onGround = false;
        ski.vy = Math.max(2.5, slopeZ * ski.vz * 0.75);
        ski.trickDone = false;
      } else {
        ski.y = groundY;
        ski.vy = 0;
        ski.spinAngle = 0;

        // Leave carved ski tracks on snow
        if (tracks.length === 0 || nextWorldZ - tracks[tracks.length - 1].z > 0.55) {
          tracks.push({ x: ski.x, z: nextWorldZ, y: groundY });
        }
        // Spray powder when carving hard
        if (Math.abs(ski.vx) > 5 && Math.random() < 0.65) {
          emitSnow(ski.x - Math.sign(ski.vx) * 0.4, groundY + 0.1, nextWorldZ, 1);
        }
      }
    } else {
      // Airborne physics
      ski.vy -= 25 * dt;
      ski.y += ski.vy * dt;

      if (steerInput !== 0) {
        ski.spinAngle += steerInput * 7.5 * dt;
        if (Math.abs(ski.spinAngle) >= Math.PI * 1.75 && !ski.trickDone) {
          ski.trickDone = true;
          ski.tricks += 1;
          ski.bonusScore += 50;
          callbacks.playFlip();
          callbacks.showBanner('360° Spin! +50 ❄️');
        }
      }

      if (ski.y <= groundY) {
        ski.y = groundY;
        ski.vy = 0;
        ski.onGround = true;
        ski.spinAngle = 0;
        if (callbacks.playLand) callbacks.playLand();
        emitSnow(ski.x, groundY + 0.1, nextWorldZ, 10);
      }
    }

    // Smooth camera follow in X, Y, and downhill pitch
    ski.camX += (ski.x - ski.camX) * Math.min(1, dt * 6.5);
    const targetCamY = Math.max(groundY, ski.y) + 2.3;
    ski.camY += (targetCamY - ski.camY) * Math.min(1, dt * 7.0);
    const targetPitch = Math.max(-0.55, Math.min(0.25, slopeZ * 0.65));
    ski.camPitch += (targetPitch - ski.camPitch) * Math.min(1, dt * 4.5);
    ski.scarfPhase += dt * (7 + ski.vz * 0.25);

    // Collisions with items near skier's Z
    for (const item of items) {
      if (item.hit) continue;
      if (Math.abs(item.z - nextWorldZ) > 1.2) continue;

      const dx = Math.abs(item.x - ski.x);
      const itemGroundY = getHillY(item.x, item.z);
      const heightAboveSnow = ski.y - itemGroundY;

      if (item.type === 'star') {
        if (dx < 1.6 && Math.abs(item.yOffset - heightAboveSnow) < 2.0) {
          item.hit = true;
          ski.stars += 1;
          ski.bonusScore += 15;
          callbacks.playStar();
          emitSnow(item.x, itemGroundY + item.yOffset, item.z, 8, '#ffd166');
        }
      } else if (item.type === 'ramp') {
        if (dx < 1.9 && heightAboveSnow < 0.9) {
          item.hit = true;
          ski.vy = 14.5;
          ski.y = itemGroundY + 0.35;
          ski.onGround = false;
          ski.trickDone = false;
          ski.tricks += 1;
          ski.bonusScore += 40;
          callbacks.playJump();
          callbacks.showBanner('Big Air Ramp! +40 ⛷️');
          emitSnow(item.x, itemGroundY + 0.2, item.z, 12, '#a8e6cf');
        }
      } else if (item.type === 'boost') {
        if (dx < 2.1 && heightAboveSnow < 1.6) {
          item.hit = true;
          ski.boostTimer = 2.2;
          ski.bonusScore += 25;
          callbacks.playBoost();
          callbacks.showBanner('Powder Boost! ⚡');
          emitSnow(item.x, itemGroundY + 0.3, item.z, 12, '#48cae4');
        }
      } else if (item.type === 'tree' || item.type === 'rock' || item.type === 'bush') {
        const hitRadius = item.type === 'tree' ? 1.1 : 1.0;
        const clearHeight = item.type === 'rock' ? 1.3 : 2.6;
        if (dx < hitRadius && heightAboveSnow < clearHeight && ski.invulnTimer <= 0) {
          item.hit = true;
          ski.hearts -= 1;
          ski.invulnTimer = 1.6;
          ski.vz = 10;
          callbacks.playBonk();
          emitSnow(ski.x, ski.y + 0.5, nextWorldZ, 16, '#ff6b6b');

          if (ski.hearts <= 0) {
            callbacks.triggerGameOver();
            return;
          }
          callbacks.showBanner('Bonk! Watch the trees! ❤️');
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 14 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Cull passed items & tracks, spawn ahead
    items = items.filter((it) => !it.hit && it.z > ski.z + 0.5);
    tracks = tracks.filter((tr) => tr.z > ski.z + 0.5);
    spawnAhead(ski.z + FAR_Z);

    ski.distance = Math.floor(ski.z * 2);
  }

  function render(ctx, width, height, time) {
    const horizonY = height * 0.28;

    // Alpine Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + 80);
    skyGrad.addColorStop(0, '#2b7de9');
    skyGrad.addColorStop(0.65, '#8ecae6');
    skyGrad.addColorStop(1, '#dff4fb');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun
    const sunX = width * 0.78;
    const sunY = horizonY * 0.42;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 85);
    sunGlow.addColorStop(0, 'rgba(255, 252, 220, 0.95)');
    sunGlow.addColorStop(1, 'rgba(255, 252, 220, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 85, 0, Math.PI * 2);
    ctx.fill();

    // Distant Snow-Capped Mountain Peaks
    for (let i = 0; i < mountains.length; i++) {
      const m = mountains[i];
      const mx = ((m.x * width - ski.camX * 2.5) % (width * 1.2) + width * 1.2) % (width * 1.2) - width * 0.1;
      const mw = m.w * width;
      const mh = m.h * height;

      ctx.fillStyle = i % 2 === 0 ? '#8fa6b5' : '#78909c';
      ctx.beginPath();
      ctx.moveTo(mx - mw, horizonY + 18);
      ctx.lineTo(mx, horizonY - mh);
      ctx.lineTo(mx + mw, horizonY + 18);
      ctx.closePath();
      ctx.fill();

      // Snow cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(mx - mw * 0.38, horizonY + 18 - (mh + 18) * 0.62);
      ctx.lineTo(mx, horizonY - mh);
      ctx.lineTo(mx + mw * 0.38, horizonY + 18 - (mh + 18) * 0.62);
      ctx.lineTo(mx + mw * 0.12, horizonY + 18 - (mh + 18) * 0.54);
      ctx.lineTo(mx - mw * 0.1, horizonY + 18 - (mh + 18) * 0.66);
      ctx.closePath();
      ctx.fill();
    }

    // Render 3D Slope Mesh far-to-near (so hills naturally occlude valleys behind them!)
    const dz = 3.0;
    const dx = 6.0;
    const zStart = Math.floor(ski.z / dz) * dz;
    const xMin = Math.floor((ski.camX - 66) / dx) * dx;
    const xMax = Math.ceil((ski.camX + 66) / dx) * dx;

    // Pre-build item buckets by Z strip for proper occlusion with hills
    const skierWorldZ = ski.z + SKIER_Z_OFFSET;

    for (let z = zStart + FAR_Z; z >= zStart + NEAR_Z; z -= dz) {
      const zFar = z + dz;
      const zNear = z;

      for (let x = xMin; x < xMax; x += dx) {
        const y00 = getHillY(x, zNear);
        const y10 = getHillY(x + dx, zNear);
        const y01 = getHillY(x, zFar);
        const y11 = getHillY(x + dx, zFar);

        const p00 = project(x, y00, zNear, width, height);
        const p10 = project(x + dx, y10, zNear, width, height);
        const p01 = project(x, y01, zFar, width, height);
        const p11 = project(x + dx, y11, zFar, width, height);

        if (!p00 || !p10 || !p01 || !p11) continue;
        if (p10.x < -40 || p00.x > width + 40) continue;

        // Shade snow quad by slope steepness, sun direction & alpine distance mist
        const slopeFwd = ((y01 + y11) - (y00 + y10)) * 0.5 / dz;
        const slopeSide = ((y10 + y11) - (y00 + y01)) * 0.5 / dx;
        const light = Math.max(0, Math.min(1, 0.7 - slopeFwd * 0.48 + slopeSide * 0.28));
        const fog = Math.max(0, Math.min(0.75, (zNear - ski.z - 22) / (FAR_Z - 22) * 0.75));
        const r = Math.round((200 + light * 55) * (1 - fog) + 228 * fog);
        const g = Math.round((224 + light * 31) * (1 - fog) + 244 * fog);
        const b = Math.round((245 + light * 10) * (1 - fog) + 252 * fog);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fill();

        // Subtle wind-swept snow line on near terrain
        if (zNear - ski.z < 26 && Math.round(z / dz) % 2 === 0) {
          ctx.strokeStyle = `rgba(175, 212, 238, ${0.22 * (1 - (zNear - ski.z) / 26)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.stroke();
        }
      }
    }

    // Carved Ski Tracks
    ctx.strokeStyle = 'rgba(130, 188, 235, 0.65)';
    ctx.lineWidth = 2.5;
    for (let i = 1; i < tracks.length; i++) {
      const a = project(tracks[i - 1].x, tracks[i - 1].y, tracks[i - 1].z, width, height);
      const b = project(tracks[i].x, tracks[i].y, tracks[i].z, width, height);
      if (!a || !b) continue;
      const offsetA = 8 * a.persp;
      const offsetB = 8 * b.persp;
      ctx.beginPath();
      ctx.moveTo(a.x - offsetA, a.y);
      ctx.lineTo(b.x - offsetB, b.y);
      ctx.moveTo(a.x + offsetA, a.y);
      ctx.lineTo(b.x + offsetB, b.y);
      ctx.stroke();
    }

    // Depth-sort items + skier (far to near)
    const drawList = [];
    for (const item of items) {
      const wy = getHillY(item.x, item.z) + item.yOffset;
      const p = project(item.x, wy, item.z, width, height);
      if (p) drawList.push({ kind: 'item', item, p });
    }
    const skierGroundY = getHillY(ski.x, skierWorldZ);
    const skierProj = project(ski.x, ski.y, skierWorldZ, width, height);
    const skierShadowProj = project(ski.x, skierGroundY, skierWorldZ, width, height);
    if (skierProj) {
      drawList.push({ kind: 'skier', p: skierProj, shadowP: skierShadowProj });
    }
    drawList.sort((a, b) => b.p.relZ - a.p.relZ);

    for (const entry of drawList) {
      if (entry.kind === 'item') {
        drawItem(ctx, entry.item, entry.p, time);
      } else {
        drawSkier(ctx, entry.p, entry.shadowP, Math.max(0, ski.y - skierGroundY));
      }
    }

    // 3D Snow Particles
    for (const pt of particles) {
      const p = project(pt.x, pt.y, pt.z, width, height);
      if (!p) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pt.size * p.persp, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Falling Snowflakes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const f of snowflakes) {
      const fx = ((f.x + Math.sin(time * 1.2 + f.drift) * 0.02) * width + width) % width;
      const fy = ((f.y + time * f.speed) % 1) * height;
      ctx.beginPath();
      ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawItem(ctx, item, p, time) {
    const s = p.persp * 1.35 * (item.pulse || 1);
    ctx.save();
    ctx.translate(p.x, p.y);

    if (item.type === 'tree') {
      ctx.fillStyle = 'rgba(100, 140, 175, 0.32)';
      ctx.beginPath();
      ctx.ellipse(2 * s, 1 * s, 28 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Textured Bark Trunk
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(-5 * s, -18 * s, 10 * s, 20 * s);
      ctx.fillStyle = '#4a3228';
      ctx.fillRect(0, -18 * s, 5 * s, 20 * s);

      // Layered Scalloped Pine Boughs with Snow
      const layers = [
        { y: -14, w: 34, h: 36, c: '#1b4332', c2: '#2d6a4f' },
        { y: -35, w: 27, h: 32, c: '#2d6a4f', c2: '#40916c' },
        { y: -54, w: 19, h: 27, c: '#40916c', c2: '#52b788' },
      ];
      for (const l of layers) {
        // Dark under-bough
        ctx.fillStyle = l.c;
        ctx.beginPath();
        ctx.moveTo(-l.w * s, l.y * s);
        ctx.quadraticCurveTo(-l.w * 0.4 * s, (l.y - l.h * 0.4) * s, 0, (l.y - l.h) * s);
        ctx.quadraticCurveTo(l.w * 0.4 * s, (l.y - l.h * 0.4) * s, l.w * s, l.y * s);
        ctx.quadraticCurveTo(0, (l.y + 6) * s, -l.w * s, l.y * s);
        ctx.fill();

        // Sunlit left foliage
        ctx.fillStyle = l.c2;
        ctx.beginPath();
        ctx.moveTo(-l.w * s, l.y * s);
        ctx.quadraticCurveTo(-l.w * 0.4 * s, (l.y - l.h * 0.4) * s, 0, (l.y - l.h) * s);
        ctx.lineTo(0, (l.y + 3) * s);
        ctx.closePath();
        ctx.fill();

        // Draped snow on boughs
        ctx.fillStyle = '#f8fdff';
        ctx.beginPath();
        ctx.moveTo(-l.w * 0.55 * s, (l.y - l.h * 0.48) * s);
        ctx.quadraticCurveTo(-l.w * 0.25 * s, (l.y - l.h * 0.72) * s, 0, (l.y - l.h) * s);
        ctx.quadraticCurveTo(l.w * 0.25 * s, (l.y - l.h * 0.72) * s, l.w * 0.52 * s, (l.y - l.h * 0.46) * s);
        ctx.quadraticCurveTo(l.w * 0.18 * s, (l.y - l.h * 0.38) * s, 0, (l.y - l.h * 0.52) * s);
        ctx.quadraticCurveTo(-l.w * 0.2 * s, (l.y - l.h * 0.36) * s, -l.w * 0.55 * s, (l.y - l.h * 0.48) * s);
        ctx.fill();
      }
    } else if (item.type === 'bush') {
      ctx.fillStyle = 'rgba(100, 140, 175, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 1 * s, 22 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      const puffs = [
        { x: -11, y: -8, r: 10, c: '#2d6a4f' },
        { x: 11, y: -7, r: 9, c: '#1b4332' },
        { x: 0, y: -12, r: 12, c: '#40916c' },
        { x: -3, y: -18, r: 7, c: '#f8fdff' },
        { x: 5, y: -15, r: 6, c: '#eef7fc' },
      ];
      for (const pf of puffs) {
        ctx.fillStyle = pf.c;
        ctx.beginPath();
        ctx.arc(pf.x * s, pf.y * s, pf.r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.type === 'rock') {
      ctx.fillStyle = 'rgba(100, 140, 175, 0.3)';
      ctx.beginPath();
      ctx.ellipse(2 * s, 1 * s, 24 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#5c707d';
      ctx.beginPath();
      ctx.moveTo(-22 * s, 0);
      ctx.lineTo(-12 * s, -22 * s);
      ctx.lineTo(8 * s, -26 * s);
      ctx.lineTo(22 * s, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#78909c';
      ctx.beginPath();
      ctx.moveTo(-22 * s, 0);
      ctx.lineTo(-12 * s, -22 * s);
      ctx.lineTo(2 * s, -15 * s);
      ctx.lineTo(-2 * s, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f5fbff';
      ctx.beginPath();
      ctx.moveTo(-12 * s, -22 * s);
      ctx.lineTo(8 * s, -26 * s);
      ctx.lineTo(4 * s, -14 * s);
      ctx.lineTo(-10 * s, -14 * s);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'ramp') {
      const rs = p.persp * 1.4;
      ctx.fillStyle = '#00b4d8';
      ctx.beginPath();
      ctx.moveTo(-34 * rs, 0);
      ctx.lineTo(-28 * rs, -24 * rs);
      ctx.lineTo(28 * rs, -24 * rs);
      ctx.lineTo(34 * rs, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-26 * rs, -24 * rs, 52 * rs, 6 * rs);
    } else if (item.type === 'boost') {
      const bs = p.persp * 1.4;
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = Math.max(2, 5 * bs);
      ctx.beginPath();
      ctx.arc(0, -28 * bs, 24 * bs, Math.PI, 0);
      ctx.stroke();

      ctx.fillStyle = 'rgba(72, 202, 228, 0.35)';
      ctx.beginPath();
      ctx.arc(0, -28 * bs, 22 * bs, Math.PI, 0);
      ctx.fill();
    } else if (item.type === 'star') {
      const ss = p.persp * 1.25;
      const bob = Math.sin(time * 5 + item.pulse) * 6 * ss;
      ctx.translate(0, -18 * ss + bob);

      ctx.fillStyle = 'rgba(255, 214, 70, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 22 * ss, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#f77f00';
      ctx.lineWidth = Math.max(1.5, 2 * ss);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 === 0 ? 15 : 7) * ss;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSkier(ctx, p, shadowP, heightAboveSnow) {
    if (ski.invulnTimer > 0 && Math.floor(ski.invulnTimer * 12) % 2 === 0) {
      return;
    }

    const s = p.persp * 1.45;

    if (shadowP) {
      ctx.fillStyle = 'rgba(100, 140, 180, 0.32)';
      const shadowScale = Math.max(0.45, 1 - heightAboveSnow * 0.12);
      ctx.beginPath();
      ctx.ellipse(shadowP.x, shadowP.y, 24 * s * shadowScale, 8 * s * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ski.lean + ski.spinAngle);

    // Carved Parabolic Skis with metallic edges & upturned tips
    const skiCol = ski.boostTimer > 0 ? '#ff006e' : '#e63946';
    for (const side of [-1, 1]) {
      const sx = side * 11 * s;
      ctx.fillStyle = '#ced4da';
      ctx.beginPath();
      ctx.roundRect(sx - 4.5 * s, -10 * s, 9 * s, 30 * s, 4 * s);
      ctx.fill();
      ctx.fillStyle = skiCol;
      ctx.beginPath();
      ctx.roundRect(sx - 3.5 * s, -9 * s, 7 * s, 28 * s, 3.5 * s);
      ctx.fill();
      // Ski Boot & Binding
      ctx.fillStyle = '#1d3557';
      ctx.beginPath();
      ctx.roundRect(sx - 4 * s, -5 * s, 8 * s, 11 * s, 2.5 * s);
      ctx.fill();
    }

    // Ski Legs (bent knees)
    ctx.strokeStyle = '#1d3557';
    ctx.lineWidth = Math.max(3, 7 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11 * s, -3 * s);
    ctx.lineTo(-9 * s, -16 * s);
    ctx.moveTo(11 * s, -3 * s);
    ctx.lineTo(9 * s, -16 * s);
    ctx.stroke();

    // Tapered Ski Poles with Snow Baskets
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = Math.max(2, 2.2 * s);
    ctx.beginPath();
    ctx.moveTo(-15 * s, -27 * s);
    ctx.lineTo(-24 * s, -3 * s);
    ctx.moveTo(15 * s, -27 * s);
    ctx.lineTo(24 * s, -3 * s);
    ctx.stroke();
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.arc(-23 * s, -5 * s, 3 * s, 0, Math.PI * 2);
    ctx.arc(23 * s, -5 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Puffy Ski Jacket (shaded)
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.roundRect(-12 * s, -39 * s, 24 * s, 24 * s, 8 * s);
    ctx.fill();
    ctx.fillStyle = '#e03152';
    ctx.beginPath();
    ctx.roundRect(0, -39 * s, 12 * s, 24 * s, [0, 8 * s, 8 * s, 0]);
    ctx.fill();

    // Flowing Scarf
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(3, 5 * s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -38 * s);
    ctx.quadraticCurveTo(
      Math.sin(ski.scarfPhase) * 14 * s,
      -47 * s,
      Math.cos(ski.scarfPhase * 1.3) * 18 * s,
      -53 * s
    );
    ctx.stroke();

    // Helmet & Goggles
    ctx.fillStyle = '#0096c7';
    ctx.beginPath();
    ctx.arc(0, -47 * s, 10.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#023e8a';
    ctx.fillRect(-9.5 * s, -49 * s, 19 * s, 4 * s);

    ctx.restore();
  }

  window.SkiMode = {
    reset,
    update,
    render,
    getStats() {
      return {
        stars: ski.stars,
        distance: ski.distance,
        hearts: ski.hearts,
        tricks: ski.tricks,
        score: ski.distance + ski.bonusScore,
        speed: ski.vz,
        steer: Math.abs(ski.vx),
        onGround: ski.onGround,
        boost: ski.boostTimer > 0,
      };
    },
  };
})();
