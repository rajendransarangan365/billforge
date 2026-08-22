// @ts-nocheck
/**
 * BillForge Real-Time Web & Audio Notification Service
 * Delivers browser push notifications, sound alerts, and toast banners for Enquiries, Chats, and Deliveries.
 */

let listeners: ((notification: any) => void)[] = [];

/**
 * Request Web Push Notification Permission
 */
export async function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        console.log('[NotificationService] Web Push Permission:', permission);
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
    } catch (e) {
      console.warn('[NotificationService] Permission error:', e);
    }
  }
  return false;
}

/**
 * Play Audio Chime Notification
 */
export function playNotificationSound(type: 'enquiry' | 'chat' | 'delivery' = 'enquiry') {
  if (typeof window === 'undefined') return;
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    const frequency = type === 'enquiry' ? 587.33 : type === 'chat' ? 783.99 : 880; // D5, G5, A5
    osc.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    // Audio context fallback
  }
}

/**
 * Trigger Real-Time Notification (Web Push + In-App Toast + Audio)
 */
export function triggerNotification({
  title,
  message,
  type = 'enquiry',
  data = {},
}: {
  title: string;
  message: string;
  type?: 'enquiry' | 'chat' | 'delivery' | 'system';
  data?: any;
}) {
  const notifObj = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    title,
    message,
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  // 1. Play Sound
  playNotificationSound(type);

  // 2. Trigger Web Push Notification if window is in background
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: notifObj.id,
      });
    } catch (e) {}
  }

  // 3. Notify in-app listeners (Toasts)
  listeners.forEach(fn => fn(notifObj));
  return notifObj;
}

/**
 * Subscribe to In-App Toast Notifications
 */
export function subscribeNotifications(callback: (notification: any) => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(fn => fn !== callback);
  };
}
