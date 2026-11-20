import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface RoomGeometry {
  id: string;
  name: string;
  type:
    | 'living'
    | 'bedroom'
    | 'kitchen'
    | 'bathroom'
    | 'dining'
    | 'hallway'
    | 'study'
    | 'storage'
    | 'balcony'
    | 'garage'
    | 'utility';
  floor: number;
  x: number; // meters from origin
  z: number; // meters from origin
  width: number; // meters
  depth: number; // meters
  height: number; // meters
  areaSqm: number;
  confidence: number; // 0..1
  needsReview: boolean;
  uncertainFields?: string[];
  wallColor: string;
  floorMaterial: string;
  ceilingStyle: string;
  tilePattern?: string;
  lightingWarmth?: 'warm' | 'neutral' | 'daylight';
  lightingIntensity?: number;
  doors: Array<{
    id: string;
    wall: 'north' | 'south' | 'east' | 'west';
    offset: number;
    width: number;
  }>;
  windows: Array<{
    id: string;
    wall: 'north' | 'south' | 'east' | 'west';
    offset: number;
    width: number;
    sillHeight: number;
    height: number;
  }>;
  furniture: Array<{
    id: string;
    item: string;
    label: string;
    x: number;
    z: number;
    rotationY: number;
    width: number;
    depth: number;
    height: number;
    color: string;
  }>;
  electrical: {
    lights: number;
    fans: number;
    sockets: number;
    switches: number;
    acPoints: number;
    circuitLoadKw: number;
  };
  plumbing: {
    coldOutlets: number;
    hotOutlets: number;
    drainPoints: number;
    fixtures: string[];
  };
}

export interface BlueprintAnalysisPayload {
  suggestedTitle?: string;
  architecturalStyle?: string;
  scaleNote: string;
  unit: 'm' | 'ft';
  overallWidthM: number;
  overallDepthM: number;
  floors: number;
  totalAreaSqm: number;
  averageConfidence: number;
  uncertainNotes: string[];
  rooms: RoomGeometry[];
  structuralNotes: string[];
  electricalSummary: {
    mainDbLocation: { x: number; z: number };
    circuits: Array<{
      id: string;
      name: string;
      breakerAmps: number;
      rooms: string[];
      estimatedWireM: number;
    }>;
  };
  plumbingSummary: {
    waterTankLocation: { x: number; z: number };
    mainRiserLocation: { x: number; z: number };
    supplyPipeM: number;
    hotWaterPipeM: number;
    drainagePipeM: number;
    valvesCount: number;
  };
}

export interface InteriorVersion {
  id: string;
  name: string;
  createdAt: string;
  roomOverrides: Record<
    string,
    {
      wallColor: string;
      floorMaterial: string;
      ceilingStyle: string;
      tilePattern?: string;
      lightingWarmth?: 'warm' | 'neutral' | 'daylight';
      lightingIntensity?: number;
      furniture: RoomGeometry['furniture'];
    }
  >;
}

export interface FuturePlanPayload {
  additions: Array<{
    id: string;
    type:
      | 'additional_bedroom'
      | 'living_expansion'
      | 'kitchen_expansion'
      | 'attached_bathroom'
      | 'balcony'
      | 'study_room'
      | 'home_office'
      | 'storage_room'
      | 'parking_space'
      | 'additional_floor';
    label: string;
    floor: number;
    areaSqm: number;
    estimatedCost: number;
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
  }>;
  structuralDisclaimer: string;
  updatedAt: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('user'),
  status: text('status').notNull().default('active'),
  emailVerified: boolean('email_verified').notNull().default(false),
  avatarUrl: text('avatar_url'),
  preferences: jsonb('preferences').$type<{
    unit: 'm' | 'ft';
    currency: string;
    region: string;
  }>(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location').notNull().default('Global Standard'),
  floorsCount: integer('floors_count').notNull().default(1),
  totalAreaSqm: doublePrecision('total_area_sqm').notNull().default(0),
  estimatedCost: doublePrecision('estimated_cost').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('draft'),
  blueprintFileName: text('blueprint_file_name'),
  blueprintFileUrl: text('blueprint_file_url'),
  blueprintMimeType: text('blueprint_mime_type'),
  blueprintStatus: text('blueprint_status').notNull().default('pending'),
  analysisData: jsonb('analysis_data').$type<BlueprintAnalysisPayload | null>(),
  interiorVersions: jsonb('interior_versions').$type<InteriorVersion[]>(),
  futurePlanData: jsonb('future_plan_data').$type<FuturePlanPayload | null>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const constructionMaterials = pgTable('construction_materials', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  region: text('region').notNull().default('Global Standard'),
  source: text('source').notNull().default('BUILDVISION Material Index'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const labourRates = pgTable('labour_rates', {
  id: serial('id').primaryKey(),
  trade: text('trade').notNull(),
  unit: text('unit').notNull().default('sqm'),
  ratePerUnit: doublePrecision('rate_per_unit').notNull(),
  region: text('region').notNull().default('Global Standard'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const regionalMultipliers = pgTable('regional_multipliers', {
  id: serial('id').primaryKey(),
  regionName: text('region_name').notNull().unique(),
  currency: text('currency').notNull().default('USD'),
  materialMultiplier: doublePrecision('material_multiplier').notNull().default(1.0),
  labourMultiplier: doublePrecision('labour_multiplier').notNull().default(1.0),
  priceSource: text('price_source').notNull().default('BUILDVISION Regional Cost Index'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull().default('project'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  notifications: many(notifications),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
