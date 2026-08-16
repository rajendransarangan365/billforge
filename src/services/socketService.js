// Frontend Socket.io Client Service
// Manages real-time WebSockets for Live Tracking, Walkie-Talkie (PTT) & Voice Call Signaling

import { io } from 'socket.io-client';

const SERVER_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect(role = 'quarry_owner', userId = 'admin') {
    if (this.socket && this.connected) return;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Socket connected to server:', this.socket.id);
      this.connected = true;
      this.socket.emit('join-room', { role, userId });
    });

    this.socket.on('disconnect', () => {
      console.log('⚡ Socket disconnected');
      this.connected = false;
    });

    this.socket.on('error', (err) => {
      console.warn('⚡ Socket error:', err);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // ── Live GPS Tracking Events ──────────────────────────────────────────────
  emitLocationUpdate(driverData) {
    if (this.socket && this.connected) {
      this.socket.emit('location-update', driverData);
    }
  }

  onLocationUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('driver-location-changed', callback);
  }

  // ── Walkie-Talkie (PTT) Voice Events ──────────────────────────────────────
  emitPttStart(data) {
    if (this.socket && this.connected) {
      this.socket.emit('ptt-start', data);
    }
  }

  emitPttAudioChunk(data) {
    if (this.socket && this.connected) {
      this.socket.emit('ptt-audio-chunk', data);
    }
  }

  emitPttStop(data) {
    if (this.socket && this.connected) {
      this.socket.emit('ptt-stop', data);
    }
  }

  onPttStart(callback) {
    if (!this.socket) return;
    this.socket.on('ptt-active-start', callback);
  }

  onPttAudioChunk(callback) {
    if (!this.socket) return;
    this.socket.on('ptt-incoming-audio', callback);
  }

  onPttStop(callback) {
    if (!this.socket) return;
    this.socket.on('ptt-active-stop', callback);
  }

  // ── Voice Call Signaling ──────────────────────────────────────────────────
  emitCallSignal(signalData) {
    if (this.socket && this.connected) {
      this.socket.emit('call-signal', signalData);
    }
  }

  onCallSignal(callback) {
    if (!this.socket) return;
    this.socket.on('call-signal-received', callback);
  }
}

export const socketService = new SocketService();
