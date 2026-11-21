(() => {
  'use strict';

  const FAR_Z = 82;
  const NEAR_Z = 2.0;
  const PLAYER_Z_OFFSET = 4.2;

  const atv = {
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    vx: 0,
    vz: 22,
    camX: 0,
    camY: 2.5,
    camPitch: 0,
    onGround: true,
    lean: 0,
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
    place: 1,
    finished: false,
  };

  let rivals = [];
  let items = [];
  let tracks = [];
  let particles = [];

  // Giant asymmetric sand dunes (steep slip-faces + sweeping crests!)
  function getDuneY(wx, wz) {
    const phase = wz * 0.055 + Math.sin(wx * 0.045) * 0.8;
    const primaryDune = (Math.sin(phase) + 0.38 * Math.sin(phase * 2)) * 8.5;
    const crossDune = Math.sin(wx * 0.075 + wz * 0.022) * 3.2;
    const megaWave = Math.cos(wz * 0.018) * 5.0;
    return primaryDune + crossDune + megaWave;
  }

  function getDuneSlopeZ(wx, wz) {
    const dz = 0.5;
    return (getDuneY(wx, wz + dz) - getDuneY(wx, wz - dz)) / (dz * 2);
  }

  function initRivals() {
    rivals = [
      { name: 'Sunny', color: '#3a86ff', helmet: '#ffd166', x: -5.5, z: 5, y: 0, baseSpeed: 25.0, phase: 0.4 },
      { name: 'Blaze', color: '#8338ec', helmet: '#ff006e', x: 5.5, z: 7, y: 0, baseSpeed: 26.5, phase: 1.9 },
      { name: 'Turbo', color: '#06d6a0', helmet: '#ffbe0b', x: 0.5, z: 9, y: 0, baseSpeed: 27.8, phase: 3.1 },
    ];
    for (const r of rivals) {
      r.y = getDuneY(r.x, r.z);
    }
  }

  function reset() {
    atv.x = 0;
    atv.z = 0;
    const startGround = getDuneY(0, PLAYER_Z_OFFSET);
    atv.y = startGround;
    atv.vy = 0;
    atv.vx = 0;
    atv.vz = 22;
    atv.camX = 0;
    atv.camY = startGround + 2.2;
    atv.camPitch = getDuneSlopeZ(0, PLAYER_Z_OFFSET) * 0.55;
    atv.onGround = true;
    atv.lean = 0;
    atv.spinAngle = 0;
    atv.trickDone = false;
    atv.invulnTimer = 0;
    atv.boostTimer = 0;
    atv.scarfPhase = 0;
    atv.nextSpawnZ = 16;
    atv.stars = 0;
    atv.tricks = 0;
    atv.hearts = 3;
    atv.bonusScore = 0;
    atv.distance = 0;
    atv.place = 4;
    atv.finished = false;

    items = [];
    tracks = [];
    particles = [];
    initRivals();
    spawnAhead(FAR_Z);
  }

  function spawnAhead(targetZ) {
    while (atv.nextSpawnZ < targetZ) {
      const z = atv.nextSpawnZ;
      const center = atv.x;
      const roll = Math.random();

      if (roll < 0.30) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const startX = center + (Math.random() - 0.5) * 16;
        for (let i = 0; i < 5; i++) {
          items.push({
            type: 'star',
            x: startX + dir * Math.sin(i * 0.7) * 3.8,
            z: z + i * 2.8,
            yOffset: 0.8,
            hit: false,
            pulse: i * 0.6,
          });
        }
      } else if (roll < 0.48) {
        const rx = center + (Math.random() - 0.5) * 16;
        items.push({ type: 'ramp', x: rx, z, yOffset: 0, hit: false, pulse: 0 });
        for (let i = 1; i <= 3; i++) {
          items.push({
            type: 'star',
            x: rx,
            z: z + i * 3.6,
            yOffset: 1.2 + Math.sin((i / 4) * Math.PI) * 2.8,
            hit: false,
            pulse: i * 0.5,
          });
        }
      } else if (roll < 0.62) {
        const bx = center + (Math.random() - 0.5) * 18;
        items.push({ type: 'boost', x: bx, z, yOffset: 0, hit: false, pulse: 0 });
      }

      const obstacleCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < obstacleCount; i++) {
        const ox = center + (Math.random() - 0.5) * 60;
        if (z < 24 && Math.abs(ox) < 4) continue;
        const tRoll = Math.random();
        const type = tRoll < 0.36 ? 'cactus' : tRoll < 0.62 ? 'bush' : tRoll < 0.84 ? 'rock' : 'palm';
        items.push({
          type,
          x: ox,
          z: z + Math.random() * 3,
          yOffset: 0,
          hit: false,
          pulse: Math.random() * 0.35 + 0.85,
        });
      }

      atv.nextSpawnZ += 4.8 + Math.random() * 2.8;
    }
  }

  function emitSand(x, y, z, count, color = '#f4c27a') {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 7,
        vy: 1.5 + Math.random() * 4.5,
        vz: (Math.random() - 0.5) * 4,
        life: 0.38 + Math.random() * 0.25,
        maxLife: 0.63,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  function project(wx, wy, wz, width, height) {
    const relZ = wz - atv.z;
    if (relZ < 0.5 || relZ > FAR_Z + 8) return null;

    const horizonY = height * 0.36;
    const focal = Math.min(width, height) * 0.95;
    const persp = focal / relZ;

    // Camera pitches with the dune slope so hills fill the view when climbing & drop away on crests!
    const relY = wy - atv.camY - relZ * atv.camPitch;
    const screenX = width * 0.5 + (wx - atv.camX) * persp * 0.085;
    const screenY = horizonY + (relZ * 0.08 - relY * 0.95) * persp * 0.22;

    return { x: screenX, y: screenY, persp: persp / 240, relZ };
  }

  function update(dt, keys, jumpOnce, callbacks, time) {
    if (atv.invulnTimer > 0) atv.invulnTimer -= dt;
    if (atv.boostTimer > 0) atv.boostTimer -= dt;

    const playerWorldZ = atv.z + PLAYER_Z_OFFSET;
    const slopeZ = getDuneSlopeZ(atv.x, playerWorldZ);

    // Gas / Brake / Boost speed + gravity along dune slope
    const targetSpeed = atv.boostTimer > 0
      ? 40
      : (keys.tuck || keys.gas)
        ? 32 - slopeZ * 6.0
        : keys.brake
          ? 12
          : 23 - slopeZ * 5.5;

    atv.vz += (Math.max(10, targetSpeed) - atv.vz) * Math.min(1, dt * 4.0);

    // Freeform steering left & right
    const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const maxLatSpeed = 18;
    const latAccel = 48;

    if (steerInput !== 0) {
      atv.vx += steerInput * latAccel * dt;
      atv.vx = Math.max(-maxLatSpeed, Math.min(maxLatSpeed, atv.vx));
    } else {
      atv.vx *= Math.pow(0.04, dt);
    }

    atv.lean += (steerInput * 0.42 - atv.lean) * Math.min(1, dt * 10);

    // Hop
    if (jumpOnce && atv.onGround) {
      atv.vy = 12.0 + Math.max(0, slopeZ * atv.vz * 0.35);
      atv.onGround = false;
      atv.trickDone = false;
      callbacks.playJump();
      emitSand(atv.x, atv.y + 0.1, playerWorldZ, 10);
    }

    atv.x += atv.vx * dt;
    atv.z += atv.vz * dt;
    const nextWorldZ = atv.z + PLAYER_Z_OFFSET;
    const groundY = getDuneY(atv.x, nextWorldZ);

    if (atv.onGround) {
      // Launch into Big Air naturally when cresting a giant dune!
      const expectedY = atv.y + slopeZ * atv.vz * dt;
      if (expectedY - groundY > 0.16 && atv.vz > 20) {
        atv.onGround = false;
        atv.vy = Math.max(3.5, slopeZ * atv.vz * 0.85);
        atv.trickDone = false;
      } else {
        atv.y = groundY;
        atv.vy = 0;
        atv.spinAngle = 0;

        if (tracks.length === 0 || nextWorldZ - tracks[tracks.length - 1].z > 0.55) {
          tracks.push({ x: atv.x, z: nextWorldZ, y: groundY });
        }
        if (Math.random() < 0.65) {
          const dustCol = atv.boostTimer > 0 ? '#ff9f1c' : '#e9b872';
          emitSand(atv.x, groundY + 0.1, nextWorldZ, 1, dustCol);
        }
      }
    } else {
      atv.vy -= 26 * dt;
      atv.y += atv.vy * dt;

      if (steerInput !== 0) {
        atv.spinAngle += steerInput * 7.5 * dt;
        if (Math.abs(atv.spinAngle) >= Math.PI * 1.75 && !atv.trickDone) {
          atv.trickDone = true;
          atv.tricks += 1;
          atv.bonusScore += 50;
          callbacks.playFlip();
          callbacks.showBanner('360° Dune Spin! +50 🛞');
        }
      }

      if (atv.y <= groundY) {
        atv.y = groundY;
        atv.vy = 0;
        atv.onGround = true;
        atv.spinAngle = 0;
        if (callbacks.playLand) callbacks.playLand();
        emitSand(atv.x, groundY + 0.1, nextWorldZ, 12);
      }
    }

    // Update Rival Racers (freeform desert buddies racing alongside you)
    let aheadCount = 0;
    for (const r of rivals) {
      const weave = Math.sin(time * 1.3 + r.phase) * 6.0;
      const targetX = atv.x * 0.65 + weave;
      r.x += (targetX - r.x) * Math.min(1, dt * 1.4);
      const diffZ = r.z - nextWorldZ;
      const rubber = diffZ > 24 ? -2.8 : diffZ < -18 ? 3.2 : 0;
      r.z += (r.baseSpeed + rubber) * dt;
      r.y = getDuneY(r.x, r.z);

      if (Math.random() < 0.28) {
        emitSand(r.x, r.y + 0.1, r.z, 1, '#e9b872');
      }
      if (r.z > nextWorldZ) aheadCount++;
    }
    atv.place = 1 + aheadCount;

    // Camera follows rider & pitches smoothly with dune slope
    atv.camX += (atv.x - atv.camX) * Math.min(1, dt * 6.5);
    const targetCamY = Math.max(groundY, atv.y) + 2.3;
    atv.camY += (targetCamY - atv.camY) * Math.min(1, dt * 7.0);
    const targetPitch = Math.max(-0.35, Math.min(0.35, slopeZ * 0.45));
    atv.camPitch += (targetPitch - atv.camPitch) * Math.min(1, dt * 4.5);
    atv.scarfPhase += dt * (7 + atv.vz * 0.25);

    // Item collisions
    for (const item of items) {
      if (item.hit) continue;
      if (Math.abs(item.z - nextWorldZ) > 1.2) continue;

      const dx = Math.abs(item.x - atv.x);
      const itemGroundY = getDuneY(item.x, item.z);
      const heightAbove = atv.y - itemGroundY;

      if (item.type === 'star') {
        if (dx < 1.8 && Math.abs(item.yOffset - heightAbove) < 2.2) {
          item.hit = true;
          atv.stars += 1;
          atv.bonusScore += 15;
          callbacks.playStar();
          emitSand(item.x, itemGroundY + item.yOffset, item.z, 8, '#ffd166');
        }
      } else if (item.type === 'ramp') {
        if (dx < 2.0 && heightAbove < 1.0) {
          item.hit = true;
          atv.vy = 16.0;
          atv.y = itemGroundY + 0.4;
          atv.onGround = false;
          atv.trickDone = false;
          atv.tricks += 1;
          atv.bonusScore += 40;
          callbacks.playJump();
          callbacks.showBanner('Dune Ramp! +40 🚀');
          emitSand(item.x, itemGroundY + 0.2, item.z, 12, '#ffd166');
        }
      } else if (item.type === 'boost') {
        if (dx < 2.2 && heightAbove < 1.5) {
          item.hit = true;
          atv.boostTimer = 2.2;
          atv.bonusScore += 25;
          callbacks.playBoost();
          callbacks.showBanner('Turbo Boost! ⚡');
          emitSand(item.x, itemGroundY + 0.3, item.z, 12, '#ff9f1c');
        }
      } else if (item.type === 'cactus' || item.type === 'rock' || item.type === 'palm' || item.type === 'bush') {
        const hitRadius = 1.1;
        const clearHeight = item.type === 'rock' ? 1.3 : 2.5;
        if (dx < hitRadius && heightAbove < clearHeight && atv.invulnTimer <= 0) {
          item.hit = true;
          atv.hearts -= 1;
          atv.invulnTimer = 1.6;
          atv.vz = 11;
          callbacks.playBonk();
          emitSand(atv.x, atv.y + 0.5, nextWorldZ, 16, '#ff6b6b');

          if (atv.hearts <= 0) {
            callbacks.triggerGameOver();
            return;
          }
          callbacks.showBanner('Bonk! Watch out! ❤️');
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 14 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    items = items.filter((it) => !it.hit && it.z > atv.z + 0.5);
    tracks = tracks.filter((tr) => tr.z > atv.z + 0.5);
    spawnAhead(atv.z + FAR_Z);

    atv.distance = Math.floor(atv.z * 2);
  }

  function render(ctx, width, height, time) {
    const horizonY = height * 0.36;

    // Warm Desert Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + 120);
    skyGrad.addColorStop(0, '#3a86ff');
    skyGrad.addColorStop(0.55, '#8ecae6');
    skyGrad.addColorStop(1, '#ffe5b4');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun
    const sunX = width * 0.8;
    const sunY = horizonY * 0.42;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 95);
    sunGlow.addColorStop(0, 'rgba(255, 245, 190, 0.95)');
    sunGlow.addColorStop(1, 'rgba(255, 210, 110, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 95, 0, Math.PI * 2);
    ctx.fill();

    // 3D Sand Dune Mesh (far-to-near with strong sunlit vs slip-face shading!)
    const dz = 2.8;
    const dx = 5.5;
    const zStart = Math.floor(atv.z / dz) * dz;
    const xMin = Math.floor((atv.camX - 66) / dx) * dx;
    const xMax = Math.ceil((atv.camX + 66) / dx) * dx;

    for (let z = zStart + FAR_Z; z >= zStart + NEAR_Z; z -= dz) {
      const zFar = z + dz;
      const zNear = z;

      for (let x = xMin; x < xMax; x += dx) {
        const y00 = getDuneY(x, zNear);
        const y10 = getDuneY(x + dx, zNear);
        const y01 = getDuneY(x, zFar);
        const y11 = getDuneY(x + dx, zFar);

        const p00 = project(x, y00, zNear, width, height);
        const p10 = project(x + dx, y10, zNear, width, height);
        const p01 = project(x, y01, zFar, width, height);
        const p11 = project(x + dx, y11, zFar, width, height);

        if (!p00 || !p10 || !p01 || !p11) continue;
        if (p10.x < -40 || p00.x > width + 40) continue;

        const slopeFwd = ((y01 + y11) - (y00 + y10)) * 0.5 / dz;
        const slopeSide = ((y10 + y11) - (y00 + y01)) * 0.5 / dx;
        const light = Math.max(0, Math.min(1, 0.55 - slopeFwd * 0.55 + slopeSide * 0.45));
        const fog = Math.max(0, Math.min(0.75, (zNear - atv.z - 22) / (FAR_Z - 22) * 0.75));
        const r = Math.round((188 + light * 67) * (1 - fog) + 248 * fog);
        const g = Math.round((110 + light * 108) * (1 - fog) + 216 * fog);
        const b = Math.round((45 + light * 80) * (1 - fog) + 170 * fog);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fill();

        // Wind-blown sand ripple lines on near dunes
        if (zNear - atv.z < 28 && Math.abs(Math.round(z / dz)) % 2 === 0) {
          ctx.strokeStyle = `rgba(165, 98, 42, ${0.14 * (1 - (zNear - atv.z) / 28)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.stroke();
        }
      }
    }

    // Tire Tracks
    ctx.strokeStyle = 'rgba(155, 88, 30, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 1; i < tracks.length; i++) {
      const a = project(tracks[i - 1].x, tracks[i - 1].y, tracks[i - 1].z, width, height);
      const b = project(tracks[i].x, tracks[i].y, tracks[i].z, width, height);
      if (!a || !b) continue;
      const oA = 10 * a.persp;
      const oB = 10 * b.persp;
      ctx.beginPath();
      ctx.moveTo(a.x - oA, a.y);
      ctx.lineTo(b.x - oB, b.y);
      ctx.moveTo(a.x + oA, a.y);
      ctx.lineTo(b.x + oB, b.y);
      ctx.stroke();
    }

    const drawList = [];
    for (const item of items) {
      const wy = getDuneY(item.x, item.z) + item.yOffset;
      const p = project(item.x, wy, item.z, width, height);
      if (p) drawList.push({ kind: 'item', item, p });
    }
    for (const r of rivals) {
      const p = project(r.x, r.y, r.z, width, height);
      if (p) drawList.push({ kind: 'rival', r, p });
    }
    const playerWorldZ = atv.z + PLAYER_Z_OFFSET;
    const playerGroundY = getDuneY(atv.x, playerWorldZ);
    const playerProj = project(atv.x, atv.y, playerWorldZ, width, height);
    const playerShadow = project(atv.x, playerGroundY, playerWorldZ, width, height);
    if (playerProj) {
      drawList.push({ kind: 'player', p: playerProj, shadowP: playerShadow, h: Math.max(0, atv.y - playerGroundY) });
    }

    drawList.sort((a, b) => b.p.relZ - a.p.relZ);

    for (const entry of drawList) {
      if (entry.kind === 'item') drawItem(ctx, entry.item, entry.p, time);
      else if (entry.kind === 'rival') drawATV3D(ctx, entry.p, null, 0, entry.r.color, entry.r.helmet, 0, 0, false, time);
      else drawATV3D(ctx, entry.p, entry.shadowP, entry.h, atv.boostTimer > 0 ? '#ff006e' : '#ff9f1c', '#ff5400', atv.lean, atv.spinAngle, true, time);
    }

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

    // Race Position Pill
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 66, 14, 132, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#2b1608';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const placeTxt = atv.place === 1 ? '1st' : atv.place === 2 ? '2nd' : atv.place === 3 ? '3rd' : '4th';
    ctx.fillText(`🏆 ${placeTxt} / 4`, width * 0.5, 36);
    ctx.restore();
  }

  function drawItem(ctx, item, p, time) {
    const s = p.persp * 1.35 * (item.pulse || 1);
    ctx.save();
    ctx.translate(p.x, p.y);

    if (item.type === 'cactus') {
      ctx.fillStyle = 'rgba(110, 65, 25, 0.28)';
      ctx.beginPath();
      ctx.ellipse(3 * s, 1 * s, 14 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38763d';
      ctx.beginPath();
      ctx.roundRect(-7 * s, -54 * s, 14 * s, 56 * s, 7 * s);
      ctx.roundRect(-22 * s, -40 * s, 18 * s, 10 * s, 5 * s);
      ctx.roundRect(-22 * s, -52 * s, 10 * s, 18 * s, 5 * s);
      ctx.roundRect(4 * s, -32 * s, 18 * s, 10 * s, 5 * s);
      ctx.roundRect(12 * s, -46 * s, 10 * s, 20 * s, 5 * s);
      ctx.fill();

      // Sunlit ribs
      ctx.fillStyle = '#5da45e';
      ctx.beginPath();
      ctx.roundRect(-4 * s, -52 * s, 5 * s, 52 * s, 3 * s);
      ctx.roundRect(-20 * s, -50 * s, 4 * s, 14 * s, 2 * s);
      ctx.roundRect(14 * s, -44 * s, 4 * s, 16 * s, 2 * s);
      ctx.fill();
    } else if (item.type === 'bush') {
      ctx.fillStyle = 'rgba(110, 65, 25, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 1 * s, 22 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      const puffs = [
        { x: -11, y: -8, r: 10, c: '#5c6b3c' },
        { x: 11, y: -7, r: 9, c: '#4d5b32' },
        { x: 0, y: -12, r: 12, c: '#6e7f48' },
        { x: -4, y: -15, r: 8, c: '#86985b' },
      ];
      for (const pf of puffs) {
        ctx.fillStyle = pf.c;
        ctx.beginPath();
        ctx.arc(pf.x * s, pf.y * s, pf.r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.type === 'rock') {
      ctx.fillStyle = 'rgba(110, 65, 25, 0.3)';
      ctx.beginPath();
      ctx.ellipse(2 * s, 1 * s, 24 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shaded base
      ctx.fillStyle = '#8b5e3c';
      ctx.beginPath();
      ctx.moveTo(-22 * s, 0);
      ctx.lineTo(-12 * s, -22 * s);
      ctx.lineTo(8 * s, -25 * s);
      ctx.lineTo(22 * s, 0);
      ctx.closePath();
      ctx.fill();

      // Sunlit facet
      ctx.fillStyle = '#b9865c';
      ctx.beginPath();
      ctx.moveTo(-22 * s, 0);
      ctx.lineTo(-12 * s, -22 * s);
      ctx.lineTo(3 * s, -15 * s);
      ctx.lineTo(-2 * s, 0);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'palm') {
      ctx.fillStyle = 'rgba(110, 65, 25, 0.25)';
      ctx.beginPath();
      ctx.ellipse(6 * s, 1 * s, 24 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#7f5539';
      ctx.lineWidth = Math.max(2, 8 * s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(9 * s, -38 * s, 2 * s, -72 * s);
      ctx.stroke();

      for (let a = -2; a <= 2; a++) {
        ctx.save();
        ctx.translate(2 * s, -72 * s);
        ctx.rotate(a * 0.58);
        ctx.fillStyle = a % 2 === 0 ? '#40916c' : '#2d6a4f';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(16 * s, -10 * s, 32 * s, 4 * s);
        ctx.quadraticCurveTo(15 * s, 2 * s, 0, 2 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (item.type === 'ramp') {
      const rs = p.persp * 1.4;
      ctx.fillStyle = '#ff5400';
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
      ctx.fillStyle = '#00bbf9';
      ctx.beginPath();
      ctx.roundRect(-26 * bs, -6 * bs, 52 * bs, 8 * bs, 4 * bs);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(10, Math.round(16 * bs))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡⚡', 0, -10 * bs);
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

  function drawATV3D(ctx, p, shadowP, heightAbove, bodyColor, helmetColor, lean, spinAngle, isPlayer, time) {
    if (isPlayer && atv.invulnTimer > 0 && Math.floor(atv.invulnTimer * 12) % 2 === 0) {
      return;
    }

    const s = p.persp * 1.45;
    if (shadowP) {
      ctx.fillStyle = 'rgba(130, 80, 30, 0.32)';
      const shadowScale = Math.max(0.45, 1 - heightAbove * 0.12);
      ctx.beginPath();
      ctx.ellipse(shadowP.x, shadowP.y, 28 * s * shadowScale, 9 * s * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(lean + spinAngle);

    const bounce = Math.sin(time * 22) * 1.1 * s;

    // Wide Knobby Off-Road Tires with Tread & Rims
    for (const side of [-1, 1]) {
      const tx = side * 21 * s;
      ctx.fillStyle = '#1d1e2c';
      ctx.beginPath();
      ctx.roundRect(tx - 7 * s, -19 * s, 14 * s, 20 * s, 4 * s);
      ctx.fill();
      // Tire tread ribs
      ctx.fillStyle = '#33364d';
      for (let t = -15; t <= -3; t += 4) {
        ctx.fillRect(tx - 6 * s, t * s, 12 * s, 2 * s);
      }
    }

    // Rear Suspension A-arms & Coil Shocks
    ctx.strokeStyle = '#8d99ae';
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.beginPath();
    ctx.moveTo(-19 * s, -10 * s);
    ctx.lineTo(-9 * s, -16 * s + bounce);
    ctx.moveTo(19 * s, -10 * s);
    ctx.lineTo(9 * s, -16 * s + bounce);
    ctx.stroke();

    // Dual Exhaust Pipes
    ctx.fillStyle = '#adb5bd';
    ctx.beginPath();
    ctx.roundRect(-13 * s, -14 * s + bounce, 5 * s, 6 * s, 2 * s);
    ctx.roundRect(8 * s, -14 * s + bounce, 5 * s, 6 * s, 2 * s);
    ctx.fill();

    // Buggy Rear Body & Fenders
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-18 * s, -14 * s + bounce);
    ctx.lineTo(-14 * s, -29 * s + bounce);
    ctx.lineTo(14 * s, -29 * s + bounce);
    ctx.lineTo(18 * s, -14 * s + bounce);
    ctx.closePath();
    ctx.fill();

    // Roll Cage Bars
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = Math.max(2, 3.2 * s);
    ctx.beginPath();
    ctx.moveTo(-13 * s, -28 * s + bounce);
    ctx.lineTo(-9 * s, -48 * s + bounce);
    ctx.lineTo(9 * s, -48 * s + bounce);
    ctx.lineTo(13 * s, -28 * s + bounce);
    ctx.stroke();

    // Brake / Tail Lights
    ctx.fillStyle = '#ff0033';
    ctx.beginPath();
    ctx.roundRect(-14 * s, -23 * s + bounce, 6 * s, 4 * s, 2 * s);
    ctx.roundRect(8 * s, -23 * s + bounce, 6 * s, 4 * s, 2 * s);
    ctx.fill();

    // Rider Torso & Arms
    ctx.fillStyle = '#219ebc';
    ctx.beginPath();
    ctx.roundRect(-9 * s, -45 * s + bounce, 18 * s, 18 * s, 6 * s);
    ctx.fill();

    if (isPlayer) {
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = Math.max(3, 5 * s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -44 * s + bounce);
      ctx.quadraticCurveTo(
        Math.sin(atv.scarfPhase) * 14 * s,
        -53 * s + bounce,
        Math.cos(atv.scarfPhase * 1.3) * 18 * s,
        -59 * s + bounce
      );
      ctx.stroke();
    }

    // Motocross Helmet & Goggles Strap
    ctx.fillStyle = helmetColor;
    ctx.beginPath();
    ctx.arc(0, -52 * s + bounce, 9.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(-8 * s, -54 * s + bounce, 16 * s, 3.5 * s);

    ctx.restore();
  }

  window.AtvRaceMode = {
    reset,
    update,
    render,
    getStats() {
      return {
        stars: atv.stars,
        distance: atv.distance,
        hearts: atv.hearts,
        tricks: atv.tricks,
        score: atv.distance + atv.bonusScore,
        speed: atv.vz,
        steer: Math.abs(atv.vx),
        onGround: atv.onGround,
        boost: atv.boostTimer > 0,
      };
    },
  };
})();
