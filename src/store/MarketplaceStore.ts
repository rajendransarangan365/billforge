// @ts-nocheck
/**
 * MarketplaceStore — Shared platform-safe data store (localStorage on web, AsyncStorage on native).
 * This is the SINGLE SOURCE OF TRUTH for all marketplace orders and bids.
 * Customer, Quarry Owner, and Driver all read/write from this store.
 */
import { Storage } from './PlatformStorage';

const ORDERS_KEY = 'bf_marketplace_orders';
const BIDS_KEY = 'bf_marketplace_bids';

// ─── Types ───────────────────────────────────────────────────────
export type OrderStatus =
  | 'requirement_posted'
  | 'rate_quoted'
  | 'rate_agreed'
  | 'bidding_active'
  | 'driver_assigned'
  | 'loaded'
  | 'in_transit'
  | 'delivered'
  | 'settled';

export interface MarketplaceOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLat: number;
  customerLng: number;
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
  driverLat: number;
  driverLng: number;
  quarryName: string;
  quarryAddress: string;
  quarryLat: number;
  quarryLng: number;
  status: OrderStatus;
  documents: Array<{ name: string; uri: string; uploadedBy: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface TransportBid {
  id: string;
  orderId: string;
  driverId: string;
  driverName: string;
  vehicleNo: string;
  fareQuote: number;
  distanceKm: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Orders ──────────────────────────────────────────────────────
export async function getOrders(): Promise<MarketplaceOrder[]> {
  try {
    const raw = await Storage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveOrders(orders: MarketplaceOrder[]): Promise<void> {
  try {
    await Storage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {}
}

export async function createOrder(data: Partial<MarketplaceOrder>): Promise<MarketplaceOrder> {
  const orders = await getOrders();
  const newOrder: MarketplaceOrder = {
    id: generateId(),
    customerName: data.customerName || 'Customer',
    customerPhone: data.customerPhone || '',
    customerAddress: data.customerAddress || 'Delivery Site',
    customerLat: data.customerLat || 11.0168,
    customerLng: data.customerLng || 76.9558,
    materialName: data.materialName || 'River Sand',
    quantity: data.quantity || 1,
    unitType: data.unitType || 'ton',
    materialPrice: 0,
    transportPrice: 0,
    totalPrice: 0,
    driverId: '',
    driverName: '',
    driverPhone: '',
    vehicleNo: '',
    driverLat: 11.0168,
    driverLng: 76.9558,
    quarryName: 'Coimbatore Quarry',
    quarryAddress: 'Karur Road, Quarry Yard',
    quarryLat: 10.9601,
    quarryLng: 78.0766,
    status: 'requirement_posted',
    documents: [],
    createdAt: now(),
    updatedAt: now(),
  };
  orders.unshift(newOrder);
  await saveOrders(orders);
  return newOrder;
}

export async function updateOrder(id: string, updates: Partial<MarketplaceOrder>): Promise<MarketplaceOrder | null> {
  const orders = await getOrders();
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...updates, updatedAt: now() };
  await saveOrders(orders);
  return orders[idx];
}

export async function getOrderById(id: string): Promise<MarketplaceOrder | null> {
  const orders = await getOrders();
  return orders.find(o => o.id === id) || null;
}

// ─── Bids ─────────────────────────────────────────────────────────
export async function getBids(): Promise<TransportBid[]> {
  try {
    const raw = await Storage.getItem(BIDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveBids(bids: TransportBid[]): Promise<void> {
  try {
    await Storage.setItem(BIDS_KEY, JSON.stringify(bids));
  } catch (e) {}
}

export async function createBid(data: Partial<TransportBid>): Promise<TransportBid> {
  const bids = await getBids();
  const newBid: TransportBid = {
    id: generateId(),
    orderId: data.orderId || '',
    driverId: data.driverId || '',
    driverName: data.driverName || 'Driver',
    vehicleNo: data.vehicleNo || 'TN 38 AB 1234',
    fareQuote: data.fareQuote || 0,
    distanceKm: data.distanceKm || 10,
    status: 'pending',
    createdAt: now(),
  };
  bids.unshift(newBid);
  await saveBids(bids);

  // Mark order as bidding_active
  const order = await getOrderById(data.orderId || '');
  if (order && order.status === 'rate_agreed') {
    await updateOrder(data.orderId || '', { status: 'bidding_active' });
  }

  return newBid;
}

export async function getBidsForOrder(orderId: string): Promise<TransportBid[]> {
  const bids = await getBids();
  return bids.filter(b => b.orderId === orderId);
}

export async function acceptBid(bidId: string, orderId: string): Promise<void> {
  const bids = await getBids();

  const acceptedBid = bids.find(b => b.id === bidId);
  if (!acceptedBid) return;

  const updatedBids = bids.map(b => {
    if (b.orderId === orderId) {
      return { ...b, status: b.id === bidId ? 'accepted' : 'rejected' };
    }
    return b;
  });
  await saveBids(updatedBids);

  await updateOrder(orderId, {
    driverId: acceptedBid.driverId,
    driverName: acceptedBid.driverName,
    vehicleNo: acceptedBid.vehicleNo,
    transportPrice: acceptedBid.fareQuote,
    status: 'driver_assigned',
  });
}

export async function clearAll(): Promise<void> {
  await Storage.removeItem(ORDERS_KEY);
  await Storage.removeItem(BIDS_KEY);
}
