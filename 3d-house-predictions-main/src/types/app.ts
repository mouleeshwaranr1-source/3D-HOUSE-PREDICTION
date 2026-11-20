import type {
  BlueprintAnalysisPayload,
  FuturePlanPayload,
  InteriorVersion,
  RoomGeometry,
} from '../db/schema.ts';
import type {
  CostBreakdownResult,
  LabourCatalogItem,
  MaterialCatalogItem,
  RegionMultiplierItem,
} from '../lib/costEngine.ts';

export type {
  BlueprintAnalysisPayload,
  CostBreakdownResult,
  FuturePlanPayload,
  InteriorVersion,
  LabourCatalogItem,
  MaterialCatalogItem,
  RegionMultiplierItem,
  RoomGeometry,
};

export interface UserProfile {
  id: number;
  uid: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'user' | 'admin' | string;
  status: 'active' | 'suspended' | string;
  emailVerified: boolean;
  avatarUrl: string | null;
  preferences: {
    unit: 'm' | 'ft';
    currency: string;
    region: string;
  } | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface ProjectRecord {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  location: string;
  floorsCount: number;
  totalAreaSqm: number;
  estimatedCost: number;
  currency: string;
  status: string;
  blueprintFileName: string | null;
  blueprintFileUrl: string | null;
  blueprintMimeType: string | null;
  blueprintStatus: string;
  analysisData: BlueprintAnalysisPayload | null;
  interiorVersions: InteriorVersion[] | null;
  futurePlanData: FuturePlanPayload | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

export type UserModuleKey =
  | 'dashboard'
  | 'projects'
  | 'upload_blueprint'
  | 'blueprint_analysis'
  | 'studio_3d'
  | 'room_explorer'
  | 'structural_view'
  | 'electrical_layout'
  | 'plumbing_layout'
  | 'interior_design'
  | 'construction_cost'
  | 'cost_analytics'
  | 'future_planning'
  | 'budget_optimizer'
  | 'ai_assistant'
  | 'reports_exports'
  | 'settings';

export type AdminModuleKey =
  | 'admin_overview'
  | 'admin_users'
  | 'admin_registered_accounts'
  | 'admin_project_monitoring'
  | 'admin_blueprint_processing'
  | 'admin_materials'
  | 'admin_labour'
  | 'admin_regions'
  | 'admin_cost_estimation'
  | 'admin_reports'
  | 'admin_settings'
  | 'admin_audit_logs';

export type ActiveRoute = UserModuleKey | AdminModuleKey;

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0).toLocaleString()}`;
  }
}

export function formatDimension(meters: number, unit: 'm' | 'ft' = 'm'): string {
  if (unit === 'ft') {
    return `${(meters * 3.28084).toFixed(1)} ft`;
  }
  return `${meters.toFixed(2)} m`;
}

export function formatArea(sqm: number, unit: 'm' | 'ft' = 'm'): string {
  if (unit === 'ft') {
    return `${Math.round(sqm * 10.7639).toLocaleString()} sq ft`;
  }
  return `${sqm.toFixed(1)} m²`;
}
