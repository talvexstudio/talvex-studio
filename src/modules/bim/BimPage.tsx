import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker1x from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useContextStore } from '../../shared/stores/contextStore';
import { prepareContextPayload } from '../../shared/context/prepareContextPayload';
import { BimViewport, type BimAsset, type BimViewportHandle, type BimDiagnostics } from './BimViewport';
import { geocodeAddress, type GeocodeResult } from './geocode';
import { ImageGenModal } from './ImageGenModal';
import { generateImage } from './imageGenProvider';
import { Search, X } from '../../shared/ui/icons';
import './bim.css';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow
});

type TbkManifest = {
  modelPath?: string;
  model?: string;
  glb?: string;
  glbPath?: string;
  bim?: { modelPath?: string };
  assets?: { model?: string; path?: string; modelPath?: string } | Array<{ path?: string; modelPath?: string; model?: string }>;
};

const createEmptyDiagnostics = (): BimDiagnostics => ({
  meshCount: 0,
  lineCount: 0,
  pointCount: 0,
  triangleCount: 0,
  bboxSize: { x: 0, y: 0, z: 0 }
});

export function BimPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<BimViewportHandle>(null);
  const [asset, setAsset] = useState<BimAsset>({ kind: 'none' });
  const [modelError, setModelError] = useState('');
  const [modelNote, setModelNote] = useState('');
  const [isIfcLoading, setIsIfcLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [activeObjectUrl, setActiveObjectUrl] = useState<string | null>(null);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [radiusChoice, setRadiusChoice] = useState<number>(100);
  const [contextError, setContextError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [referenceShot, setReferenceShot] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageError, setImageError] = useState('');
  const [diagnostics, setDiagnostics] = useState<BimDiagnostics | null>(null);

  const center = useContextStore((state) => state.center);
  const radiusM = useContextStore((state) => state.radiusM);
  const buildings = useContextStore((state) => state.buildings);
  const lastFetchedKey = useContextStore((state) => state.lastFetchedKey);
  const status = useContextStore((state) => state.status);
  const errorMessage = useContextStore((state) => state.error);
  const buildingsCount = useContextStore((state) => state.buildingsCount);
  const setCenter = useContextStore((state) => state.setCenter);
  const setRadiusM = useContextStore((state) => state.setRadiusM);
  const clearContext = useContextStore((state) => state.clearContext);
  const fetchContext = useContextStore((state) => state.fetchContext);
  const cancelFetch = useContextStore((state) => state.cancelFetch);

  const contextPayload = useMemo(() => {
    if (!center) return null;
    const { payload } = prepareContextPayload(center, buildings, lastFetchedKey ?? '', radiusM);
    return payload;
  }, [buildings, center, lastFetchedKey, radiusM]);

  const hasPoint =
    latInput.trim() !== '' &&
    lonInput.trim() !== '' &&
    Number.isFinite(Number(latInput)) &&
    Number.isFinite(Number(lonInput));
  const fallbackCenter: [number, number] = useMemo(() => {
    if (hasPoint) {
      return [Number(latInput), Number(lonInput)];
    }
    if (center) {
      return [center.lat, center.lon];
    }
    return [0, 0];
  }, [center, hasPoint, latInput, lonInput]);

  useEffect(
    () => () => {
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    },
    [activeObjectUrl]
  );

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleIfcLoad = async (file: File) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      throw new Error('Viewport not ready.');
    }
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      setActiveObjectUrl(null);
    }
    setAsset({ kind: 'ifc', name: file.name });
    setDiagnostics(createEmptyDiagnostics());
    setModelError('');
    setModelNote(`Loading ${file.name}...`);
    setIsIfcLoading(true);
    setModelProgress(0);
    try {
      await viewport.loadIfc(file, {
        onProgress: (fraction) => {
          setModelProgress(fraction);
          const percent = Number.isFinite(fraction) ? Math.round(fraction * 100) : 0;
          setModelNote(`Loading IFC (${percent}%)`);
        }
      });
      setModelNote('IFC loaded');
    } finally {
      setIsIfcLoading(false);
      setModelProgress(0);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setModelError('');
    setModelNote(`Loading ${file.name}...`);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'ifc') {
        await handleIfcLoad(file);
      } else if (ext === 'tbk') {
        await loadTbkModel(file);
      } else {
        throw new Error('Unsupported file type. Please load .IFC or .TBK');
      }
    } catch (error) {
      console.error(error);
      const message = (error as Error).message ?? 'Failed to load model.';
      setModelError(message);
      setModelNote('');
      setAsset({ kind: 'error', message, name: file?.name });
    } finally {
      event.target.value = '';
    }
  };

  const loadIfcBufferFromTbk = async (buffer: ArrayBuffer, label: string) => {
    const viewport = viewportRef.current;
    if (!viewport) throw new Error('Viewport not ready.');
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      setActiveObjectUrl(null);
    }
    setAsset({ kind: 'ifc', name: label });
    setDiagnostics(createEmptyDiagnostics());
    setModelError('');
    setModelNote(`Loading ${label}...`);
    setIsIfcLoading(true);
    setModelProgress(0);
    try {
      await viewport.loadIfcFromArrayBuffer(buffer, label, 'application/octet-stream');
      setModelNote(`IFC loaded (${label})`);
    } finally {
      setIsIfcLoading(false);
      setModelProgress(0);
    }
  };

  const loadTbkModel = async (file: File) => {
    setIsIfcLoading(false);
    setModelProgress(0);
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const allEntries = Object.values(zip.files);
    const fileEntries = allEntries.filter((entry) => !entry.dir);
    const manifestEntry =
      fileEntries.find((entry) => /bim\/manifest\.json$/i.test(entry.name)) ??
      fileEntries.find((entry) => /manifest\.json$/i.test(entry.name));
    let manifest: TbkManifest | null = null;
    if (manifestEntry) {
      manifest = await parseManifestEntry(manifestEntry);
    }
    const modelJsonEntry = fileEntries.find((entry) => /model\.json$/i.test(entry.name));
    const contextJsonEntry = fileEntries.find((entry) => /context\.json$/i.test(entry.name));
    const modelJson = modelJsonEntry ? await parseJsonFile(modelJsonEntry) : null;
    const modelJsonKeys =
      modelJson && typeof modelJson === 'object' && !Array.isArray(modelJson) ? Object.keys(modelJson) : [];
    const hasContextJson = Boolean(contextJsonEntry);

    let targetEntry: JSZip.JSZipObject | null = null;
    let targetLabel = '';
    let targetType: 'gltf' | 'ifc' | null = null;
    let externalUrl: string | null = null;
    const manifestPath = resolveModelPath(manifest);
    if (manifestPath) {
      const match = findEntryByPath(fileEntries, manifestPath);
      if (match) {
        targetEntry = match;
        targetLabel = match.name;
        targetType = detectModelType(match.name);
      } else if (/^https?:\/\//i.test(manifestPath)) {
        externalUrl = manifestPath;
        targetLabel = manifestPath;
        targetType = detectModelType(manifestPath);
      }
    }

    if (!targetEntry && !externalUrl && modelJson) {
      const refs = Array.from(collectAssetRefsFromJson(modelJson));
      for (const ref of refs) {
        const match = findEntryByPath(fileEntries, ref);
        if (match) {
          targetEntry = match;
          targetLabel = match.name;
          targetType = detectModelType(match.name);
          break;
        }
        if (/^https?:\/\//i.test(ref)) {
          externalUrl = ref;
          targetLabel = ref;
          targetType = detectModelType(ref);
          break;
        }
      }
    }

    if (!targetEntry && !externalUrl) {
      const fallback = findFirstModelEntry(fileEntries);
      if (fallback) {
        targetEntry = fallback;
        targetLabel = fallback.name;
        targetType = detectModelType(fallback.name);
      }
    }

    if (!targetEntry && !externalUrl) {
      const sample = listSampleEntries(fileEntries);
      if (modelJson) {
        const keyList = modelJsonKeys.length ? modelJsonKeys.join(', ') : 'none';
        throw new Error(
          `TBK appears metadata-only (model.json keys: ${keyList}${hasContextJson ? '; context.json present' : ''}). Files seen: ${sample}`
        );
      }
      throw new Error(`No GLB/GLTF/IFC found in TBK. Files seen: ${sample}`);
    }

    if (externalUrl) {
      setModelNote(`Fetching ${externalUrl}...`);
    }

    if (targetType === 'ifc') {
      const ifcBuffer = targetEntry ? await targetEntry.async('arraybuffer') : await fetchExternalAsset(externalUrl!);
      await loadIfcBufferFromTbk(ifcBuffer, targetLabel || file.name);
      setModelError('');
      return;
    }

    const glbBuffer = targetEntry ? await targetEntry.async('arraybuffer') : await fetchExternalAsset(externalUrl!);
    const assetName = targetLabel || file.name;
    const isGltf = /\.gltf$/i.test(assetName);
    const blob = new Blob([glbBuffer], { type: isGltf ? 'model/gltf+json' : 'model/gltf-binary' });
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
    }
    const url = URL.createObjectURL(blob);
    setActiveObjectUrl(url);
    setAsset({ kind: 'gltf', url, name: assetName });
    setModelError('');
    setModelNote(`Loaded model from TBK (${assetName})`);
  };

  const handleOpenContext = () => {
    setContextModalOpen(true);
    setLatInput(center ? center.lat.toString() : '');
    setLonInput(center ? center.lon.toString() : '');
    setRadiusChoice(radiusM || 100);
    setContextError('');
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
  };

  const handleApplyContext = async () => {
    if (status === 'loading') {
      cancelFetch();
      return;
    }
    const lat = Number(latInput);
    const lon = Number(lonInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setContextError('Latitude and longitude are required.');
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setContextError('Coordinates must be valid lat/lon values.');
      return;
    }
    setCenter(lat, lon);
    setRadiusM(radiusChoice);
    setContextError('');
    await fetchContext();
  };

  const handleClearContext = () => {
    cancelFetch();
    clearContext();
    setLatInput('');
    setLonInput('');
    setRadiusChoice(100);
    setContextError('');
    setSearchResults([]);
  };

  const handleMapPick = (lat: number, lon: number) => {
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
    setContextError('');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError('Enter an address to search.');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const results = await geocodeAddress(searchQuery);
      setSearchResults(results);
      if (!results.length) {
        setSearchError('No results found.');
      }
    } catch (error) {
      console.error(error);
      setSearchError((error as Error).message ?? 'Address search failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUseResult = (result: GeocodeResult) => {
    setLatInput(result.lat.toFixed(6));
    setLonInput(result.lon.toFixed(6));
    setContextError('');
  };

  const openImageModal = () => {
    const shot = viewportRef.current?.captureImage() ?? null;
    setReferenceShot(shot);
    setGeneratedUrl(null);
    setImageError(shot ? '' : 'Unable to capture viewport. Try again.');
    setImageModalOpen(true);
  };

  const handleGenerateImage = async (prompt: string, screenshot: string) => {
    if (!screenshot) {
      setImageError('No reference screenshot available.');
      return;
    }
    setImageGenerating(true);
    setImageError('');
    try {
      const { dataUrl } = await generateImage({ prompt, referencePngDataUrl: screenshot });
      setGeneratedUrl(dataUrl);
    } catch (error) {
      console.error(error);
      setImageError((error as Error).message ?? 'Image generation failed.');
    } finally {
      setImageGenerating(false);
    }
  };

  const handleDownloadResult = () => {
    if (!generatedUrl) return;
    const link = document.createElement('a');
    link.href = generatedUrl;
    link.download = 'talvex-bim.png';
    link.click();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <section className="relative flex-1 min-h-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow">
          <BimViewport
            ref={viewportRef}
            asset={asset}
            context={contextPayload}
            className="rounded-[24px] bg-[#f4f6fb]"
            onDiagnostics={setDiagnostics}
          />
        </section>

        <aside className="w-full lg:max-w-[400px] rounded-[24px] border border-slate-200 bg-white shadow flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Talvex BIM</p>
              <h2 className="text-2xl font-semibold text-[#1f2937]">BIM</h2>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLoadClick}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm bg-white hover:border-slate-400"
              >
                Load model (.IFC / .TBK)
              </button>
              <button
                type="button"
                onClick={handleOpenContext}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm bg-white hover:border-slate-400"
              >
                Context
              </button>
              <button
                type="button"
                onClick={openImageModal}
                className="w-full rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#1d4ec9]"
              >
                Generate image
              </button>
              <input
                type="file"
                accept=".ifc,.IFC,.tbk,.TBK"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                Model:{' '}
                {asset.kind === 'none'
                  ? 'None loaded'
                  : asset.kind === 'error'
                  ? asset.message
                  : asset.kind === 'ifc'
                  ? asset.name ?? 'IFC'
                  : asset.name ?? 'GLB from TBK'}
              </p>
              {asset.kind === 'ifc' && (
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>
                    Meshes: {diagnostics ? diagnostics.meshCount.toLocaleString() : '--'} | Tris:{' '}
                    {diagnostics ? diagnostics.triangleCount.toLocaleString() : '--'} | BBox:{' '}
                    {diagnostics
                      ? `${diagnostics.bboxSize.x}x${diagnostics.bboxSize.y}x${diagnostics.bboxSize.z}`
                      : '--x--x--'}
                  </p>
                  <p>
                    Lines: {diagnostics ? diagnostics.lineCount.toLocaleString() : '--'} | Points:{' '}
                    {diagnostics ? diagnostics.pointCount.toLocaleString() : '--'}
                  </p>
                </div>
              )}
              {isIfcLoading && (
                <div className="space-y-1">
                  <p className="text-xs text-[#2563eb]">{modelNote || 'Loading IFC...'}</p>
                  <div className="h-1 w-full rounded-full bg-slate-200">
                    <div
                      className="h-1 rounded-full bg-[#2563eb] transition-[width]"
                      style={{
                        width: `${Math.min(100, Math.max(5, Math.round(modelProgress * 100))) || 5}%`
                      }}
                    />
                  </div>
                </div>
              )}
              {modelNote && !isIfcLoading && <p className="text-slate-500">{modelNote}</p>}
              {modelError && <p className="text-red-500">{modelError}</p>}
              {asset.kind === 'ifc' && diagnostics && diagnostics.triangleCount === 0 && (
                <p className="text-xs text-red-500">
                  IFC parsed but produced no renderable geometry. Try exporting with tessellation or a different IFC.
                </p>
              )}
              {asset.kind === 'ifc' && diagnostics?.error && (
                <p className="text-xs text-red-500">{diagnostics.error}</p>
              )}
              {!isIfcLoading && asset.kind === 'ifc' && diagnostics && isFlatBBox(diagnostics) && diagnostics.triangleCount > 0 && (
                <p className="text-xs text-amber-600">
                  Geometry bbox is extremely small. Try “Refit view” to frame it or check IFC export units.
                </p>
              )}
              <button
                type="button"
                onClick={() => viewportRef.current?.refitCamera()}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
              >
                Refit view
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Context</p>
              {center ? (
                <p className="text-sm text-slate-700">
                  ({center.lat.toFixed(4)}, {center.lon.toFixed(4)}) - {radiusM} m radius
                </p>
              ) : (
                <p className="text-sm text-slate-500">Not set</p>
              )}
              {status === 'loading' && (
                <div className="space-y-1">
                  <p className="text-xs text-[#2563eb]">Fetching context buildings</p>
                  <div className="imagegen-progress">
                    <div className="imagegen-progress-bar" />
                  </div>
                </div>
              )}
              {status === 'success' && (
                <p className="text-xs text-green-600">Loaded {buildingsCount} buildings</p>
              )}
              {status === 'error' && <p className="text-xs text-red-500">{errorMessage}</p>}
            </div>
          </div>
        </aside>
      </div>

      {contextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-3xl rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Context</p>
                <h3 className="text-lg font-semibold text-slate-900">Set location</h3>
              </div>
              <button
                type="button"
                onClick={() => setContextModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search address"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white shadow hover:bg-[#1d4ec9]"
                  >
                    <Search />
                    Search
                  </button>
                </div>
                {searchLoading && (
                  <div className="text-xs text-[#2563eb]">
                    Searching...
                    <div className="imagegen-progress mt-1">
                      <div className="imagegen-progress-bar" />
                    </div>
                  </div>
                )}
                {searchError && <p className="text-xs text-red-500">{searchError}</p>}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Results</p>
                    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.lat}-${result.lon}-${result.label}`}
                          type="button"
                          onClick={() => handleUseResult(result)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-slate-400"
                        >
                          <span className="block font-semibold text-slate-800">{result.label}</span>
                          <span className="text-xs text-slate-500">
                            {result.lat.toFixed(5)}, {result.lon.toFixed(5)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={latInput}
                      onChange={(event) => setLatInput(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-500">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lonInput}
                      onChange={(event) => setLonInput(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-slate-500">Radius</p>
                  <div className="flex gap-2">
                    {[50, 100, 200].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRadiusChoice(value)}
                        className={`rounded-full px-3 py-1 text-sm font-semibold border ${
                          radiusChoice === value
                            ? 'bg-[#2563eb] text-white border-[#2563eb]'
                            : 'border-slate-200 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {value} m
                      </button>
                    ))}
                  </div>
                </div>
                {contextError && <p className="text-xs text-red-500">{contextError}</p>}
                {status === 'error' && <p className="text-xs text-red-500">{errorMessage}</p>}
              </div>

              <div className="space-y-3">
                <ContextMap
                  lat={Number.isFinite(Number(latInput)) ? Number(latInput) : undefined}
                  lon={Number.isFinite(Number(lonInput)) ? Number(lonInput) : undefined}
                  fallback={fallbackCenter}
                  onPick={handleMapPick}
                />
                <p className="text-xs text-slate-500">Click on the map to set the center point.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleClearContext}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Clear
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContextModalOpen(false)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  disabled={status === 'loading'}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleApplyContext}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${
                    status === 'loading' ? 'bg-[#f97373]' : 'bg-[#2563eb]'
                  }`}
                >
                  {status === 'loading' ? 'Cancel' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImageGenModal
        open={imageModalOpen}
        screenshot={referenceShot}
        resultDataUrl={generatedUrl}
        generating={imageGenerating}
        error={imageError}
        onClose={() => setImageModalOpen(false)}
        onGenerate={handleGenerateImage}
        onDownload={handleDownloadResult}
      />
    </div>
  );
}

function resolveModelPath(manifest: TbkManifest | null): string | null {
  if (!manifest) return null;
  const candidates: Array<string | undefined> = [
    manifest.modelPath,
    manifest.model,
    manifest.glb,
    (manifest as any)?.glbPath,
    manifest.bim?.modelPath
  ];
  const assetField = manifest.assets as any;
  if (!Array.isArray(assetField) && typeof assetField === 'object' && assetField) {
    candidates.push(assetField.model, assetField.path, assetField.modelPath);
  }
  if (Array.isArray(assetField)) {
    for (const asset of assetField) {
      if (!asset) continue;
      candidates.push(asset.path, asset.modelPath, asset.model);
    }
  }
  const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return found ?? null;
}

const MODEL_FILE_REGEX = /\.(glb|gltf|ifc)$/i;

type ContextMapProps = {
  lat?: number;
  lon?: number;
  fallback: [number, number];
  onPick: (lat: number, lon: number) => void;
};

// COMPOSITION-ONLY: derived from src/modules/scenarios/ScenariosPage.tsx ContextMap
function ContextMap({ lat, lon, fallback, onPick }: ContextMapProps) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-inner">
      <MapContainer center={fallback} zoom={15} scrollWheelZoom className="h-64 w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <MapCenterUpdater lat={lat} lon={lon} fallback={fallback} />
        <MapClickHandler onPick={onPick} />
        {typeof lat === 'number' && typeof lon === 'number' && <Marker position={[lat, lon]} />}
      </MapContainer>
    </div>
  );
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      const pickedLat = Number(event.latlng.lat.toFixed(6));
      const pickedLon = Number(event.latlng.lng.toFixed(6));
      onPick(pickedLat, pickedLon);
    }
  });
  return null;
}

function MapCenterUpdater({ lat, lon, fallback }: { lat?: number; lon?: number; fallback: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lon === 'number') {
      map.setView([lat, lon]);
    } else {
      map.setView(fallback);
    }
  }, [lat, lon, fallback, map]);
  return null;
}

function isFlatBBox(diagnostics: BimDiagnostics) {
  const threshold = 0.01;
  return (
    Math.abs(diagnostics.bboxSize.x) < threshold &&
    Math.abs(diagnostics.bboxSize.y) < threshold &&
    Math.abs(diagnostics.bboxSize.z) < threshold
  );
}

async function parseManifestEntry(entry: JSZip.JSZipObject): Promise<TbkManifest | null> {
  return (await parseJsonFile<TbkManifest>(entry)) ?? null;
}

async function parseJsonFile<T = unknown>(entry: JSZip.JSZipObject): Promise<T | null> {
  try {
    const text = await entry.async('string');
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('[BIM] Failed to parse TBK JSON', error);
    return null;
  }
}

function findEntryByPath(entries: JSZip.JSZipObject[], target: string | null | undefined) {
  if (!target) return null;
  const normalized = normalizeZipPath(target);
  return (
    entries.find((entry) => normalizeZipPath(entry.name) === normalized) ||
    entries.find((entry) => normalizeZipPath(entry.name).endsWith(normalized))
  ) ?? null;
}

function normalizeZipPath(value: string) {
  return value.replace(/^[./\\]+/, '').toLowerCase();
}

function findFirstModelEntry(entries: JSZip.JSZipObject[]) {
  const glbOrGltf = entries.find((entry) => /\.(glb|gltf)$/i.test(entry.name));
  if (glbOrGltf) return glbOrGltf;
  return entries.find((entry) => /\.ifc$/i.test(entry.name)) ?? null;
}

function listSampleEntries(entries: JSZip.JSZipObject[], limit = 20) {
  if (!entries.length) return 'none';
  return entries
    .slice(0, limit)
    .map((entry) => entry.name)
    .join(', ');
}

function collectAssetRefsFromJson(data: unknown, keyHint?: string, acc: Set<string> = new Set()) {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return acc;
    if (MODEL_FILE_REGEX.test(trimmed) || isLikelyAssetField(keyHint)) {
      acc.add(trimmed);
    }
    return acc;
  }
  if (Array.isArray(data)) {
    data.forEach((item) => collectAssetRefsFromJson(item, keyHint, acc));
    return acc;
  }
  if (data && typeof data === 'object') {
    Object.entries(data as Record<string, unknown>).forEach(([childKey, value]) => {
      collectAssetRefsFromJson(value, childKey, acc);
    });
  }
  return acc;
}

function isLikelyAssetField(key?: string) {
  if (!key) return false;
  const lower = key.toLowerCase();
  return (
    lower.includes('url') ||
    lower.includes('uri') ||
    lower.includes('href') ||
    lower.includes('model') ||
    lower.includes('glb') ||
    lower.includes('ifc') ||
    lower === 'file' ||
    lower === 'files' ||
    lower === 'assets' ||
    lower.endsWith('path')
  );
}

function detectModelType(value: string | null | undefined): 'gltf' | 'ifc' {
  if (!value) return 'gltf';
  return /\.ifc$/i.test(value) ? 'ifc' : 'gltf';
}

async function fetchExternalAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch referenced asset (${response.status})`);
  }
  return response.arrayBuffer();

}
