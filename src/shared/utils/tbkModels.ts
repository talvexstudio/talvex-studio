import JSZip from 'jszip';
import { ContextFileData, ContextSnapshot, BuildingFootprint, CONTEXT_SCHEMA_VERSION } from '../stores/contextStore';
import { MAX_CONTEXT_BUILDINGS } from '../three/massingRenderer';

const MODEL_FILENAME = 'model.json';
const CONTEXT_FILENAME = 'context.json';
const ASSETS_PATH = 'assets/';

export type ModelsTBKManifest = {
  schemaVersion: number;
  createdAt: string;
  kind: 'models';
  sourceType: 'glb' | 'gltf';
  filename: string;
  transform: {
    x: number;
    y: number;
    z: number;
    rotZ: number;
  };
};

export async function createModelsTBKArchive(
  manifest: ModelsTBKManifest,
  modelBytes: Uint8Array | ArrayBuffer,
  context: ContextFileData | null
): Promise<Blob> {
  const zip = new JSZip();
  zip.file(MODEL_FILENAME, JSON.stringify(manifest, null, 2));
  if (context) {
    zip.file(CONTEXT_FILENAME, JSON.stringify(context, null, 2));
  }
  const bytes = modelBytes instanceof ArrayBuffer ? new Uint8Array(modelBytes) : modelBytes;
  zip.file(`${ASSETS_PATH}${manifest.filename}`, bytes);
  return zip.generateAsync({ type: 'blob' });
}

export async function parseModelsTBKFile(file: File): Promise<{
  manifest: ModelsTBKManifest;
  modelBytes?: Uint8Array;
  context: ContextSnapshot | null;
}> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const manifestText = await zip.file(MODEL_FILENAME)?.async('string');
  if (!manifestText) throw new Error('Missing model.json');
  const manifest = parseManifest(JSON.parse(manifestText));
  const assetFile = zip.file(`${ASSETS_PATH}${manifest.filename}`);
  const modelBytes = assetFile ? await assetFile.async('uint8array') : undefined;
  const contextFile = zip.file(CONTEXT_FILENAME);
  let context: ContextSnapshot | null = null;
  if (contextFile) {
    const contextText = await contextFile.async('string');
    context = parseContextFile(JSON.parse(contextText));
  }
  return { manifest, modelBytes, context };
}

function parseManifest(data: any): ModelsTBKManifest {
  if (!data || typeof data !== 'object') throw new Error('Invalid model manifest');
  if (data.kind !== 'models') throw new Error('Invalid model manifest kind');
  const sourceType = data.sourceType === 'glb' || data.sourceType === 'gltf' ? data.sourceType : null;
  if (!sourceType) throw new Error('Invalid model source type');
  const filename = typeof data.filename === 'string' && data.filename.trim() ? data.filename : `model.${sourceType}`;
  const rawTransform = data.transform ?? {};
  const transform = {
    x: Number.isFinite(rawTransform.x) ? Number(rawTransform.x) : 0,
    y: Number.isFinite(rawTransform.y) ? Number(rawTransform.y) : 0,
    z: Number.isFinite(rawTransform.z) ? Number(rawTransform.z) : 0,
    rotZ: Number.isFinite(rawTransform.rotZ) ? Number(rawTransform.rotZ) : 0
  };
  return {
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 1,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    kind: 'models',
    sourceType,
    filename,
    transform
  };
}

function parseContextFile(data: any): ContextSnapshot | null {
  if (!data || typeof data !== 'object') return null;
  if (data.schemaVersion !== CONTEXT_SCHEMA_VERSION) return null;
  if (!data.center || typeof data.center.lat !== 'number' || typeof data.center.lon !== 'number') return null;
  if (typeof data.radiusM !== 'number') return null;
  if (!Array.isArray(data.buildings)) return null;
  const buildings = sanitizeBuildings(data.buildings);
  return {
    center: { lat: Number(data.center.lat), lon: Number(data.center.lon) },
    radiusM: Number(data.radiusM),
    buildings,
    fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : undefined,
    source: typeof data.source === 'string' ? data.source : 'tbk'
  };
}

function sanitizeBuildings(buildings: any[]): BuildingFootprint[] {
  const sanitized: BuildingFootprint[] = [];
  for (const building of buildings) {
    if (!building || typeof building.id !== 'string' || !Array.isArray(building.footprint)) continue;
    const footprint: Array<[number, number]> = [];
    for (const point of building.footprint) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const [lat, lon] = point;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      footprint.push([Number(lat), Number(lon)]);
    }
    if (footprint.length < 3) continue;
    sanitized.push({
      id: building.id,
      footprint,
      heightM: typeof building.heightM === 'number' ? Number(building.heightM) : undefined,
      levels: typeof building.levels === 'number' ? Number(building.levels) : undefined
    });
    if (sanitized.length >= MAX_CONTEXT_BUILDINGS) break;
  }
  return sanitized;
}
