import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareContextPayload } from '../../shared/context/prepareContextPayload';
import { ContextSnapshot, useContextStore } from '../../shared/stores/contextStore';
import { useScenariosStore } from '../../shared/stores/scenariosStore';
import { ScenarioOption } from '../../shared/types';
import { RendererHost } from '../../shared/three/RendererHost';
import { createModelsTBKArchive, ModelsTBKManifest, parseModelsTBKFile } from '../../shared/utils/tbkModels';
import { ArrowRight, Download, RefreshCw } from '../../shared/ui/icons';
import './scenarios.css';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function ModelsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tbkInputRef = useRef<HTMLInputElement | null>(null);
  const [modelObject, setModelObject] = useState<Object3D | null>(null);
  const [modelBytes, setModelBytes] = useState<Uint8Array | null>(null);
  const [modelFilename, setModelFilename] = useState('');
  const [modelSourceType, setModelSourceType] = useState<'glb' | 'gltf' | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [replaceCandidate, setReplaceCandidate] = useState<ScenarioOption | null>(null);
  const [pendingTBK, setPendingTBK] = useState<{
    manifest: ModelsTBKManifest;
    modelBytes?: Uint8Array;
    context: ContextSnapshot | null;
  } | null>(null);
  const [confirmTBKLoadOpen, setConfirmTBKLoadOpen] = useState(false);
  const [contextRenderStatus, setContextRenderStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState('');
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const center = useContextStore((state) => state.center);
  const radiusM = useContextStore((state) => state.radiusM);
  const buildings = useContextStore((state) => state.buildings);
  const lastFetchedKey = useContextStore((state) => state.lastFetchedKey);
  const getSnapshotForSave = useContextStore((state) => state.getSnapshotForSave);
  const setSnapshot = useContextStore((state) => state.setSnapshot);
  const scenarios = useScenariosStore((state) => state.options);
  const addScenario = useScenariosStore((state) => state.addOption);
  const replaceScenario = useScenariosStore((state) => state.replaceOption);
  const selectScenario = useScenariosStore((state) => state.selectOption);

  const contextPayload = useMemo(() => {
    if (!center || buildings.length === 0) return null;
    const { payload } = prepareContextPayload(center, buildings, lastFetchedKey ?? '', radiusM);
    return payload;
  }, [center, buildings, lastFetchedKey, radiusM]);

  const modelTransform = useMemo(
    () => ({
      position: {
        x: posX,
        y: posZ,
        z: posY
      },
      rotationY: rotationZ
    }),
    [posX, posY, posZ, rotationZ]
  );

  const canSend = Boolean(modelObject);
  const canSave = Boolean(modelBytes && modelSourceType);
  const hasContext = Boolean(center && buildings.length > 0);
  const showContextProgress = contextRenderStatus === 'loading' && (contextPayload?.length ?? 0) > 0;

  const openFilePicker = () => {
    if (loadStatus === 'loading') return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (modelObject) {
      setPendingFile(file);
      setConfirmReplaceOpen(true);
    } else {
      void loadModel(file);
    }
    event.target.value = '';
  };

  const loadModel = async (file: File) => {
    const sourceType = getSourceTypeFromFilename(file.name);
    if (!sourceType) {
      setLoadError('Unsupported file type.');
      setLoadStatus('error');
      return;
    }
    setLoadStatus('loading');
    setLoadError('');
    const bufferPromise = file.arrayBuffer();
    const loader = new GLTFLoader();
    const url = URL.createObjectURL(file);
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const scene = gltf.scene ?? gltf.scenes?.[0];
        if (!scene) {
          setLoadError('No scene found in this model.');
          setLoadStatus('error');
          return;
        }
        setModelObject(scene);
        bufferPromise
          .then((buffer) => {
            setModelBytes(new Uint8Array(buffer));
            setModelFilename(file.name);
            setModelSourceType(sourceType);
          })
          .catch((error) => {
            console.error(error);
          });
        setLoadStatus('ready');
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url);
        console.error(error);
        setLoadError('Failed to load model.');
        setLoadStatus('error');
      }
    );
  };

  const confirmReplace = () => {
    if (pendingFile) {
      void loadModel(pendingFile);
    }
    setPendingFile(null);
    setConfirmReplaceOpen(false);
  };

  const cancelReplace = () => {
    setPendingFile(null);
    setConfirmReplaceOpen(false);
  };

  const loadModelFromBytes = (bytes: Uint8Array, sourceType: 'glb' | 'gltf') =>
    new Promise<Object3D>((resolve, reject) => {
      const loader = new GLTFLoader();
      const buffer = (
        bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
          ? bytes.buffer
          : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      ) as ArrayBuffer;
      const payload = sourceType === 'glb' ? buffer : new TextDecoder().decode(buffer);
      loader.parse(
        payload,
        '',
        (gltf) => {
          const scene = gltf.scene ?? gltf.scenes?.[0];
          if (!scene) {
            reject(new Error('No scene found in this model.'));
            return;
          }
          resolve(scene);
        },
        (error) => reject(error)
      );
    });

  const handleSend = async () => {
    if (!modelObject) return;
    let modelForScenario = modelObject;
    if (modelBytes && modelSourceType) {
      try {
        modelForScenario = await loadModelFromBytes(modelBytes, modelSourceType);
      } catch (error) {
        console.error(error);
      }
    }
    const option = buildScenarioOption({
      model: modelForScenario,
      filename: modelFilename,
      transform: { x: posX, y: posY, z: posZ, rotZ: rotationZ }
    });
    if (scenarios.length < 3) {
      addScenario(option);
      selectScenario(option.id);
      navigate('/scenarios');
    } else {
      setReplaceCandidate(option);
    }
  };

  const handleReplace = (targetId: string) => {
    if (!replaceCandidate) return;
    replaceScenario(targetId, replaceCandidate);
    selectScenario(replaceCandidate.id);
    setReplaceCandidate(null);
    navigate('/scenarios');
  };

  const handleSaveTBK = async () => {
    setLoadError('');
    console.info('[Models][TBK] save start');
    if (!modelBytes || !modelSourceType) {
      setLoadError('No model asset available to save.');
      setLoadStatus('error');
      console.error('[Models][TBK] save fail');
      return;
    }
    const manifest: ModelsTBKManifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      kind: 'models',
      sourceType: modelSourceType,
      filename: modelFilename || `model.${modelSourceType}`,
      transform: {
        x: posX,
        y: posY,
        z: posZ,
        rotZ: rotationZ
      }
    };
    const contextSnapshot = getSnapshotForSave();
    try {
      const blob = await createModelsTBKArchive(manifest, modelBytes, contextSnapshot);
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${timestamp}_Talvex_model.TBK`;
      link.click();
      URL.revokeObjectURL(url);
      console.info('[Models][TBK] save ok');
    } catch {
      console.error('[Models][TBK] save fail');
      setLoadError('Failed to save TBK file.');
      setLoadStatus('error');
    }
  };

  const handleTBKLoad = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadError('');
    try {
      const parsed = await parseModelsTBKFile(file);
      if (!parsed.modelBytes) {
        setLoadError('TBK file missing model asset.');
        setLoadStatus('error');
        return;
      }
      setPendingTBK(parsed);
      setConfirmTBKLoadOpen(true);
    } catch (error) {
      console.error(error);
      setLoadError('Invalid TBK file.');
      setLoadStatus('error');
    } finally {
      event.target.value = '';
    }
  };

  const confirmTBKLoad = async () => {
    if (!pendingTBK) return;
    const { manifest, modelBytes: bytes, context } = pendingTBK;
    setConfirmTBKLoadOpen(false);
    setPendingTBK(null);
    if (context) {
      setSnapshot(context);
    }
    if (!bytes) {
      setLoadError('TBK file missing model asset.');
      setLoadStatus('error');
      return;
    }
    setPosX(manifest.transform.x);
    setPosY(manifest.transform.y);
    setPosZ(manifest.transform.z);
    setRotationZ(manifest.transform.rotZ);
    setLoadStatus('loading');
    setLoadError('');
    try {
      const scene = await loadModelFromBytes(bytes, manifest.sourceType);
      setModelObject(scene);
      setModelBytes(bytes);
      setModelFilename(manifest.filename);
      setModelSourceType(manifest.sourceType);
      setLoadStatus('ready');
    } catch (error) {
      console.error(error);
      setLoadError('Failed to load model.');
      setLoadStatus('error');
    }
  };

  const cancelTBKLoad = () => {
    setPendingTBK(null);
    setConfirmTBKLoadOpen(false);
  };

  const modelLoaded = Boolean(modelObject);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:items-stretch gap-6">
        <section className="flex-1 min-h-0 rounded-[24px] border border-slate-200 bg-white shadow relative">
          <RendererHost
            context={contextPayload}
            contextRadiusM={radiusM}
            externalModel={modelObject}
            externalModelTransform={modelTransform}
            onContextStatus={setContextRenderStatus}
            className="w-full h-full rounded-[24px] overflow-hidden bg-[#f4f6fb]"
          />
        </section>

        <aside className="w-full lg:max-w-[420px] lg:self-stretch rounded-[24px] border border-slate-200 bg-white shadow flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto p-6 flex flex-col gap-5">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Talvex Models</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                disabled={loadStatus === 'loading'}
              >
                Load model
              </button>
            </div>
            <div className="flex flex-col text-xs text-slate-500">
              {center ? (
                <span>
                  Context: set ({center.lat.toFixed(4)}, {center.lon.toFixed(4)}) - {radiusM} m
                </span>
              ) : (
                <span>Context: not set</span>
              )}
              {center && buildings.length > 0 && <span>{buildings.length} buildings loaded</span>}
              {showContextProgress && (
                <div className="mt-2 flex flex-col gap-1 text-xs text-[#2563eb]">
                  <span>Fetching context buildings</span>
                  <div className="imagegen-progress">
                    <div className="imagegen-progress-bar" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Transform</div>
              <p className="text-xs text-slate-500">X/Y are horizontal, Z is vertical.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'X', value: posX, setter: setPosX },
                  { label: 'Y', value: posY, setter: setPosY },
                  { label: 'Z', value: posZ, setter: setPosZ }
                ].map((field) => (
                  <label key={field.label} className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {field.label}
                    <input
                      type="number"
                      step={0.1}
                      value={field.value}
                      onChange={(event) => field.setter(Number(event.target.value))}
                      disabled={!modelLoaded}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                Rotation Z
                <input
                  type="number"
                  step={0.5}
                  value={rotationZ}
                  onChange={(event) => setRotationZ(Number(event.target.value))}
                  disabled={!modelLoaded}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
            </div>

            {loadStatus === 'loading' && (
              <div className="flex flex-col gap-1 text-xs text-[#2563eb]">
                <span>Loading model</span>
                <div className="imagegen-progress">
                  <div className="imagegen-progress-bar" />
                </div>
              </div>
            )}
            {loadStatus === 'ready' && modelLoaded && <span className="text-xs text-green-600">Model loaded</span>}
            {loadStatus === 'error' && <span className="text-xs text-red-500">{loadError}</span>}
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-[#f9fafc] px-6 py-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="rounded-full bg-[#2f6dea] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(37,99,235,0.35)] transition hover:bg-[#2256c8]"
            >
              Send to Scenarios
              <ArrowRight className="text-white" />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveTBK}
                disabled={!canSave}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#4b5566] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download />
                Save .TBK
              </button>
              <button
                type="button"
                onClick={() => tbkInputRef.current?.click()}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#4b5566] flex items-center justify-center gap-2"
              >
                <RefreshCw />
                Load .TBK
              </button>
            </div>
          </div>
        </aside>
      </div>

      <input
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        accept=".TBK,application/json"
        ref={tbkInputRef}
        onChange={handleTBKLoad}
        className="hidden"
      />

      {confirmReplaceOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Replace the current model?</h3>
            <p className="text-sm text-slate-600 mb-4">Loading a new file will replace the current model.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmReplace}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={cancelReplace}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {replaceCandidate && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Replace an existing option?</h3>
            <p className="text-sm text-slate-600 mb-4">You already have three options. Choose one to replace.</p>
            <div className="flex flex-col gap-2 mb-4">
              {scenarios.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleReplace(option.id)}
                  className="rounded border border-slate-200 px-4 py-2 text-left hover:border-slate-400"
                >
                  <div className="text-sm font-semibold">{option.name}</div>
                  <div className="text-xs text-slate-500">{new Date(option.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setReplaceCandidate(null)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmTBKLoadOpen && pendingTBK && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Load model from TBK?</h3>
            <p className="text-sm text-slate-600 mb-2">This will replace your current model.</p>
            {pendingTBK.context && hasContext && (
              <p className="text-sm text-slate-600 mb-4">
                This TBK contains a context snapshot and will overwrite your current context.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmTBKLoad}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
              >
                Load
              </button>
              <button
                type="button"
                onClick={cancelTBKLoad}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getSourceTypeFromFilename(filename: string): 'glb' | 'gltf' | null {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith('.glb')) return 'glb';
  if (normalized.endsWith('.gltf')) return 'gltf';
  return null;
}

function stripExtension(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) return '';
  const index = trimmed.lastIndexOf('.');
  return index > 0 ? trimmed.slice(0, index) : trimmed;
}

function buildScenarioOption({
  model,
  filename,
  transform
}: {
  model: Object3D;
  filename: string;
  transform: { x: number; y: number; z: number; rotZ: number };
}): ScenarioOption {
  const baseName = stripExtension(filename);
  const name = baseName || `Model option ${new Date().toLocaleTimeString()}`;
  return {
    id: nanoid(),
    name,
    createdAt: new Date().toISOString(),
    source: 'models',
    externalModel: model,
    externalModelTransform: {
      position: {
        x: transform.x,
        y: transform.z,
        z: transform.y
      },
      rotationY: transform.rotZ
    },
    metrics: {
      totalGFA: 0,
      totalLevels: 0,
      maxHeight: 0,
      gfaByFunction: {},
      units: 'metric'
    }
  };
}
