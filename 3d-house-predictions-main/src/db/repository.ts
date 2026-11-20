import { count, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  appSettings,
  auditLogs,
  constructionMaterials,
  labourRates,
  notifications,
  projects,
  regionalMultipliers,
  users,
  type BlueprintAnalysisPayload,
  type FuturePlanPayload,
  type InteriorVersion,
} from './schema.ts';

const ADMIN_OWNER_EMAIL = 'mouleer5@gmail.com';

let seededPricingPromise: Promise<void> | null = null;

export async function ensureReferencePricingSeeded(): Promise<void> {
  if (seededPricingPromise) {
    return seededPricingPromise;
  }
  seededPricingPromise = (async () => {
    try {
      const [{ value: matCount }] = await db
        .select({ value: count() })
        .from(constructionMaterials);
      if (Number(matCount) === 0) {
        await db.insert(constructionMaterials).values([
          { name: 'Reinforced Concrete & Brick Masonry Shell', category: 'Structural', unit: 'sqm', unitPrice: 420, region: 'Global Standard', source: 'RSMeans Residential Index 2026' },
          { name: 'Engineered Structural Timber & Slab Deck', category: 'Structural', unit: 'sqm', unitPrice: 390, region: 'Global Standard', source: 'RSMeans Residential Index 2026' },
          { name: 'Architectural Standing Seam Roofing', category: 'Roofing', unit: 'sqm', unitPrice: 85, region: 'Global Standard', source: 'BUILDVISION Material Index' },
          { name: 'White Oak Engineered Hardwood Flooring', category: 'Flooring', unit: 'sqm', unitPrice: 78, region: 'Global Standard', source: 'BUILDVISION Material Index' },
          { name: 'Matte Rectified Porcelain Tile', category: 'Flooring', unit: 'sqm', unitPrice: 54, region: 'Global Standard', source: 'BUILDVISION Material Index' },
          { name: 'Low-VOC Mineral Architectural Paint', category: 'Wall Finish', unit: 'sqm', unitPrice: 24, region: 'Global Standard', source: 'BUILDVISION Material Index' },
          { name: 'Acoustic Gypsum & Recessed Ceiling System', category: 'Ceiling', unit: 'sqm', unitPrice: 34, region: 'Global Standard', source: 'BUILDVISION Material Index' },
          { name: 'Copper Wiring, Modular Switchgear & LED Fixtures', category: 'Electrical', unit: 'point', unitPrice: 58, region: 'Global Standard', source: 'NEC / IEC Estimator Index' },
          { name: 'PEX-A Supply, PVC DWV & Ceramic Sanitary Rough-in', category: 'Plumbing', unit: 'point', unitPrice: 115, region: 'Global Standard', source: 'IPC / Plumbing Index 2026' },
        ]);
      }

      const [{ value: labCount }] = await db.select({ value: count() }).from(labourRates);
      if (Number(labCount) === 0) {
        await db.insert(labourRates).values([
          { trade: 'Masonry & Concrete Works', unit: 'sqm', ratePerUnit: 210, region: 'Global Standard' },
          { trade: 'Carpentry & Structural Framing', unit: 'sqm', ratePerUnit: 95, region: 'Global Standard' },
          { trade: 'Interior Painting & Tiling', unit: 'sqm', ratePerUnit: 62, region: 'Global Standard' },
          { trade: 'Electrical Installation', unit: 'point', ratePerUnit: 42, region: 'Global Standard' },
          { trade: 'Plumbing & Piping', unit: 'point', ratePerUnit: 75, region: 'Global Standard' },
        ]);
      }

      const [{ value: regCount }] = await db
        .select({ value: count() })
        .from(regionalMultipliers);
      if (Number(regCount) === 0) {
        await db.insert(regionalMultipliers).values([
          { regionName: 'Global Standard', currency: 'USD', materialMultiplier: 1.0, labourMultiplier: 1.0, priceSource: 'BUILDVISION Global Baseline 2026' },
          { regionName: 'North America (Metro)', currency: 'USD', materialMultiplier: 1.24, labourMultiplier: 1.42, priceSource: 'RSMeans North America Q4 2026' },
          { regionName: 'Western Europe', currency: 'EUR', materialMultiplier: 1.18, labourMultiplier: 1.35, priceSource: 'EU Construction Cost Index 2026' },
          { regionName: 'Singapore & SEA Metro', currency: 'SGD', materialMultiplier: 1.12, labourMultiplier: 1.05, priceSource: 'BCA Singapore Tender Index 2026' },
          { regionName: 'India (Tier-1 Metro)', currency: 'INR', materialMultiplier: 0.42, labourMultiplier: 0.28, priceSource: 'CPWD / Regional Market Index 2026' },
        ]);
      }

      const [{ value: setCount }] = await db.select({ value: count() }).from(appSettings);
      if (Number(setCount) === 0) {
        await db.insert(appSettings).values([
          {
            key: 'platform_config',
            value: {
              defaultUnit: 'm',
              defaultRegion: 'Global Standard',
              maxUploadSizeMb: 15,
              aiConfidenceReviewThreshold: 0.82,
              maintenanceMode: false,
            },
          },
        ]);
      }
    } catch (error) {
      seededPricingPromise = null;
      console.error('Failed to seed reference pricing:', error);
      throw new Error('Failed to initialize pricing catalog.', { cause: error });
    }
  })();
  return seededPricingPromise;
}

export async function getOrCreateFirebaseUser(params: {
  uid: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}) {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, params.email.toLowerCase()));

    const isOwnerAdmin = params.email.toLowerCase() === ADMIN_OWNER_EMAIL;

    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({
          uid: params.uid,
          fullName: existing[0].fullName || params.fullName,
          avatarUrl: params.avatarUrl || existing[0].avatarUrl,
          emailVerified: params.emailVerified ?? existing[0].emailVerified,
          role: isOwnerAdmin ? 'admin' : existing[0].role,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, existing[0].id))
        .returning();
      return updated;
    }

    const [{ value: totalUsers }] = await db.select({ value: count() }).from(users);
    const assignedRole = isOwnerAdmin || Number(totalUsers) === 0 ? 'admin' : 'user';

    const [created] = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: params.email.toLowerCase(),
        fullName: params.fullName || params.email.split('@')[0],
        avatarUrl: params.avatarUrl,
        emailVerified: params.emailVerified ?? true,
        role: assignedRole,
        status: 'active',
        preferences: { unit: 'm', currency: 'USD', region: 'Global Standard' },
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: params.email.toLowerCase(),
          lastLoginAt: new Date(),
        },
      })
      .returning();

    await createNotification({
      userId: created.id,
      title: 'Welcome to BUILDVISION AI',
      message: 'Your architectural workspace is ready. Create a project or upload a floor plan blueprint to begin.',
      category: 'system',
    });

    return created;
  } catch (error) {
    console.error('Database error in getOrCreateFirebaseUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserById(id: number) {
  try {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row || null;
  } catch (error) {
    console.error('Database error in getUserById:', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  try {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return row || null;
  } catch (error) {
    console.error('Database error in getUserByEmail:', error);
    throw new Error('Failed to verify account email.', { cause: error });
  }
}

export async function createLocalUser(params: {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
}) {
  try {
    const [{ value: totalUsers }] = await db.select({ value: count() }).from(users);
    const isOwnerAdmin = params.email.toLowerCase() === ADMIN_OWNER_EMAIL;
    const role = isOwnerAdmin || Number(totalUsers) === 0 ? 'admin' : 'user';

    const [created] = await db
      .insert(users)
      .values({
        uid: params.uid,
        fullName: params.fullName,
        email: params.email.toLowerCase(),
        phone: params.phone || null,
        passwordHash: params.passwordHash,
        role,
        status: 'active',
        emailVerified: false,
        preferences: { unit: 'm', currency: 'USD', region: 'Global Standard' },
        lastLoginAt: new Date(),
      })
      .returning();

    await createNotification({
      userId: created.id,
      title: 'Account Created',
      message: 'Verify your email or start creating your first house planning project.',
      category: 'system',
    });

    return created;
  } catch (error) {
    console.error('Database error in createLocalUser:', error);
    throw new Error('Failed to create user account.', { cause: error });
  }
}

export async function updateUserProfile(
  userId: number,
  updates: Partial<{
    fullName: string;
    phone: string | null;
    emailVerified: boolean;
    passwordHash: string;
    lastLoginAt: Date;
    preferences: { unit: 'm' | 'ft'; currency: string; region: string };
  }>
) {
  try {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database error in updateUserProfile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function listUserProjects(userId: number) {
  try {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
  } catch (error) {
    console.error('Database error in listUserProjects:', error);
    throw new Error('Failed to load projects.', { cause: error });
  }
}

export async function getProjectById(projectId: number) {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    return project || null;
  } catch (error) {
    console.error('Database error in getProjectById:', error);
    throw new Error('Failed to load project.', { cause: error });
  }
}

export async function createProjectRecord(params: {
  userId: number;
  name: string;
  description?: string;
  location?: string;
  floorsCount?: number;
  currency?: string;
}) {
  try {
    const [created] = await db
      .insert(projects)
      .values({
        userId: params.userId,
        name: params.name,
        description: params.description || '',
        location: params.location || 'Global Standard',
        floorsCount: params.floorsCount || 1,
        currency: params.currency || 'USD',
        status: 'draft',
        blueprintStatus: 'pending',
        interiorVersions: [],
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error in createProjectRecord:', error);
    throw new Error('Failed to create project.', { cause: error });
  }
}

export async function updateProjectRecord(
  projectId: number,
  updates: Partial<{
    name: string;
    description: string;
    location: string;
    floorsCount: number;
    totalAreaSqm: number;
    estimatedCost: number;
    currency: string;
    status: string;
    blueprintFileName: string;
    blueprintFileUrl: string;
    blueprintMimeType: string;
    blueprintStatus: string;
    analysisData: BlueprintAnalysisPayload | null;
    interiorVersions: InteriorVersion[];
    futurePlanData: FuturePlanPayload | null;
  }>
) {
  try {
    const [updated] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    if (!updated) {
      throw new Error('Project record not found.');
    }
    return updated;
  } catch (error) {
    console.error('Database error in updateProjectRecord:', error);
    throw new Error('Failed to update project.', { cause: error });
  }
}

export async function deleteProjectRecord(projectId: number) {
  try {
    await db.delete(projects).where(eq(projects.id, projectId));
  } catch (error) {
    console.error('Database error in deleteProjectRecord:', error);
    throw new Error('Failed to delete project.', { cause: error });
  }
}

export async function getPricingCatalog() {
  await ensureReferencePricingSeeded();
  try {
    const [materials, labour, regions] = await Promise.all([
      db.select().from(constructionMaterials).orderBy(constructionMaterials.category, constructionMaterials.id),
      db.select().from(labourRates).orderBy(labourRates.id),
      db.select().from(regionalMultipliers).orderBy(regionalMultipliers.id),
    ]);
    return { materials, labour, regions };
  } catch (error) {
    console.error('Database error in getPricingCatalog:', error);
    throw new Error('Failed to load pricing database.', { cause: error });
  }
}

export async function listUserNotifications(userId: number) {
  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(25);
  } catch (error) {
    console.error('Database error in listUserNotifications:', error);
    throw new Error('Failed to load notifications.', { cause: error });
  }
}

export async function createNotification(params: {
  userId: number;
  title: string;
  message: string;
  category?: string;
}) {
  try {
    const [created] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        title: params.title,
        message: params.message,
        category: params.category || 'project',
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error in createNotification:', error);
  }
}

export async function markNotificationRead(userId: number, notificationId?: number) {
  try {
    if (notificationId) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId));
    } else {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
    }
  } catch (error) {
    console.error('Database error in markNotificationRead:', error);
    throw new Error('Failed to update notifications.', { cause: error });
  }
}

export async function recordAuditLog(params: {
  actorUserId?: number | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId ?? null,
      actorEmail: params.actorEmail,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId || null,
      details: params.details || null,
    });
  } catch (error) {
    console.error('Database error in recordAuditLog:', error);
  }
}

// ADMIN REPOSITORY FUNCTIONS
export async function getAdminOverviewStats() {
  await ensureReferencePricingSeeded();
  try {
    const [allUsers, allProjects, recentLogs] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(projects).orderBy(desc(projects.updatedAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20),
    ]);

    const activeUsers = allUsers.filter((u) => u.status === 'active').length;
    const blueprintUploads = allProjects.filter((p) => Boolean(p.blueprintFileUrl)).length;
    const completed3dModels = allProjects.filter(
      (p) => p.analysisData && (p.analysisData.rooms?.length || 0) > 0
    ).length;
    const processingJobs = allProjects.filter(
      (p) => p.blueprintStatus === 'analyzing'
    ).length;

    return {
      totalUsers: allUsers.length,
      activeUsers,
      totalProjects: allProjects.length,
      blueprintUploads,
      completed3dModels,
      processingJobs,
      systemStatus: 'Operational',
      recentLogs,
      projectStatusDistribution: [
        { status: 'Draft', count: allProjects.filter((p) => p.status === 'draft').length },
        { status: 'Analyzed', count: allProjects.filter((p) => p.status === 'analyzed').length },
        { status: '3D Modeled', count: allProjects.filter((p) => p.status === 'modeled_3d').length },
        { status: 'In Progress', count: allProjects.filter((p) => p.status === 'in_progress').length },
      ],
    };
  } catch (error) {
    console.error('Database error in getAdminOverviewStats:', error);
    throw new Error('Failed to load admin overview statistics.', { cause: error });
  }
}

export async function adminListUsers() {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(({ passwordHash: _ph, ...safe }) => safe);
  } catch (error) {
    console.error('Database error in adminListUsers:', error);
    throw new Error('Failed to load users list.', { cause: error });
  }
}

export async function adminUpdateUser(
  targetUserId: number,
  updates: Partial<{ role: string; status: string; emailVerified: boolean }>
) {
  try {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, targetUserId))
      .returning();
    if (!updated) return null;
    const { passwordHash: _ph, ...safe } = updated;
    return safe;
  } catch (error) {
    console.error('Database error in adminUpdateUser:', error);
    throw new Error('Failed to update user account.', { cause: error });
  }
}

export async function adminListProjects() {
  try {
    return await db
      .select({
        id: projects.id,
        name: projects.name,
        location: projects.location,
        floorsCount: projects.floorsCount,
        totalAreaSqm: projects.totalAreaSqm,
        estimatedCost: projects.estimatedCost,
        currency: projects.currency,
        status: projects.status,
        blueprintStatus: projects.blueprintStatus,
        blueprintFileName: projects.blueprintFileName,
        updatedAt: projects.updatedAt,
        createdAt: projects.createdAt,
        ownerName: users.fullName,
        ownerEmail: users.email,
      })
      .from(projects)
      .innerJoin(users, eq(projects.userId, users.id))
      .orderBy(desc(projects.updatedAt));
  } catch (error) {
    console.error('Database error in adminListProjects:', error);
    throw new Error('Failed to load projects for monitoring.', { cause: error });
  }
}

export async function adminUpsertMaterial(params: {
  id?: number;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  region: string;
  source: string;
}) {
  try {
    if (params.id) {
      const [updated] = await db
        .update(constructionMaterials)
        .set({
          name: params.name,
          category: params.category,
          unit: params.unit,
          unitPrice: params.unitPrice,
          region: params.region,
          source: params.source,
          updatedAt: new Date(),
        })
        .where(eq(constructionMaterials.id, params.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(constructionMaterials)
      .values({
        name: params.name,
        category: params.category,
        unit: params.unit,
        unitPrice: params.unitPrice,
        region: params.region,
        source: params.source,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error in adminUpsertMaterial:', error);
    throw new Error('Failed to save construction material.', { cause: error });
  }
}

export async function adminDeleteMaterial(id: number) {
  try {
    await db.delete(constructionMaterials).where(eq(constructionMaterials.id, id));
  } catch (error) {
    console.error('Database error in adminDeleteMaterial:', error);
    throw new Error('Failed to delete construction material.', { cause: error });
  }
}

export async function adminUpsertLabour(params: {
  id?: number;
  trade: string;
  unit: string;
  ratePerUnit: number;
  region: string;
}) {
  try {
    if (params.id) {
      const [updated] = await db
        .update(labourRates)
        .set({
          trade: params.trade,
          unit: params.unit,
          ratePerUnit: params.ratePerUnit,
          region: params.region,
          updatedAt: new Date(),
        })
        .where(eq(labourRates.id, params.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(labourRates)
      .values({
        trade: params.trade,
        unit: params.unit,
        ratePerUnit: params.ratePerUnit,
        region: params.region,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error in adminUpsertLabour:', error);
    throw new Error('Failed to save labour rate.', { cause: error });
  }
}

export async function adminDeleteLabour(id: number) {
  try {
    await db.delete(labourRates).where(eq(labourRates.id, id));
  } catch (error) {
    console.error('Database error in adminDeleteLabour:', error);
    throw new Error('Failed to delete labour rate.', { cause: error });
  }
}

export async function adminUpsertRegion(params: {
  id?: number;
  regionName: string;
  currency: string;
  materialMultiplier: number;
  labourMultiplier: number;
  priceSource: string;
}) {
  try {
    if (params.id) {
      const [updated] = await db
        .update(regionalMultipliers)
        .set({
          regionName: params.regionName,
          currency: params.currency,
          materialMultiplier: params.materialMultiplier,
          labourMultiplier: params.labourMultiplier,
          priceSource: params.priceSource,
          updatedAt: new Date(),
        })
        .where(eq(regionalMultipliers.id, params.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(regionalMultipliers)
      .values({
        regionName: params.regionName,
        currency: params.currency,
        materialMultiplier: params.materialMultiplier,
        labourMultiplier: params.labourMultiplier,
        priceSource: params.priceSource,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database error in adminUpsertRegion:', error);
    throw new Error('Failed to save regional multiplier.', { cause: error });
  }
}

export async function adminDeleteRegion(id: number) {
  try {
    await db.delete(regionalMultipliers).where(eq(regionalMultipliers.id, id));
  } catch (error) {
    console.error('Database error in adminDeleteRegion:', error);
    throw new Error('Failed to delete regional multiplier.', { cause: error });
  }
}

export async function adminListAuditLogs() {
  try {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  } catch (error) {
    console.error('Database error in adminListAuditLogs:', error);
    throw new Error('Failed to load audit logs.', { cause: error });
  }
}

export async function adminGetSettings() {
  await ensureReferencePricingSeeded();
  try {
    const rows = await db.select().from(appSettings);
    const configRow = rows.find((r) => r.key === 'platform_config');
    return configRow?.value || {};
  } catch (error) {
    console.error('Database error in adminGetSettings:', error);
    throw new Error('Failed to load application settings.', { cause: error });
  }
}

export async function adminUpdateSettings(value: Record<string, unknown>) {
  try {
    const [updated] = await db
      .insert(appSettings)
      .values({ key: 'platform_config', value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return updated.value;
  } catch (error) {
    console.error('Database error in adminUpdateSettings:', error);
    throw new Error('Failed to save application settings.', { cause: error });
  }
}
