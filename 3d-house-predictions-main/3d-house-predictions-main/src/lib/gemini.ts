import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { BlueprintAnalysisPayload, RoomGeometry } from '../db/schema.ts';

function getAiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const roomSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING },
    type: {
      type: Type.STRING,
      description:
        'One of: living, bedroom, kitchen, bathroom, dining, hallway, study, storage, balcony, garage, utility',
    },
    floor: { type: Type.INTEGER },
    x: { type: Type.NUMBER, description: 'X coordinate in meters from plan left edge' },
    z: { type: Type.NUMBER, description: 'Z coordinate in meters from plan top edge' },
    width: { type: Type.NUMBER, description: 'Room width in meters along X axis' },
    depth: { type: Type.NUMBER, description: 'Room depth in meters along Z axis' },
    height: { type: Type.NUMBER, description: 'Ceiling height in meters (typically 2.8 to 3.2)' },
    areaSqm: { type: Type.NUMBER },
    confidence: { type: Type.NUMBER, description: 'Confidence score between 0.0 and 1.0' },
    needsReview: { type: Type.BOOLEAN, description: 'True if any dimension or label is uncertain or illegible' },
    uncertainFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Names of uncertain fields such as width, depth, or room label',
    },
    wallColor: { type: Type.STRING, description: 'Hex color like #F8F8F6' },
    floorMaterial: { type: Type.STRING, description: 'e.g. Oak Hardwood, Porcelain Tile, Polished Concrete, Carpet' },
    ceilingStyle: { type: Type.STRING, description: 'e.g. Flat Plaster, Recessed Cove, Acoustic Timber' },
    doors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          wall: { type: Type.STRING, description: 'north, south, east, or west' },
          offset: { type: Type.NUMBER, description: 'Normalized 0.15 to 0.85 position along wall' },
          width: { type: Type.NUMBER, description: 'Door width in meters, typically 0.9' },
        },
        required: ['id', 'wall', 'offset', 'width'],
      },
    },
    windows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          wall: { type: Type.STRING, description: 'north, south, east, or west' },
          offset: { type: Type.NUMBER, description: 'Normalized 0.15 to 0.85 position along wall' },
          width: { type: Type.NUMBER, description: 'Window width in meters, typically 1.2 to 2.4' },
          sillHeight: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
        },
        required: ['id', 'wall', 'offset', 'width', 'sillHeight', 'height'],
      },
    },
    electrical: {
      type: Type.OBJECT,
      properties: {
        lights: { type: Type.INTEGER },
        fans: { type: Type.INTEGER },
        sockets: { type: Type.INTEGER },
        switches: { type: Type.INTEGER },
        acPoints: { type: Type.INTEGER },
        circuitLoadKw: { type: Type.NUMBER },
      },
      required: ['lights', 'fans', 'sockets', 'switches', 'acPoints', 'circuitLoadKw'],
    },
    plumbing: {
      type: Type.OBJECT,
      properties: {
        coldOutlets: { type: Type.INTEGER },
        hotOutlets: { type: Type.INTEGER },
        drainPoints: { type: Type.INTEGER },
        fixtures: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['coldOutlets', 'hotOutlets', 'drainPoints', 'fixtures'],
    },
  },
  required: [
    'id',
    'name',
    'type',
    'floor',
    'x',
    'z',
    'width',
    'depth',
    'height',
    'areaSqm',
    'confidence',
    'needsReview',
    'wallColor',
    'floorMaterial',
    'ceilingStyle',
    'doors',
    'windows',
    'electrical',
    'plumbing',
  ],
};

function defaultFurnitureForRoom(room: RoomGeometry): RoomGeometry['furniture'] {
  const cx = room.width / 2;
  const cz = room.depth / 2;
  switch (room.type) {
    case 'living':
      return [
        { id: `${room.id}-f1`, item: 'sofa', label: '3-Seat Architectural Sofa', x: cx - 0.3, z: cz + 0.5, rotationY: 0, width: 2.1, depth: 0.9, height: 0.78, color: '#D8D6CF' },
        { id: `${room.id}-f2`, item: 'coffee_table', label: 'Low Timber Coffee Table', x: cx - 0.3, z: cz - 0.45, rotationY: 0, width: 1.1, depth: 0.6, height: 0.38, color: '#B49572' },
        { id: `${room.id}-f3`, item: 'media_console', label: 'Media Credenza', x: cx - 0.3, z: Math.max(0.45, cz - 1.35), rotationY: 0, width: 1.6, depth: 0.42, height: 0.52, color: '#7D6A56' },
      ];
    case 'bedroom':
      return [
        { id: `${room.id}-f1`, item: 'bed', label: 'Queen Platform Bed', x: cx, z: cz - 0.2, rotationY: 0, width: 1.65, depth: 2.05, height: 0.55, color: '#E8E6E0' },
        { id: `${room.id}-f2`, item: 'wardrobe', label: 'Built-in Wardrobe', x: Math.max(0.45, room.width - 0.4), z: cz, rotationY: 0, width: 0.6, depth: Math.min(2.0, room.depth * 0.65), height: 2.1, color: '#D2CFC7' },
      ];
    case 'kitchen':
      return [
        { id: `${room.id}-f1`, item: 'kitchen_counter', label: 'L-Shape Kitchen Counter', x: cx, z: 0.45, rotationY: 0, width: Math.min(2.8, room.width * 0.8), depth: 0.68, height: 0.9, color: '#ECEBE6' },
        { id: `${room.id}-f2`, item: 'island', label: 'Prep Island', x: cx, z: cz + 0.35, rotationY: 0, width: Math.min(1.8, room.width * 0.55), depth: 0.8, height: 0.9, color: '#D7D5CE' },
      ];
    case 'dining':
      return [
        { id: `${room.id}-f1`, item: 'dining_table', label: '6-Seat Dining Table', x: cx, z: cz, rotationY: 0, width: 1.6, depth: 0.95, height: 0.76, color: '#A58462' },
      ];
    case 'bathroom':
      return [
        { id: `${room.id}-f1`, item: 'vanity', label: 'Ceramic Vanity', x: 0.55, z: 0.45, rotationY: 0, width: 0.9, depth: 0.5, height: 0.84, color: '#F5F5F2' },
        { id: `${room.id}-f2`, item: 'bathtub', label: 'Soaking Tub / Shower', x: Math.max(0.8, room.width - 0.6), z: cz, rotationY: 0, width: 0.8, depth: 1.55, height: 0.52, color: '#FFFFFF' },
      ];
    case 'study':
      return [
        { id: `${room.id}-f1`, item: 'desk', label: 'Architect Drafting Desk', x: cx, z: cz - 0.2, rotationY: 0, width: 1.5, depth: 0.75, height: 0.75, color: '#A88968' },
      ];
    default:
      return [];
  }
}

function extractGeminiErrorMessage(err: any): string {
  const raw = err?.message || String(err || 'Gemini AI request failed.');
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      const code = parsed.error.code ? ` (${parsed.error.code})` : '';
      return `Gemini AI service error${code}: ${parsed.error.message}`;
    }
  } catch {
    // Not raw JSON
  }
  return raw;
}

function isRetryableGeminiError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryableGeminiError(err)) {
        const delayMs = 1500 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw new Error(extractGeminiErrorMessage(err));
    }
  }
  throw new Error(extractGeminiErrorMessage(lastErr));
}

export async function analyzeBlueprintWithGemini(params: {
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
  projectName: string;
  unitPreference?: 'm' | 'ft';
  floorsHint?: number;
}): Promise<BlueprintAnalysisPayload> {
  const ai = getAiClient();
  const base64Data = params.fileBuffer.toString('base64');
  const normalizedMimeType =
    params.mimeType === 'image/jpg' ? 'image/jpeg' : params.mimeType;

  const prompt = `Analyze this architectural house floor plan / blueprint (${params.fileName}) for project "${params.projectName}".
Extract a clean, geometrically consistent 2D-to-3D architectural spatial model in meters.

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. Detect every distinct room visible in the blueprint (living, bedroom, kitchen, bathroom, dining, hallway, study, storage, balcony, garage, utility).
2. Arrange rooms on a clean Cartesian grid in meters (x, z = top-left corner of the room footprint; width along X, depth along Z) so adjacent rooms touch cleanly without overlapping.
3. DO NOT invent hidden dimensions with false certainty. If dimension numbers are missing, illegible, or estimated from visual proportions in the blueprint, set "needsReview": true, set a realistic lower confidence (e.g. 0.62 to 0.78), and list the uncertain fields in "uncertainFields" and explain in "uncertainNotes".
4. Estimate realistic doors and windows on the room perimeter walls (north=min z, south=max z, west=min x, east=max x).
5. Provide preliminary planning electrical (lights, fans, sockets, switches, acPoints) and plumbing (coldOutlets, hotOutlets, drainPoints, fixtures) counts appropriate to each room type, plus circuit groupings and water riser/tank locations.
6. Provide a concise "suggestedTitle" describing the residence (e.g. "3-Bedroom Modern Courtyard House") and "architecturalStyle" (e.g. "Contemporary Single-Story Villa").
7. Unit preference requested by user: ${params.unitPreference || 'm'}. Expected floors hint: ${params.floorsHint || 1}.`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: normalizedMimeType,
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: { type: Type.STRING },
            architecturalStyle: { type: Type.STRING },
            scaleNote: { type: Type.STRING },
            overallWidthM: { type: Type.NUMBER },
            overallDepthM: { type: Type.NUMBER },
            floors: { type: Type.INTEGER },
            uncertainNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
            structuralNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
            rooms: {
              type: Type.ARRAY,
              items: roomSchema,
            },
            electricalSummary: {
              type: Type.OBJECT,
              properties: {
                mainDbLocation: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
                  required: ['x', 'z'],
                },
                circuits: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      breakerAmps: { type: Type.INTEGER },
                      rooms: { type: Type.ARRAY, items: { type: Type.STRING } },
                      estimatedWireM: { type: Type.NUMBER },
                    },
                    required: ['id', 'name', 'breakerAmps', 'rooms', 'estimatedWireM'],
                  },
                },
              },
              required: ['mainDbLocation', 'circuits'],
            },
            plumbingSummary: {
              type: Type.OBJECT,
              properties: {
                waterTankLocation: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
                  required: ['x', 'z'],
                },
                mainRiserLocation: {
                  type: Type.OBJECT,
                  properties: { x: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
                  required: ['x', 'z'],
                },
                supplyPipeM: { type: Type.NUMBER },
                hotWaterPipeM: { type: Type.NUMBER },
                drainagePipeM: { type: Type.NUMBER },
                valvesCount: { type: Type.INTEGER },
              },
              required: [
                'waterTankLocation',
                'mainRiserLocation',
                'supplyPipeM',
                'hotWaterPipeM',
                'drainagePipeM',
                'valvesCount',
              ],
            },
          },
          required: [
            'suggestedTitle',
            'architecturalStyle',
            'scaleNote',
            'overallWidthM',
            'overallDepthM',
            'floors',
            'uncertainNotes',
            'structuralNotes',
            'rooms',
            'electricalSummary',
            'plumbingSummary',
          ],
        },
      },
    })
  );

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText);

  const normalizedRooms: RoomGeometry[] = (parsed.rooms || []).map((r: any, idx: number) => {
    const width = Math.max(1.4, Number(r.width) || 3.5);
    const depth = Math.max(1.4, Number(r.depth) || 3.5);
    const height = Math.max(2.4, Math.min(4.5, Number(r.height) || 3.0));
    const areaSqm = Number((width * depth).toFixed(2));
    const roomObj: RoomGeometry = {
      id: r.id || `room-${idx + 1}`,
      name: r.name || `Room ${idx + 1}`,
      type: r.type || 'living',
      floor: Math.max(1, Number(r.floor) || 1),
      x: Number.isFinite(Number(r.x)) ? Number(r.x) : 0,
      z: Number.isFinite(Number(r.z)) ? Number(r.z) : 0,
      width,
      depth,
      height,
      areaSqm,
      confidence: Math.max(0.35, Math.min(0.99, Number(r.confidence) || 0.72)),
      needsReview: Boolean(r.needsReview ?? (Number(r.confidence) || 0.72) < 0.82),
      uncertainFields: Array.isArray(r.uncertainFields) ? r.uncertainFields : [],
      wallColor: r.wallColor || '#F7F7F4',
      floorMaterial: r.floorMaterial || (r.type === 'bathroom' || r.type === 'kitchen' ? 'Porcelain Tile' : 'Oak Hardwood'),
      ceilingStyle: r.ceilingStyle || 'Flat Plaster',
      tilePattern: r.type === 'bathroom' || r.type === 'kitchen' ? 'Large Format Grid' : 'Wide Plank',
      lightingWarmth: 'neutral',
      lightingIntensity: 1.0,
      doors: Array.isArray(r.doors)
        ? r.doors.map((d: any, dIdx: number) => ({
            id: d?.id || `${r.id || `room-${idx + 1}`}-d${dIdx + 1}`,
            wall: ['north', 'south', 'east', 'west'].includes(d?.wall) ? d.wall : 'south',
            offset: Math.max(0.15, Math.min(0.85, Number(d?.offset) || 0.5)),
            width: Math.max(0.7, Math.min(2.0, Number(d?.width) || 0.9)),
          }))
        : [],
      windows: Array.isArray(r.windows)
        ? r.windows.map((w: any, wIdx: number) => ({
            id: w?.id || `${r.id || `room-${idx + 1}`}-w${wIdx + 1}`,
            wall: ['north', 'south', 'east', 'west'].includes(w?.wall) ? w.wall : 'north',
            offset: Math.max(0.15, Math.min(0.85, Number(w?.offset) || 0.5)),
            width: Math.max(0.6, Math.min(3.0, Number(w?.width) || 1.4)),
            sillHeight: Math.max(0.3, Math.min(1.5, Number(w?.sillHeight) || 0.9)),
            height: Math.max(0.8, Math.min(2.4, Number(w?.height) || 1.3)),
          }))
        : [],
      furniture: [],
      electrical: r.electrical || { lights: 2, fans: 1, sockets: 4, switches: 2, acPoints: 0, circuitLoadKw: 1.2 },
      plumbing: r.plumbing || { coldOutlets: 0, hotOutlets: 0, drainPoints: 0, fixtures: [] },
    };
    roomObj.furniture = defaultFurnitureForRoom(roomObj);
    return roomObj;
  });

  const totalAreaSqm = Number(
    normalizedRooms.reduce((sum, room) => sum + room.areaSqm, 0).toFixed(2)
  );
  const averageConfidence = normalizedRooms.length
    ? Number(
        (
          normalizedRooms.reduce((sum, room) => sum + room.confidence, 0) /
          normalizedRooms.length
        ).toFixed(2)
      )
    : 0;

  return {
    suggestedTitle: parsed.suggestedTitle || params.projectName,
    architecturalStyle: parsed.architecturalStyle || 'Residential Floor Plan',
    scaleNote: parsed.scaleNote || 'Scale inferred visually from architectural CAD proportions. Verify critical spans before execution.',
    unit: params.unitPreference || 'm',
    overallWidthM: Number(parsed.overallWidthM) || 12,
    overallDepthM: Number(parsed.overallDepthM) || 9,
    floors: Math.max(1, Number(parsed.floors) || 1),
    totalAreaSqm,
    averageConfidence,
    uncertainNotes: Array.isArray(parsed.uncertainNotes) ? parsed.uncertainNotes : [],
    structuralNotes: Array.isArray(parsed.structuralNotes)
      ? parsed.structuralNotes
      : ['Preliminary spatial extraction only. Load-bearing walls and footing schedules require licensed structural engineering sign-off.'],
    rooms: normalizedRooms,
    electricalSummary: parsed.electricalSummary || {
      mainDbLocation: { x: 1, z: 1 },
      circuits: [],
    },
    plumbingSummary: parsed.plumbingSummary || {
      waterTankLocation: { x: 1, z: 1 },
      mainRiserLocation: { x: 2, z: 2 },
      supplyPipeM: 28,
      hotWaterPipeM: 14,
      drainagePipeM: 22,
      valvesCount: 6,
    },
  };
}

export async function askHouseAssistant(params: {
  question: string;
  projectSummary: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<string> {
  const ai = getAiClient();

  const systemInstruction = `You are the BUILDVISION AI Architectural Planning Assistant.
You advise homeowners, architects, and builders using the user's real project data provided below.
Be concise, technical yet clear, structured with bullet points when helpful, and always include appropriate disclaimers when discussing structural changes, electrical circuits, plumbing routing, or preliminary cost estimates (noting they require licensed engineering/contractor verification).
Do not invent room measurements not present in the project context.

ACTIVE PROJECT CONTEXT:
${params.projectSummary}`;

  const historyText = params.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Architect AI'}: ${m.text}`)
    .join('\n\n');

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `${historyText ? `Conversation history:\n${historyText}\n\n` : ''}User question: ${params.question}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );

  return response.text || 'I could not generate a response for that architectural query.';
}
