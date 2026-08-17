// @ts-nocheck
/**
 * MarketplaceAPI — Unified API client for all marketplace operations.
 *
 * Uses the real /api/marketplace Vercel serverless endpoint (MongoDB) as the
 * source of truth. Real-time updates are received via Pusher.
 *
 * This replaces the localStorage-based MarketplaceStore for cross-device data sharing.
 */
import { Platform } from 'react-native';

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

function apiUrl(path: string) {
  // On web, use relative URLs so we don't need to hardcode the domain
  if (Platform.OS === 'web' && !BASE_URL) return path;
  return `${BASE_URL}${path}`;
}

async function callAPI(path: string, options?: RequestInit) {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface MarketplaceOrder {
  _id?: string;
  id?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  materialName: string;
  quantity: number;
  unitType: string;
  materialPrice: number;
  transportPrice: number;
  totalPrice: number;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleNo: string;
  quarryName: string;
  quarryAddress: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportBid {
  _id?: string;
  id?: string;
  orderId: string;
  driverId: string;
  driverName: string;
  vehicleNo: string;
  fareQuote: number;
  distanceKm: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// Normalise MongoDB _id to id for consistent use in screens
function normaliseOrder(o: any): MarketplaceOrder {
  return { ...o, id: o._id || o.id };
}
function normaliseBid(b: any): TransportBid {
  return { ...b, id: b._id || b.id };
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export async function getOrders(): Promise<{ orders: MarketplaceOrder[]; bids: TransportBid[] }> {
  const data = await callAPI('/api/marketplace');
  return {
    orders: (data.orders || []).map(normaliseOrder),
    bids: (data.bids || []).map(normaliseBid),
  };
}

export async function getOrderById(orderId: string): Promise<{ order: MarketplaceOrder; bids: TransportBid[] }> {
  const data = await callAPI(`/api/marketplace?orderId=${orderId}`);
  return {
    order: normaliseOrder(data.order),
    bids: (data.bids || []).map(normaliseBid),
  };
}

// ─── Customer Actions ─────────────────────────────────────────────────────────
export async function createOrder(data: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  materialName: string;
  quantity: number;
  unitType: string;
}): Promise<MarketplaceOrder> {
  const res = await callAPI('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_order', ...data }),
  });
  return normaliseOrder(res.order);
}

export async function agreeRate(orderId: string): Promise<MarketplaceOrder> {
  const res = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'agree_rate', orderId }),
  });
  return normaliseOrder(res.order);
}

// ─── Quarry Owner Actions ─────────────────────────────────────────────────────
export async function quoteRate(orderId: string, materialPrice: number): Promise<MarketplaceOrder> {
  const res = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'quote_rate', orderId, materialPrice }),
  });
  return normaliseOrder(res.order);
}

export async function acceptBid(orderId: string, bid: TransportBid): Promise<MarketplaceOrder> {
  const res = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'accept_bid',
      orderId,
      bidId: bid._id || bid.id,
      driverId: bid.driverId,
      driverName: bid.driverName,
      vehicleNo: bid.vehicleNo,
      transportPrice: bid.fareQuote,
    }),
  });
  return normaliseOrder(res.order);
}

export async function settleOrder(orderId: string): Promise<MarketplaceOrder> {
  const res = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'settle', orderId }),
  });
  return normaliseOrder(res.order);
}

// ─── Driver Actions ───────────────────────────────────────────────────────────
export async function submitBid(data: {
  orderId: string;
  driverId: string;
  driverName: string;
  vehicleNo: string;
  fareQuote: number;
  distanceKm: number;
}): Promise<TransportBid> {
  const res = await callAPI('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify({ action: 'submit_bid', ...data }),
  });
  return normaliseBid(res.bid);
}

export async function updateTripStatus(orderId: string, status: string): Promise<MarketplaceOrder> {
  const res = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'update_status', orderId, status }),
  });
  return normaliseOrder(res.order);
}

// ─── Pusher Real-Time Subscription ───────────────────────────────────────────
let pusherInstance: any = null;
let quarryChannel: any = null;

export function getPusherChannel() {
  if (quarryChannel) return quarryChannel;

  const key = process.env.EXPO_PUBLIC_PUSHER_KEY;
  const cluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER || 'ap2';

  if (!key || key === 'billforge_demo_key') return null;

  try {
    const Pusher = require('pusher-js');
    pusherInstance = new Pusher(key, { cluster, forceTLS: true });
    quarryChannel = pusherInstance.subscribe('quarry-live');
    return quarryChannel;
  } catch (e) {
    console.warn('Pusher init error:', e);
    return null;
  }
}

export function subscribeToMarketplace(callbacks: {
  onOrderCreated?: (data: any) => void;
  onOrderUpdated?: (data: any) => void;
  onBidSubmitted?: (data: any) => void;
  onDriverAssigned?: (data: any) => void;
}) {
  const channel = getPusherChannel();
  if (!channel) return () => {};

  if (callbacks.onOrderCreated)   channel.bind('order-created',   callbacks.onOrderCreated);
  if (callbacks.onOrderUpdated)   channel.bind('order-updated',   callbacks.onOrderUpdated);
  if (callbacks.onBidSubmitted)   channel.bind('bid-submitted',   callbacks.onBidSubmitted);
  if (callbacks.onDriverAssigned) channel.bind('driver-assigned', callbacks.onDriverAssigned);

  // Return cleanup function
  return () => {
    if (callbacks.onOrderCreated)   channel.unbind('order-created',   callbacks.onOrderCreated);
    if (callbacks.onOrderUpdated)   channel.unbind('order-updated',   callbacks.onOrderUpdated);
    if (callbacks.onBidSubmitted)   channel.unbind('bid-submitted',   callbacks.onBidSubmitted);
    if (callbacks.onDriverAssigned) channel.unbind('driver-assigned', callbacks.onDriverAssigned);
  };
}
