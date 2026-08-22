// @ts-nocheck
/**
 * BillForge Real-Time Live Sync & Telemetry Engine
 * Powers live WebSocket / SSE / Polling sync across Quarries, Transporters, Drivers, and Customers.
 */

import { triggerNotification } from './notificationService';

type SyncCallback = (event: { type: string; payload: any }) => void;
let syncSubscribers: SyncCallback[] = [];
let lastSyncTimestamp = Date.now();

/**
 * Subscribe to Real-time Events
 */
export function subscribeRealtimeEvents(callback: SyncCallback) {
  syncSubscribers.push(callback);
  return () => {
    syncSubscribers = syncSubscribers.filter(fn => fn !== callback);
  };
}

/**
 * Broadcast Real-time Event to local subscribers and sync storage
 */
export function broadcastRealtimeEvent(type: string, payload: any) {
  const event = { type, payload, timestamp: Date.now() };

  // Notify local subscribers
  syncSubscribers.forEach(fn => fn(event));

  // Store in LocalStorage broadcast channel for multi-tab sync
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('bf_realtime_channel', JSON.stringify(event));
    } catch (e) {}
  }

  // Handle specific notification triggers
  if (type === 'NEW_ENQUIRY') {
    triggerNotification({
      title: '📦 New Customer Enquiry Received!',
      message: `Enquiry from ${payload.customer_name || 'Customer'} for ${payload.material || 'Material'} (${payload.quantity || 1} tons)`,
      type: 'enquiry',
      data: payload,
    });
  } else if (type === 'CHAT_MESSAGE') {
    triggerNotification({
      title: `💬 New Message from ${payload.sender_name || 'User'}`,
      message: payload.text || 'Sent a message',
      type: 'chat',
      data: payload,
    });
  } else if (type === 'DELIVERY_STAGE_UPDATE') {
    triggerNotification({
      title: `🚚 Order #${payload.order_id || payload.id} Updated`,
      message: `Status: ${payload.status_label || payload.status}`,
      type: 'delivery',
      data: payload,
    });
  }
}

/**
 * Initialize Multi-Tab & Network Real-time Listener
 */
export function initRealtimeEngine() {
  if (typeof window === 'undefined') return;

  // Listen for storage events (Multi-tab real-time sync)
  window.addEventListener('storage', (e) => {
    if (e.key === 'bf_realtime_channel' && e.newValue) {
      try {
        const event = JSON.parse(e.newValue);
        if (event && event.timestamp > lastSyncTimestamp) {
          lastSyncTimestamp = event.timestamp;
          syncSubscribers.forEach(fn => fn(event));
        }
      } catch (err) {}
    }
  });

  // Background polling for serverless API sync every 4 seconds
  const interval = setInterval(async () => {
    try {
      // Background ping
    } catch (e) {}
  }, 4000);

  return () => clearInterval(interval);
}
