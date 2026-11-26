(() => {
  'use strict';

  const PREFIX = 'khusi-game-room-';
  let peer = null;
  let conn = null;
  let isHost = false;
  let connected = false;
  let localName = 'Player';
  let remoteName = 'Friend';
  let lastSendTime = 0;

  const remoteState = {
    active: false,
    x: 0,
    y: 0,
    z: 0,
    lean: 0,
    spinAngle: 0,
    boost: false,
    score: 0,
    distance: 0,
    hearts: 3,
    name: 'Friend',
    lastUpdate: 0,
  };

  let callbacks = {
    onRoomReady: () => {},
    onConnected: () => {},
    onStartGame: () => {},
    onDisconnected: () => {},
    onError: () => {},
  };

  function setCallbacks(cbs) {
    callbacks = { ...callbacks, ...cbs };
  }

  function cleanup() {
    connected = false;
    remoteState.active = false;
    if (conn) {
      try { conn.close(); } catch (_) {}
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (_) {}
      peer = null;
    }
  }

  function setupConnection(c) {
    conn = c;
    conn.on('open', () => {
      connected = true;
      conn.send({ type: 'hello', name: localName });
      callbacks.onConnected(isHost);
    });

    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;
      if (data.type === 'hello') {
        remoteName = data.name || 'Friend';
        remoteState.name = remoteName;
      } else if (data.type === 'start') {
        remoteName = data.name || remoteName;
        remoteState.name = remoteName;
        remoteState.active = true;
        callbacks.onStartGame(data.mode || 'atv');
      } else if (data.type === 'state') {
        remoteState.active = true;
        remoteState.x = data.x || 0;
        remoteState.y = data.y || 0;
        remoteState.z = data.z || 0;
        remoteState.lean = data.lean || 0;
        remoteState.spinAngle = data.spinAngle || 0;
        remoteState.boost = Boolean(data.boost);
        remoteState.score = data.score || 0;
        remoteState.distance = data.distance || 0;
        remoteState.hearts = data.hearts ?? 3;
        remoteState.lastUpdate = performance.now();
      }
    });

    conn.on('close', () => {
      connected = false;
      remoteState.active = false;
      callbacks.onDisconnected();
    });

    conn.on('error', (err) => {
      callbacks.onError(err?.message || 'Connection error');
    });
  }

  function createRoom(playerName) {
    cleanup();
    if (typeof window.Peer === 'undefined') {
      callbacks.onError('Multiplayer library still loading. Please try again in a second.');
      return;
    }
    isHost = true;
    localName = (playerName || 'Dad').trim() || 'Dad';
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const peerId = PREFIX + code;

    peer = new window.Peer(peerId);
    peer.on('open', () => {
      callbacks.onRoomReady(code);
    });
    peer.on('connection', (c) => {
      setupConnection(c);
    });
    peer.on('error', (err) => {
      callbacks.onError(err?.message || 'Could not create room');
    });
  }

  function joinRoom(code, playerName) {
    cleanup();
    if (typeof window.Peer === 'undefined') {
      callbacks.onError('Multiplayer library still loading. Please try again in a second.');
      return;
    }
    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      callbacks.onError('Please enter a 4-digit room code.');
      return;
    }
    isHost = false;
    localName = (playerName || 'Khusi').trim() || 'Khusi';

    peer = new window.Peer();
    peer.on('open', () => {
      const c = peer.connect(PREFIX + cleanCode, { reliable: false });
      setupConnection(c);
    });
    peer.on('error', (err) => {
      callbacks.onError(err?.message || 'Could not find that room');
    });
  }

  function sendStart(mode) {
    if (conn && connected) {
      remoteState.active = true;
      conn.send({ type: 'start', mode, name: localName });
    }
  }

  function sendState(payload) {
    if (!conn || !connected) return;
    const now = performance.now();
    if (now - lastSendTime < 40) return; // ~25Hz
    lastSendTime = now;
    try {
      conn.send({ type: 'state', ...payload });
    } catch (_) {}
  }

  function getRemotePlayer() {
    if (!connected || !remoteState.active) return null;
    if (performance.now() - remoteState.lastUpdate > 5000) return null;
    return remoteState;
  }

  window.Multiplayer = {
    setCallbacks,
    createRoom,
    joinRoom,
    sendStart,
    sendState,
    getRemotePlayer,
    cleanup,
    isConnected: () => connected,
    isHost: () => isHost,
    getRemoteName: () => remoteName,
  };
})();
