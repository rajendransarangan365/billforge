// Notification Service — wraps expo-notifications for payment reminders
// Works on Android (local push notifications, fires even when app is closed)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[Notifications] Permission request failed:', e);
    return false;
  }
}

/**
 * Schedule a local push notification for a payment reminder.
 * @param {object} opts - { reminderId, customerName, amount, promisedDate, phone }
 * @returns {string|null} notificationId or null
 */
export async function schedulePaymentReminder({ reminderId, customerName, amount, promisedDate, phone }) {
  if (Platform.OS === 'web') return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn('[Notifications] Permission not granted.');
      return null;
    }

    const triggerDate = new Date(promisedDate);
    const now = new Date();

    // If date is in the past, fire immediately (after 2s)
    const trigger = triggerDate > now ? triggerDate : new Date(now.getTime() + 2000);

    const fmtAmount = amount > 0
      ? `₹${Number(amount).toLocaleString('en-IN')}`
      : 'payment';

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💰 Payment Due: ${customerName}`,
        body: `${customerName} promised ${fmtAmount} today. Tap to record payment or call them.`,
        data: { reminderId, customerName, phone, type: 'payment_reminder' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        color: '#DC2626',
      },
      trigger: { date: trigger },
    });

    console.log(`[Notifications] Scheduled reminder ${notifId} for ${customerName} at ${trigger}`);
    return notifId;
  } catch (e) {
    console.error('[Notifications] Failed to schedule:', e);
    return null;
  }
}

/**
 * Cancel a previously scheduled notification.
 */
export async function cancelPaymentReminder(notificationId) {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[Notifications] Cancelled notification ${notificationId}`);
  } catch (e) {
    console.warn('[Notifications] Failed to cancel:', e);
  }
}

/**
 * Set up a listener that handles tapped notifications.
 * Call this once at app root. Returns unsubscribe function.
 * @param {function} onReminderTapped - called with reminderId when user taps a payment reminder notification
 */
export function addNotificationTapListener(onReminderTapped) {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.type === 'payment_reminder' && data?.reminderId) {
      onReminderTapped(data.reminderId);
    }
  });
  return () => sub.remove();
}

/**
 * Get all pending scheduled notifications.
 */
export async function getPendingNotifications() {
  if (Platform.OS === 'web') return [];
  return await Notifications.getAllScheduledNotificationsAsync();
}

// Android notification channel setup (required for Android 8+)
export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('payment-reminders', {
    name: 'Payment Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#DC2626',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}
