// @ts-nocheck
import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_URL || 'https://billforge-lovat.vercel.app');

export async function getWhatsAppStatus(quarryId = 1) {
  try {
    const res = await fetch(`${API_BASE}/api/whatsapp?action=status&quarryId=${quarryId}`);
    if (!res.ok) return { success: false, connected: false };
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch WhatsApp status:', err);
    return { success: false, connected: false };
  }
}

export async function requestBaileysPairingCode(quarryId = 1, phone = '') {
  try {
    const res = await fetch(`${API_BASE}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request_pairing_code',
        quarryId,
        phone,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Request pairing code error:', err);
    return { success: false, error: err.message };
  }
}

export async function disconnectWhatsAppSession(quarryId = 1) {
  try {
    const res = await fetch(`${API_BASE}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'disconnect',
        quarryId,
      }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendDirectWhatsAppMessage({
  quarryId = 1,
  to,
  message,
  billNumber,
  totalAmount,
  customerName,
  documentUrl,
}) {
  try {
    const res = await fetch(`${API_BASE}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_message',
        quarryId,
        to,
        message,
        billNumber,
        totalAmount,
        customerName,
        documentUrl,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Direct WhatsApp message send error:', err);
    return { success: false, error: err.message };
  }
}

export function generateWhatsAppDocumentShareUrl(phone, message, documentUrl = null) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  
  let fullMessage = message;
  if (documentUrl) {
    fullMessage += `\n\n📄 View / Download Invoice Document:\n${documentUrl}`;
  }

  const encodedMsg = encodeURIComponent(fullMessage);

  if (Platform.OS === 'web') {
    return `https://wa.me/${formattedPhone || ''}?text=${encodedMsg}`;
  }
  return `whatsapp://send?phone=${formattedPhone || ''}&text=${encodedMsg}`;
}
