// @ts-nocheck
/**
 * MarketplaceAPI — Unified client for Construction Material Marketplace,
 * Dispatch Engine, Bargaining System, Multi-Trip Logistics, and Admin Control Tower.
 */
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

function apiUrl(path: string) {
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
    throw new Error(err.error || `API Error ${res.status}`);
  }
  return res.json();
}

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface QuarryMaterial {
  _id?: string;
  id?: string;
  quarryId: string;
  quarryName: string;
  materialName: string;
  basePrice: number;
  unitType: string;
  availableQty: number;
  moq: number;
  isAvailable: boolean;
  rating: number;
  reliabilityScore: number;
}

export interface Enquiry {
  _id?: string;
  id?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  materialName: string;
  quantity: number;
  unitType: string;
  deliveryDate: string;
  timeWindow: string;
  siteLocation: {
    lat: number;
    lng: number;
    address: string;
    landmark: string;
    contactPerson: string;
    contactPhone: string;
    deliveryInstructions: string;
    maxVehicleWeightTon: number;
  };
  status: 'open' | 'quoted' | 'negotiating' | 'accepted' | 'cancelled';
  createdAt: string;
}

export interface NegotiationStep {
  proposedBy: 'customer' | 'quarry';
  materialPrice: number;
  transportPrice: number;
  note: string;
  createdAt: string;
}

export interface Quote {
  _id?: string;
  id?: string;
  enquiryId: string;
  quarryId: string;
  quarryName: string;
  quarryAddress: string;
  materialPrice: number;
  transportPrice: number;
  platformFee: number;
  tax: number;
  totalPrice: number;
  estDeliveryHours: number;
  negotiationHistory: NegotiationStep[];
  status: 'pending' | 'countered' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Order {
  _id?: string;
  id?: string;
  enquiryId: string;
  quoteId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  quarryId: string;
  quarryName: string;
  materialName: string;
  totalQuantity: number;
  unitType: string;
  priceSnapshot: {
    materialPrice: number;
    transportPrice: number;
    platformFee: number;
    tax: number;
    totalAmount: number;
  };
  siteLocation: {
    lat: number;
    lng: number;
    address: string;
    landmark: string;
    contactPerson: string;
    contactPhone: string;
    deliveryInstructions: string;
  };
  totalTripsRequired: number;
  completedTrips: number;
  status: 'confirmed' | 'in_progress' | 'completed' | 'settled';
  createdAt: string;
}

export interface Trip {
  _id?: string;
  id?: string;
  orderId: string;
  tripNumber: number;
  loadQuantityTon: number;
  quarryId: string;
  quarryName: string;
  quarryAddress: string;
  quarryLat: number;
  quarryLng: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLat: number;
  customerLng: number;
  landmark: string;
  siteContact: string;
  instructions: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleNo: string;
  driverEarnings: number;
  distanceKm?: number;
  tripState:
    | 'UNASSIGNED'
    | 'OFFER_RECEIVED'
    | 'ACCEPTED'
    | 'GOING_TO_QUARRY'
    | 'ARRIVED_AT_QUARRY'
    | 'LOADING'
    | 'LOADED'
    | 'IN_TRANSIT'
    | 'ARRIVED_AT_SITE'
    | 'UNLOADING'
    | 'DELIVERED'
    | 'CANCELLED';
  proofOfDelivery?: {
    photoUri: string;
    weighbridgeSlipUri: string;
    vehiclePhotoUri: string;
    otp: string;
    customerSignature: string;
    timestamp: string;
  };
  createdAt: string;
}

// Helper: normalise MongoDB _id
function normalise<T>(item: any): T {
  if (!item) return item;
  return { ...item, id: item._id || item.id };
}

// ─── API Methods ─────────────────────────────────────────────────────────────

// 1. Materials Catalog
export async function getMaterials(): Promise<QuarryMaterial[]> {
  const data = await callAPI('/api/marketplace?action=get_materials');
  return (data.materials || []).map(normalise);
}

// 2. Enquiries & Quotes
export async function getEnquiries(customerId?: string): Promise<{ enquiries: Enquiry[]; quotes: Quote[] }> {
  const q = customerId ? `&customerId=${customerId}` : '';
  const data = await callAPI(`/api/marketplace?action=get_enquiries${q}`);
  return {
    enquiries: (data.enquiries || []).map(normalise),
    quotes: (data.quotes || []).map(normalise),
  };
}

export async function createEnquiry(payload: {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  materialName: string;
  quantity: number;
  unitType: string;
  deliveryDate?: string;
  timeWindow?: string;
  siteAddress: string;
  siteLat?: number;
  siteLng?: number;
  landmark?: string;
  contactPerson?: string;
  contactPhone?: string;
  instructions?: string;
  maxVehicleWeightTon?: number;
}): Promise<Enquiry> {
  const data = await callAPI('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_enquiry', ...payload }),
  });
  return normalise(data.enquiry);
}

// 3. Quotes & Bargaining
export async function submitQuote(payload: {
  enquiryId: string;
  quarryId?: string;
  quarryName?: string;
  materialPrice: number;
  transportPrice: number;
  estDeliveryHours?: number;
}): Promise<Quote> {
  const data = await callAPI('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify({ action: 'submit_quote', ...payload }),
  });
  return normalise(data.quote);
}

export async function counterQuote(payload: {
  quoteId: string;
  proposedBy: 'customer' | 'quarry';
  materialPrice: number;
  transportPrice: number;
  note?: string;
  userName?: string;
}): Promise<Quote> {
  const data = await callAPI('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify({ action: 'counter_quote', ...payload }),
  });
  return normalise(data.quote);
}

export async function acceptQuote(quoteId: string): Promise<{ order: Order; trips: Trip[] }> {
  const data = await callAPI('/api/marketplace', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept_quote', quoteId }),
  });
  return {
    order: normalise(data.order),
    trips: (data.trips || []).map(normalise),
  };
}

// 4. Orders & Multi-Trips
export async function getOrders(customerId?: string, quarryId?: string): Promise<{ orders: Order[]; trips: Trip[] }> {
  let param = '';
  if (quarryId) param = `&quarryId=${quarryId}`;
  else if (customerId) param = `&customerId=${customerId}`;
  const data = await callAPI(`/api/marketplace?action=get_orders${param}`);
  return {
    orders: (data.orders || []).map(normalise),
    trips: (data.trips || []).map(normalise),
  };
}

// 5. Driver Logistics & Delivery Radar
export async function getDriverRadar(driverId: string): Promise<Trip[]> {
  const data = await callAPI(`/api/marketplace?action=get_driver_radar&driverId=${driverId}`);
  return (data.trips || []).map(normalise);
}

export async function acceptTripOffer(tripId: string, driverId: string, driverInfo?: any): Promise<Trip> {
  const data = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'accept_trip_offer', tripId, driverId, ...driverInfo }),
  });
  return normalise(data.trip);
}

export async function updateTripState(tripId: string, nextState: string): Promise<Trip> {
  const data = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'update_trip_state', tripId, nextState }),
  });
  return normalise(data.trip);
}

export async function submitPoD(
  tripId: string,
  pod: {
    photoUri?: string;
    weighbridgeSlipUri?: string;
    vehiclePhotoUri?: string;
    otp?: string;
    customerSignature?: string;
    lat?: number;
    lng?: number;
  }
): Promise<{ trip: Trip; isOrderCompleted: boolean }> {
  const data = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'submit_pod', tripId, ...pod }),
  });
  return {
    trip: normalise(data.trip),
    isOrderCompleted: data.isOrderCompleted || false,
  };
}

export async function toggleDriverOnline(driverId: string, state: 'ONLINE' | 'OFFLINE'): Promise<string> {
  const data = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'toggle_driver_online', driverId, state }),
  });
  return data.state;
}

// 6. Admin Control Tower
export async function getAdminOverview(): Promise<{ stats: any; pendingDrivers: any[]; logs: any[] }> {
  const data = await callAPI('/api/marketplace?action=admin_overview');
  return {
    stats: data.stats || {},
    pendingDrivers: data.pendingDrivers || [],
    logs: data.logs || [],
  };
}

export async function verifyDriver(driverUserId: string, status: 'approved' | 'rejected'): Promise<any> {
  const data = await callAPI('/api/marketplace', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'verify_driver', driverUserId, status }),
  });
  return data.driver;
}

// ─── Pusher Real-Time Event Listener Helper ──────────────────────────────────
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
  onEnquiryCreated?: (data: any) => void;
  onQuoteReceived?: (data: any) => void;
  onNegotiationCountered?: (data: any) => void;
  onOrderCreated?: (data: any) => void;
  onTripAccepted?: (data: any) => void;
  onTripStateChanged?: (data: any) => void;
  onPoDSubmitted?: (data: any) => void;
}) {
  const channel = getPusherChannel();
  if (!channel) return () => {};

  if (callbacks.onEnquiryCreated) channel.bind('enquiry-created', callbacks.onEnquiryCreated);
  if (callbacks.onQuoteReceived) channel.bind('quote-received', callbacks.onQuoteReceived);
  if (callbacks.onNegotiationCountered) channel.bind('negotiation-countered', callbacks.onNegotiationCountered);
  if (callbacks.onOrderCreated) channel.bind('order-created', callbacks.onOrderCreated);
  if (callbacks.onTripAccepted) channel.bind('trip-accepted', callbacks.onTripAccepted);
  if (callbacks.onTripStateChanged) channel.bind('trip-state-changed', callbacks.onTripStateChanged);
  if (callbacks.onPoDSubmitted) channel.bind('pod-submitted', callbacks.onPoDSubmitted);

  return () => {
    if (callbacks.onEnquiryCreated) channel.unbind('enquiry-created', callbacks.onEnquiryCreated);
    if (callbacks.onQuoteReceived) channel.unbind('quote-received', callbacks.onQuoteReceived);
    if (callbacks.onNegotiationCountered) channel.unbind('negotiation-countered', callbacks.onNegotiationCountered);
    if (callbacks.onOrderCreated) channel.unbind('order-created', callbacks.onOrderCreated);
    if (callbacks.onTripAccepted) channel.unbind('trip-accepted', callbacks.onTripAccepted);
    if (callbacks.onTripStateChanged) channel.unbind('trip-state-changed', callbacks.onTripStateChanged);
    if (callbacks.onPoDSubmitted) channel.unbind('pod-submitted', callbacks.onPoDSubmitted);
  };
}
