// Production Real-Time Client Service using Pusher Channels & WebSockets
import Pusher from 'pusher-js';

const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_KEY || 'billforge_demo_key';
const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER || 'ap2';

class RealtimeService {
  constructor() {
    this.pusher = null;
    this.channel = null;
    this.eventListeners = new Map();
  }

  init() {
    if (this.pusher) return;

    try {
      this.pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        forceTLS: true,
      });

      this.channel = this.pusher.subscribe('quarry-live');

      this.channel.bind('pusher:subscription_succeeded', () => {
        console.log('⚡ Connected to Pusher Real-Time Channel: quarry-live');
      });

      // Bind all registered listeners
      this.eventListeners.forEach((callback, eventName) => {
        this.channel.bind(eventName, callback);
      });
    } catch (e) {
      console.warn('Real-Time init error:', e);
    }
  }

  // Subscribe to real-time events
  on(eventName, callback) {
    this.init();
    this.eventListeners.set(eventName, callback);
    if (this.channel) {
      this.channel.bind(eventName, callback);
    }
  }

  // Unsubscribe from real-time events
  off(eventName) {
    if (this.channel) {
      this.channel.unbind(eventName);
    }
    this.eventListeners.delete(eventName);
  }

  // Fallback direct event emission helper
  triggerClientEvent(eventName, data) {
    const callback = this.eventListeners.get(eventName);
    if (callback) {
      callback(data);
    }
  }
}

export const realtimeService = new RealtimeService();
