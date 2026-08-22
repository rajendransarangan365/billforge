/**
 * BillForge Core Domain Types & Interfaces
 */

export type UserRole = 'admin' | 'quarry_owner' | 'driver' | 'customer';

export interface User {
  id: string | number;
  name: string;
  phone: string;
  role: UserRole;
  email?: string;
  quarry_id?: number;
  vehicle_no?: string;
  company_name?: string;
}

export interface Quarry {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  email?: string;
  location?: string;
  status: 'active' | 'pending_approval' | 'suspended';
  lat?: number;
  lng?: number;
}

export interface Driver {
  id: number;
  name: string;
  phone: string;
  vehicle_no: string;
  status: 'Available' | 'On Trip' | 'Offline';
  category?: 'in_house' | 'private' | 'transport_agency';
  quarry_id?: number;
  per_km_rate?: number;
  lat?: number;
  lng?: number;
}

export interface CustomerEnquiry {
  id: string | number;
  quarry_id: number;
  customer_name: string;
  customer_phone: string;
  material_name: string;
  quantity: number;
  unit_type?: string;
  quoted_rate?: number;
  status: 'pending' | 'quoted' | 'accepted' | 'rejected';
  pickup_address?: string;
  customer_address?: string;
  delivery_lat?: number;
  delivery_lng?: number;
}

export interface DeliveryTrip {
  id: string | number;
  quarry_id: number;
  driver_id: number;
  driver_name: string;
  driver_phone?: string;
  vehicle_no?: string;
  customer_name: string;
  customer_phone?: string;
  material_name: string;
  quantity: number;
  status: 'submitted' | 'assigned' | 'loaded' | 'in_transit' | 'delivered';
  from_address?: string;
  to_address?: string;
  agreed_rate?: number;
  created_at?: string;
}
