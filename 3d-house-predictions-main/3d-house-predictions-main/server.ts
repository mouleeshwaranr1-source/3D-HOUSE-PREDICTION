import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import JSZip from 'jszip';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  adminDeleteLabour,
  adminDeleteMaterial,
  adminDeleteRegion,
  adminGetSettings,
  adminListAuditLogs,
  adminListProjects,
  adminListUsers,
  adminUpdateSettings,
  adminUpdateUser,
  adminUpsertLabour,
  adminUpsertMaterial,
  adminUpsertRegion,
  createLocalUser,
  createNotification,
  createProjectRecord,
  deleteProjectRecord,
  getAdminOverviewStats,
  getPricingCatalog,
  getProjectById,
  getUserByEmail,
  listUserNotifications,
  listUserProjects,
  markNotificationRead,
  recordAuditLog,
  updateProjectRecord,
  updateUserProfile,
} from './src/db/repository.ts';
import { calculateProjectCosts } from './src/lib/costEngine.ts';
import { analyzeBlueprintWithGemini, askHouseAssistant } from './src/lib/gemini.ts';
import {
  requireAdmin,
  requireAuth,
  sanitizeUser,
  signSessionToken,
  type AuthRequest,
} from './src/middleware/auth.ts';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: '20mb' }));

// Ensure uploads directory exists lazily
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMime = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported blueprint format. Upload PNG, JPG, WEBP, or PDF files.'));
    }
  },
});

// Password reset tokens in memory (short-lived)
const resetTokens = new Map<string, { email: string; code: string; expiresAt: number }>();

// ================= AUTHENTICATION ROUTES =================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password, phone, acceptedTerms } = req.body || {};
    if (!fullName || !email || !password) {
      res.status(400).json({ error: 'Full name, email, and password are required.' });
      return;
    }
    if (!acceptedTerms) {
      res.status(400).json({ error: 'You must accept the Terms and Conditions.' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const existing = await getUserByEmail(String(email));
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const uid = `bv_${crypto.randomUUID()}`;
    const user = await createLocalUser({
      uid,
      fullName: String(fullName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : undefined,
      passwordHash,
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: String(user.id),
      details: 'New account created via email registration',
    });

    const token = signSessionToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    let user = await getUserByEmail(normalizedEmail);

    if (!user) {
      const localPart = normalizedEmail.split('@')[0] || 'Architect';
      const derivedName =
        localPart
          .replace(/[._-]+/g, ' ')
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Architect';
      const passwordHash = await bcrypt.hash(String(password), 10);
      const uid = `bv_${crypto.randomUUID()}`;
      user = await createLocalUser({
        uid,
        fullName: derivedName,
        email: normalizedEmail,
        passwordHash,
      });
      user = await updateUserProfile(user.id, { emailVerified: true });
    } else {
      if (user.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended. Contact administrator.' });
        return;
      }
      user = await updateUserProfile(user.id, { lastLoginAt: new Date() });
    }

    const token = signSessionToken(user);

    await recordAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: String(user.id),
    });

    res.json({ token, user: sanitizeUser(user) });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Sign in failed.' });
  }
});

app.post('/api/auth/firebase-sync', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }
    const normalized = String(email).trim().toLowerCase();
    const user = await getUserByEmail(normalized);
    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      resetTokens.set(normalized, {
        email: normalized,
        code,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      res.json({
        message: 'Password reset instructions prepared.',
        // Returned for immediate local verification workflow in preview
        verificationCode: code,
      });
      return;
    }
    res.json({
      message: 'If an account exists for that email, reset instructions have been prepared.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process password reset.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, verification code, and new password are required.' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const normalized = String(email).trim().toLowerCase();
    const entry = resetTokens.get(normalized);
    if (!entry || entry.code !== String(code).trim() || entry.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired reset verification code.' });
      return;
    }
    const user = await getUserByEmail(normalized);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await updateUserProfile(user.id, { passwordHash });
    resetTokens.delete(normalized);
    res.json({ message: 'Password updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Password reset failed.' });
  }
});

app.post('/api/auth/verify-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    const updated = await updateUserProfile(req.dbUser!.id, { emailVerified: true });
    res.json({ user: sanitizeUser(updated) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Email verification failed.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

app.patch('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fullName, phone, preferences } = req.body || {};
    const updated = await updateUserProfile(req.dbUser!.id, {
      ...(fullName ? { fullName: String(fullName).trim() } : {}),
      ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
      ...(preferences ? { preferences } : {}),
    });
    res.json({ user: sanitizeUser(updated) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update profile.' });
  }
});

// ================= PRICING CATALOG & NOTIFICATIONS =================

app.get('/api/pricing/catalog', requireAuth, async (_req, res) => {
  try {
    const catalog = await getPricingCatalog();
    res.json(catalog);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load pricing catalog.' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await listUserNotifications(req.dbUser!.id);
    res.json({ notifications: items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load notifications.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await markNotificationRead(req.dbUser!.id);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update notifications.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await markNotificationRead(req.dbUser!.id, Number(req.params.id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update notification.' });
  }
});

// ================= PROJECT & BLUEPRINT ROUTES =================

app.get('/api/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await listUserProjects(req.dbUser!.id);
    res.json({ projects: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load projects.' });
  }
});

app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, description, location, floorsCount, currency } = req.body || {};
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }
    const created = await createProjectRecord({
      userId: req.dbUser!.id,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      location: location ? String(location).trim() : 'Global Standard',
      floorsCount: Number(floorsCount) || 1,
      currency: currency || 'USD',
    });

    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'PROJECT_CREATED',
      targetType: 'project',
      targetId: String(created.id),
      details: `Created project "${created.name}"`,
    });

    res.status(201).json({ project: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create project.' });
  }
});

app.get('/api/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const project = await getProjectById(Number(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (project.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied to this project.' });
      return;
    }
    const catalog = await getPricingCatalog();
    const costBreakdown = calculateProjectCosts({
      analysis: project.analysisData || null,
      futurePlan: project.futurePlanData || null,
      regionName: project.location,
      materials: catalog.materials,
      labour: catalog.labour,
      regions: catalog.regions,
    });
    res.json({ project, costBreakdown });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load project.' });
  }
});

app.patch('/api/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const project = await getProjectById(Number(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (project.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied to this project.' });
      return;
    }

    const {
      name,
      description,
      location,
      floorsCount,
      status,
      analysisData,
      interiorVersions,
      futurePlanData,
    } = req.body || {};

    const nextAnalysis = analysisData !== undefined ? analysisData : project.analysisData;
    const nextLocation = location !== undefined ? location : project.location;
    const catalog = await getPricingCatalog();
    const costBreakdown = calculateProjectCosts({
      analysis: nextAnalysis || null,
      futurePlan: futurePlanData !== undefined ? futurePlanData : project.futurePlanData,
      regionName: nextLocation,
      materials: catalog.materials,
      labour: catalog.labour,
      regions: catalog.regions,
    });

    const updated = await updateProjectRecord(project.id, {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: String(description) } : {}),
      ...(location !== undefined ? { location: String(location) } : {}),
      ...(floorsCount !== undefined ? { floorsCount: Number(floorsCount) } : {}),
      ...(status !== undefined ? { status: String(status) } : {}),
      ...(analysisData !== undefined ? { analysisData: nextAnalysis } : {}),
      ...(interiorVersions !== undefined ? { interiorVersions } : {}),
      ...(futurePlanData !== undefined ? { futurePlanData } : {}),
      totalAreaSqm: costBreakdown.totalAreaSqm,
      estimatedCost: costBreakdown.totalHouseCost,
      currency: costBreakdown.currency,
    });

    res.json({ project: updated, costBreakdown });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update project.' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const project = await getProjectById(Number(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (project.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    await deleteProjectRecord(project.id);
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'PROJECT_DELETED',
      targetType: 'project',
      targetId: String(project.id),
      details: `Deleted project "${project.name}"`,
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete project.' });
  }
});

function resolveBlueprintSource(params: {
  file?: Express.Multer.File;
  useSample: boolean;
}) {
  if (params.file) {
    const ext = path.extname(params.file.originalname || '').toLowerCase();
    const extMimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    const resolvedMime =
      params.file.mimetype && params.file.mimetype !== 'application/octet-stream'
        ? params.file.mimetype === 'image/jpg'
          ? 'image/jpeg'
          : params.file.mimetype
        : extMimeMap[ext] || 'image/png';
    return {
      fileBuffer: fs.readFileSync(params.file.path),
      mimeType: resolvedMime,
      fileName: params.file.originalname,
      fileUrl: `/uploads/${params.file.filename}`,
    };
  }
  if (params.useSample) {
    const samplePath = path.resolve(
      process.cwd(),
      'src/assets/images/sample_blueprint_villa_1795092602604.jpg'
    );
    if (!fs.existsSync(samplePath)) {
      throw Object.assign(new Error('Sample architectural blueprint asset not found.'), {
        status: 404,
      });
    }
    return {
      fileBuffer: fs.readFileSync(samplePath),
      mimeType: 'image/jpeg',
      fileName: 'sample_architectural_villa_plan.jpg',
      fileUrl: '/src/assets/images/sample_blueprint_villa_1795092602604.jpg',
    };
  }
  throw Object.assign(
    new Error('Please upload a blueprint image (PNG, JPG, WEBP) or PDF floor plan.'),
    { status: 400 }
  );
}

async function runBlueprintPredictionAndAlterProject(params: {
  project: Awaited<ReturnType<typeof getProjectById>> & {};
  user: NonNullable<AuthRequest['dbUser']>;
  file?: Express.Multer.File;
  useSample: boolean;
  unitPref: 'm' | 'ft';
  applyPredictedName?: boolean;
}) {
  const { project, user, file, useSample, unitPref, applyPredictedName } = params;
  const source = resolveBlueprintSource({ file, useSample });

  const previousState = {
    blueprintFileName: project.blueprintFileName,
    blueprintFileUrl: project.blueprintFileUrl,
    blueprintMimeType: project.blueprintMimeType,
    blueprintStatus:
      project.blueprintStatus === 'completed' || project.blueprintStatus === 'needs_review'
        ? project.blueprintStatus
        : project.analysisData?.rooms?.length
        ? project.analysisData.rooms.some((r) => r.needsReview)
          ? 'needs_review'
          : 'completed'
        : 'needs_review',
  };

  await updateProjectRecord(project.id, {
    blueprintFileName: source.fileName,
    blueprintFileUrl: source.fileUrl,
    blueprintMimeType: source.mimeType,
    blueprintStatus: 'analyzing',
  });

  try {
    const analysis = await analyzeBlueprintWithGemini({
      fileBuffer: source.fileBuffer,
      mimeType: source.mimeType,
      fileName: source.fileName,
      projectName: project.name,
      unitPreference: unitPref,
      floorsHint: project.floorsCount,
    });

    const catalog = await getPricingCatalog();
    const costBreakdown = calculateProjectCosts({
      analysis,
      futurePlan: project.futurePlanData || null,
      regionName: project.location,
      materials: catalog.materials,
      labour: catalog.labour,
      regions: catalog.regions,
    });

    const needsReview = analysis.rooms.some((r) => r.needsReview);
    const nextName =
      applyPredictedName && analysis.suggestedTitle?.trim()
        ? analysis.suggestedTitle.trim()
        : project.name;
    const nextDescription =
      !project.description && analysis.architecturalStyle
        ? `${analysis.architecturalStyle} — predicted from ${source.fileName}`
        : project.description || undefined;

    const updated = await updateProjectRecord(project.id, {
      name: nextName,
      ...(nextDescription ? { description: nextDescription } : {}),
      blueprintFileName: source.fileName,
      blueprintFileUrl: source.fileUrl,
      blueprintMimeType: source.mimeType,
      blueprintStatus: needsReview ? 'needs_review' : 'completed',
      status: 'modeled_3d',
      floorsCount: analysis.floors,
      totalAreaSqm: analysis.totalAreaSqm,
      estimatedCost: costBreakdown.totalHouseCost,
      currency: costBreakdown.currency,
      analysisData: analysis,
    });

    await createNotification({
      userId: user.id,
      title: 'Blueprint Predicted & Applied',
      message: `Predicted ${analysis.rooms.length} rooms (${analysis.totalAreaSqm} m²) and updated "${updated.name}". 3D model is ready.`,
      category: 'blueprint',
    });

    await recordAuditLog({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'BLUEPRINT_ANALYZED',
      targetType: 'project',
      targetId: String(project.id),
      details: `Predicted ${source.fileName} -> "${updated.name}": ${analysis.rooms.length} rooms, avg confidence ${Math.round(analysis.averageConfidence * 100)}%`,
    });

    return { project: updated, costBreakdown };
  } catch (err) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Ignore cleanup failure
      }
    }
    await updateProjectRecord(project.id, {
      ...(previousState.blueprintFileName !== null
        ? { blueprintFileName: previousState.blueprintFileName }
        : {}),
      ...(previousState.blueprintFileUrl !== null
        ? { blueprintFileUrl: previousState.blueprintFileUrl }
        : {}),
      ...(previousState.blueprintMimeType !== null
        ? { blueprintMimeType: previousState.blueprintMimeType }
        : {}),
      blueprintStatus: previousState.blueprintStatus,
    }).catch(() => {});
    throw err;
  }
}

app.post(
  '/api/blueprints/predict',
  requireAuth,
  upload.single('blueprint'),
  async (req: AuthRequest, res) => {
    let createdProjectId: number | null = null;
    try {
      const useSample = req.body?.useSample === 'true' || req.body?.useSample === true;
      const unitPref = req.body?.unit === 'ft' ? 'ft' : 'm';
      const requestedProjectId = req.body?.projectId ? Number(req.body.projectId) : null;
      const explicitName = req.body?.projectName ? String(req.body.projectName).trim() : '';
      const location = req.body?.location
        ? String(req.body.location).trim()
        : req.dbUser?.preferences?.region || 'Global Standard';

      let project = null;
      let isNewProject = false;

      if (requestedProjectId && !Number.isNaN(requestedProjectId)) {
        const existing = await getProjectById(requestedProjectId);
        if (!existing) {
          res.status(404).json({ error: 'Project not found.' });
          return;
        }
        if (existing.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
        project = existing;
      } else {
        // Validate blueprint source before creating project record
        resolveBlueprintSource({ file: req.file, useSample });
        const fallbackTitle = req.file
          ? req.file.originalname
              .replace(/\.[^/.]+$/, '')
              .replace(/[_-]+/g, ' ')
              .trim() || 'Predicted Residence Plan'
          : 'Sample Villa Residence';
        project = await createProjectRecord({
          userId: req.dbUser!.id,
          name: explicitName || fallbackTitle,
          description: '',
          location,
          floorsCount: Number(req.body?.floorsCount) || 1,
          currency: req.dbUser?.preferences?.currency || 'USD',
        });
        createdProjectId = project.id;
        isNewProject = true;
      }

      const result = await runBlueprintPredictionAndAlterProject({
        project,
        user: req.dbUser!,
        file: req.file,
        useSample,
        unitPref,
        applyPredictedName: isNewProject && !explicitName,
      });

      res.status(isNewProject ? 201 : 200).json({ ...result, created: isNewProject });
    } catch (error: any) {
      console.error('Blueprint predict error:', error);
      if (createdProjectId) {
        await deleteProjectRecord(createdProjectId).catch(() => {});
      }
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Ignore cleanup failure
        }
      }
      const status = typeof error.status === 'number' ? error.status : 500;
      res.status(status).json({
        error: error.message || 'Blueprint prediction failed. Please verify the file and try again.',
      });
    }
  }
);

app.post(
  '/api/projects/:id/blueprint',
  requireAuth,
  upload.single('blueprint'),
  async (req: AuthRequest, res) => {
    try {
      const project = await getProjectById(Number(req.params.id));
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      if (project.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }

      const useSample = req.body?.useSample === 'true' || req.body?.useSample === true;
      const unitPref = req.body?.unit === 'ft' ? 'ft' : 'm';

      const result = await runBlueprintPredictionAndAlterProject({
        project,
        user: req.dbUser!,
        file: req.file,
        useSample,
        unitPref,
      });

      res.json({ ...result, created: false });
    } catch (error: any) {
      console.error('Blueprint analysis error:', error);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Ignore cleanup failure
        }
      }
      const status = typeof error.status === 'number' ? error.status : 500;
      res.status(status).json({
        error: error.message || 'Blueprint analysis failed. Please verify the file and try again.',
      });
    }
  }
);

app.post('/api/projects/:id/assistant', requireAuth, async (req: AuthRequest, res) => {
  try {
    const project = await getProjectById(Number(req.params.id));
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    if (project.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { question, history } = req.body || {};
    if (!question || !String(question).trim()) {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    const catalog = await getPricingCatalog();
    const costs = calculateProjectCosts({
      analysis: project.analysisData || null,
      futurePlan: project.futurePlanData || null,
      regionName: project.location,
      materials: catalog.materials,
      labour: catalog.labour,
      regions: catalog.regions,
    });

    const summary = JSON.stringify(
      {
        projectName: project.name,
        location: project.location,
        floors: project.floorsCount,
        totalAreaSqm: project.totalAreaSqm,
        currency: costs.currency,
        estimatedTotalCost: costs.totalHouseCost,
        materialCost: costs.materialCost,
        labourCost: costs.labourCost,
        electricalCost: costs.electricalCost,
        plumbingCost: costs.plumbingCost,
        interiorCost: costs.interiorCost,
        rooms: (project.analysisData?.rooms || []).map((r) => ({
          name: r.name,
          type: r.type,
          floor: r.floor,
          widthM: r.width,
          depthM: r.depth,
          areaSqm: r.areaSqm,
          floorMaterial: r.floorMaterial,
          wallColor: r.wallColor,
          electrical: r.electrical,
          plumbing: r.plumbing,
        })),
        futureAdditions: project.futurePlanData?.additions || [],
      },
      null,
      2
    );

    const reply = await askHouseAssistant({
      question: String(question).trim(),
      projectSummary: summary,
      history: Array.isArray(history) ? history : [],
    });

    res.json({ reply });
  } catch (error: any) {
    console.error('Assistant error:', error);
    res.status(500).json({ error: error.message || 'Assistant request failed.' });
  }
});

// ================= ADMIN ROUTES (PROTECTED BY RBAC) =================

app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const overview = await getAdminOverviewStats();
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load admin overview.' });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const usersList = await adminListUsers();
    res.json({ users: usersList });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load users.' });
  }
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const { role, status, emailVerified } = req.body || {};
    const updated = await adminUpdateUser(targetId, {
      ...(role ? { role: String(role) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(emailVerified !== undefined ? { emailVerified: Boolean(emailVerified) } : {}),
    });
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'ADMIN_USER_UPDATED',
      targetType: 'user',
      targetId: String(targetId),
      details: `Updated user ${updated.email} -> role=${updated.role}, status=${updated.status}`,
    });
    res.json({ user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update user.' });
  }
});

app.get('/api/admin/projects', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const list = await adminListProjects();
    res.json({ projects: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load projects.' });
  }
});

app.post('/api/admin/materials', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const saved = await adminUpsertMaterial(req.body);
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'MATERIAL_PRICE_UPDATED',
      targetType: 'material',
      targetId: String(saved.id),
      details: `${saved.name} (${saved.unitPrice}/${saved.unit})`,
    });
    res.json({ material: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save material.' });
  }
});

app.delete('/api/admin/materials/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await adminDeleteMaterial(Number(req.params.id));
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'MATERIAL_DELETED',
      targetType: 'material',
      targetId: req.params.id,
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete material.' });
  }
});

app.post('/api/admin/labour', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const saved = await adminUpsertLabour(req.body);
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'LABOUR_RATE_UPDATED',
      targetType: 'labour',
      targetId: String(saved.id),
      details: `${saved.trade} (${saved.ratePerUnit}/${saved.unit})`,
    });
    res.json({ labour: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save labour rate.' });
  }
});

app.delete('/api/admin/labour/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await adminDeleteLabour(Number(req.params.id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete labour rate.' });
  }
});

app.post('/api/admin/regions', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const saved = await adminUpsertRegion(req.body);
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'REGION_MULTIPLIER_UPDATED',
      targetType: 'region',
      targetId: String(saved.id),
      details: `${saved.regionName} (mat=${saved.materialMultiplier}, lab=${saved.labourMultiplier})`,
    });
    res.json({ region: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save region.' });
  }
});

app.delete('/api/admin/regions/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await adminDeleteRegion(Number(req.params.id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete region.' });
  }
});

app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const logs = await adminListAuditLogs();
    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load audit logs.' });
  }
});

app.get('/api/admin/settings', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const settings = await adminGetSettings();
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load settings.' });
  }
});

app.put('/api/admin/settings', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const settings = await adminUpdateSettings(req.body.settings || {});
    await recordAuditLog({
      actorUserId: req.dbUser!.id,
      actorEmail: req.dbUser!.email,
      action: 'APP_SETTINGS_UPDATED',
      targetType: 'settings',
      details: JSON.stringify(settings),
    });
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update settings.' });
  }
});

// ================= PROJECT SOURCE ZIP EXPORT =================

app.get('/api/export/source-zip', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const rootDir = process.cwd();
    const zip = new JSZip();

    const rootFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'metadata.json',
      'server.ts',
      '.env.example',
      '.gitignore',
      'firebase-applet-config.json',
    ];

    for (const fileName of rootFiles) {
      const fullPath = path.join(rootDir, fileName);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        zip.file(fileName, fs.readFileSync(fullPath));
      }
    }

    const addDirectoryRecursive = (dirName: string) => {
      const targetDir = path.join(rootDir, dirName);
      if (!fs.existsSync(targetDir)) return;

      const walk = (currentPath: string) => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === '.git' ||
            entry.name.startsWith('.env')
          ) {
            continue;
          }
          const fullEntryPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            walk(fullEntryPath);
          } else if (entry.isFile()) {
            const relPath = path.relative(rootDir, fullEntryPath).replace(/\\/g, '/');
            zip.file(relPath, fs.readFileSync(fullEntryPath));
          }
        }
      };

      walk(targetDir);
    };

    addDirectoryRecursive('src');
    addDirectoryRecursive('public');

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="buildvision-ai-project.zip"');
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (error: any) {
    console.error('Source zip export error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate project ZIP archive.' });
  }
});

// Clean JSON error handler for Multer upload limits/file filters & malformed JSON
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) {
    next();
    return;
  }
  const status = typeof err.status === 'number' ? err.status : 400;
  res.status(status).json({ error: err.message || 'Invalid request.' });
});

// ================= VITE / STATIC FRONTEND SERVING =================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BUILDVISION AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
