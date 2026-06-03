export interface Resident {
  id: string;
  name: string;
  apartment: string;
  block: string;
  phone?: string;
  whatsapp?: string;
  password?: string;
  photoDataUrl?: string;
  registeredAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  deviceRegistered?: boolean;
  hikvisionSyncStatus?: Record<string, HikvisionFaceSyncStatus>;
  firstLogin: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role?: string;
  active: boolean;
  firstLogin: boolean;
}

export interface CommonArea {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  slots: string[];
  maxPerDayPerApt: number;
  active: boolean;
  createdAt: string;
}

export interface Reservation {
  id: string;
  apartment: string;
  block: string;
  residentId: string;
  residentName: string;
  amenity: string;
  date: string;
  timeSlot: string;
  notes?: string;
  createdAt: string;
}

export interface Package {
  id: string;
  apartment: string;
  block: string;
  recipientName: string;
  description: string;
  carrier?: string;
  receivedAt: string;
  status: 'pending' | 'delivered';
  deliveredAt?: string;
  deliveredTo?: string;
  employeeId?: string;
  receivedBy?: string;
}

export interface WhatsAppConfig {
  enabled: boolean;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  templateText: string;
}

export interface HikvisionDevice {
  id: string;
  name: string;
  deviceIp: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export interface HikvisionFaceSyncStatus {
  status: 'synced' | 'pending' | 'failed';
  syncedAt?: string;
  error?: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  serviceType: string;
  residentId: string;
  residentName: string;
  apartment: string;
  block: string;
  accessDuration: '7d' | '30d' | '90d' | '180d' | '365d';
  accessExpiry: string; // ISO date string
  registrationToken: string;
  tokenExpiry: string; // ISO date string (48h from creation)
  status: 'pending' | 'registered' | 'expired';
  photoDataUrl?: string;
  hikvisionSyncStatus?: Record<string, HikvisionFaceSyncStatus>;
  createdAt: string;
}
