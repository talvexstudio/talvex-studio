import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IFCLoader } from '../../vendor/three/examples/jsm/loaders/IFCLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { prepareContextPayload } from '../../shared/context/prepareContextPayload';
import { ContextSnapshot, useContextStore } from '../../shared/stores/contextStore';
import { useScenariosStore } from '../../shared/stores/scenariosStore';
import { ScenarioOption } from '../../shared/types';
import { RendererHost } from '../../shared/three/RendererHost';
import { createModelsTBKArchive, ModelsTBKManifest, parseModelsTBKFile } from '../../shared/utils/tbkModels';
import { parseTBKFile } from '../../shared/utils/tbk';
import { inspectTBKFile } from '../../shared/utils/tbkDetect';
import { ArrowRight, Download, RefreshCw } from '../../shared/ui/icons';
import './scenarios.css';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function ModelsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tbkInputRef = useRef<HTMLInputElement | null>(null);
  const [modelObject, setModelObject] = useState<Object3D | null>(null);
  const [modelBytes, setModelBytes] = useState<Uint8Array | null>(null);
  const [modelAssetType, setModelAssetType] = useState<'glb' | 'gltf' | null>(null);
  const [modelFilename, setModelFilename] = useState('');
  const [modelSourceType, setModelSourceType] = useState<'glb' | 'gltf' | 'ifc' | null>(null);
  const [modelOriginalFilename, setModelOriginalFilename] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [replaceCandidate, setReplaceCandidate] = useState<ScenarioOption | null>(null);
  const [pendingTBKFile, setPendingTBKFile] = useState<File | null>(null);
  const [pendingTBKApplyContext, setPendingTBKApplyContext] = useState(false);
  const [confirmTBKLoadOpen, setConfirmTBKLoadOpen] = useState(false);
  const [confirmContextReplaceOpen, setConfirmContextReplaceOpen] = useState(false);
  const [confirmBlocksContextOpen, setConfirmBlocksContextOpen] = useState(false);
  const [blocksTBKHasContext, setBlocksTBKHasContext] = useState(false);
  const [pendingContextOnlySnapshot, setPendingContextOnlySnapshot] = useState<ContextSnapshot | null>(null);
  const [tbkLoadState, setTbkLoadState] = useState<{
    status: 'idle' | 'loading' | 'error';
    step: string;
    error: string;
  }>({
    status: 'idle',
    step: '',
    error: ''
  });
  const [contextRenderStatus, setContextRenderStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState('');
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendName, setSendName] = useState('');
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const tbkLoadRequestIdRef = useRef(0);
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
  const canSave = Boolean(modelObject);
  const hasContext = Boolean(center && buildings.length > 0);
  const isTBKLoading = tbkLoadState.status === 'loading';
  const showContextProgress =
    contextRenderStatus === 'loading' && (contextPayload?.length ?? 0) > 0 && !isTBKLoading;
  const showModelLoadProgress = loadStatus === 'loading' && !isTBKLoading;

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
      void loadModel(file, { resetTransform: true });
    }
    event.target.value = '';
  };

  const updateLoadProgress = (event: ProgressEvent<EventTarget>) => {
    if (event.lengthComputable && event.total > 0) {
      setLoadProgress(Math.round((event.loaded / event.total) * 100));
    } else {
      setLoadProgress(null);
    }
  };

  const resetTransformInputs = () => {
    setPosX(0);
    setPosY(0);
    setPosZ(0);
    setRotationZ(0);
  };

  const applyTransformInputs = (transform?: { x: number; y: number; z: number; rotZ: number } | null) => {
    if (!transform) {
      resetTransformInputs();
      return;
    }
    setPosX(transform.x);
    setPosY(transform.y);
    setPosZ(transform.z);
    setRotationZ(transform.rotZ);
  };

  const loadGltfModel = (file: File, sourceType: 'glb' | 'gltf', resetTransform: boolean) => {
    setLoadStatus('loading');
    setLoadError('');
    setLoadProgress(null);
    setModelBytes(null);
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
          setLoadProgress(null);
          return;
        }
        if (resetTransform) {
          resetTransformInputs();
        }
        setModelObject(scene);
        setModelAssetType(sourceType);
        setModelFilename(file.name);
        setModelSourceType(sourceType);
        setModelOriginalFilename(file.name);
        bufferPromise
          .then((buffer) => {
            setModelBytes(new Uint8Array(buffer));
          })
          .catch((error) => {
            console.error(error);
          });
        setLoadStatus('ready');
        setLoadProgress(null);
      },
      updateLoadProgress,
      (error) => {
        URL.revokeObjectURL(url);
        console.error(error);
        setLoadError('Failed to load model.');
        setLoadStatus('error');
        setLoadProgress(null);
      }
    );
  };

  const loadIfcModel = (file: File, resetTransform: boolean) => {
    setLoadStatus('loading');
    setLoadError('');
    setLoadProgress(null);
    setModelBytes(null);
    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath('/web-ifc/');
    const url = URL.createObjectURL(file);
    loader.load(
      url,
      (ifcModel) => {
        URL.revokeObjectURL(url);
        if (resetTransform) {
          resetTransformInputs();
        }
        setModelObject(ifcModel);
        setModelBytes(null);
        setModelAssetType(null);
        setModelFilename('');
        setModelSourceType('ifc');
        setModelOriginalFilename(file.name);
        setLoadStatus('ready');
        setLoadProgress(null);
      },
      updateLoadProgress,
      (error) => {
        URL.revokeObjectURL(url);
        console.error(error);
        setLoadError('Failed to load IFC model.');
        setLoadStatus('error');
        setLoadProgress(null);
      }
    );
  };

  const loadModel = async (file: File, options?: { resetTransform?: boolean }) => {
    const sourceType = getSourceTypeFromFilename(file.name);
    if (!sourceType) {
      setLoadError('Unsupported file type.');
      setLoadStatus('error');
      setLoadProgress(null);
      return;
    }
    const shouldReset = options?.resetTransform ?? false;
    if (sourceType === 'ifc') {
      loadIfcModel(file, shouldReset);
    } else {
      loadGltfModel(file, sourceType, shouldReset);
    }
  };

  const confirmReplace = () => {
    if (pendingFile) {
      void loadModel(pendingFile, { resetTransform: true });
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

  const exportModelToGLB = (model: Object3D) =>
    new Promise<Uint8Array>((resolve, reject) => {
      const exporter = new GLTFExporter();
      exporter.parse(
        model,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(new Uint8Array(result));
          } else {
            reject(new Error('GLB export failed.'));
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    });

  const handleSend = async (nameOverride?: string) => {
    if (!modelObject) return;
    let modelForScenario = modelObject;
    if (modelSourceType === 'ifc') {
      try {
        let glbBytes = modelBytes;
        if (!glbBytes || modelAssetType !== 'glb') {
          glbBytes = await exportModelToGLB(modelObject);
          setModelBytes(glbBytes);
          setModelAssetType('glb');
          const assetFilename = deriveAssetFilename(modelOriginalFilename || modelFilename, 'glb');
          setModelFilename(assetFilename);
        }
        modelForScenario = await loadModelFromBytes(glbBytes, 'glb');
      } catch (error) {
        console.error(error);
      }
    } else if (modelBytes && modelAssetType) {
      try {
        modelForScenario = await loadModelFromBytes(modelBytes, modelAssetType);
      } catch (error) {
        console.error(error);
      }
    }
    const option = buildScenarioOption({
      model: modelForScenario,
      filename: modelSourceType === 'ifc' ? modelOriginalFilename : modelFilename,
      transform: { x: posX, y: posY, z: posZ, rotZ: rotationZ },
      name: nameOverride
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

  const getDefaultOptionName = () => {
    const baseName = stripExtension(modelOriginalFilename || modelFilename);
    return baseName || `Option ${scenarios.length + 1}`;
  };

  const openSendModal = () => {
    if (!canSend) return;
    setSendName(getDefaultOptionName());
    setSendModalOpen(true);
  };

  const closeSendModal = () => {
    setSendModalOpen(false);
  };

  const confirmSend = () => {
    const finalName = sendName.trim() || getDefaultOptionName();
    void handleSend(finalName);
    setSendModalOpen(false);
  };

  const handleSaveTBK = async () => {
    setLoadError('');
    console.info('[Models][TBK] save start');
    if (!modelObject) {
      setLoadError('No model available to save.');
      setLoadStatus('error');
      console.error('[Models][TBK] save fail');
      return;
    }
    let assetBytes = modelBytes;
    let assetType = modelAssetType;
    let assetFilename = modelFilename;
    if (modelSourceType === 'ifc') {
      if (!assetBytes || assetType !== 'glb') {
        try {
          assetBytes = await exportModelToGLB(modelObject);
          assetType = 'glb';
          assetFilename = deriveAssetFilename(modelOriginalFilename || modelFilename, 'glb');
          setModelBytes(assetBytes);
          setModelAssetType(assetType);
          setModelFilename(assetFilename);
        } catch {
          setLoadError('Failed to export IFC model.');
          setLoadStatus('error');
          console.error('[Models][TBK] save fail');
          return;
        }
      }
    }
    if (!assetBytes || !assetType) {
      setLoadError('No model asset available to save.');
      setLoadStatus('error');
      console.error('[Models][TBK] save fail');
      return;
    }
    const manifest: ModelsTBKManifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      kind: 'models',
      sourceType: assetType,
      filename: assetFilename || `model.${assetType}`,
      originalSource: modelSourceType === 'ifc' ? 'ifc' : undefined,
      originalFilename: modelSourceType === 'ifc' ? modelOriginalFilename : undefined,
      transform: {
        x: posX,
        y: posY,
        z: posZ,
        rotZ: rotationZ
      }
    };
    const contextSnapshot = getSnapshotForSave();
    try {
      const blob = await createModelsTBKArchive(manifest, assetBytes, contextSnapshot);
      const timestamp = new Date().toISOString().replace(/-|:|T/g, '').slice(0, 14);
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
      const inspection = await inspectTBKFile(file);
      if (inspection.kind === 'blocks') {
        setPendingTBKFile(file);
        setBlocksTBKHasContext(inspection.hasContext);
        setConfirmBlocksContextOpen(true);
        return;
      }
      if (inspection.kind !== 'models') {
        setLoadError('Unsupported TBK format.');
        setLoadStatus('error');
        return;
      }
      setPendingTBKFile(file);
      setPendingTBKApplyContext(inspection.hasContext);
      if (inspection.hasContext && hasContext) {
        setConfirmContextReplaceOpen(true);
      } else {
        setConfirmTBKLoadOpen(true);
      }
    } catch (error) {
      console.error(error);
      setLoadError('Unable to read TBK file.');
      setLoadStatus('error');
    } finally {
      event.target.value = '';
    }
  };

  const confirmTBKLoad = async () => {
    if (!pendingTBKFile) return;
    const file = pendingTBKFile;
    const applyContext = pendingTBKApplyContext;
    setConfirmTBKLoadOpen(false);
    setPendingTBKFile(null);
    setPendingTBKApplyContext(false);
    const requestId = tbkLoadRequestIdRef.current + 1;
    tbkLoadRequestIdRef.current = requestId;
    setTbkLoadState({ status: 'loading', step: 'Reading TBK…', error: '' });
    setLoadStatus('loading');
    setLoadError('');
    setLoadProgress(null);
    try {
      const parsed = await parseModelsTBKFile(file);
      if (tbkLoadRequestIdRef.current !== requestId) return;
      setTbkLoadState({ status: 'loading', step: 'Extracting TBK contents…', error: '' });
      if (!parsed.modelBytes) {
        setLoadError('TBK file missing model asset.');
        setLoadStatus('error');
        setTbkLoadState({ status: 'error', step: '', error: 'TBK file missing model asset.' });
        return;
      }
      if (applyContext && parsed.context) {
        setTbkLoadState({ status: 'loading', step: 'Applying context…', error: '' });
        setSnapshot(parsed.context);
      }
      setTbkLoadState({ status: 'loading', step: 'Loading model…', error: '' });
      const scene = await loadModelFromBytes(parsed.modelBytes, parsed.manifest.sourceType);
      if (tbkLoadRequestIdRef.current !== requestId) return;
      applyTransformInputs(parsed.manifest.transform);
      setModelObject(scene);
      setModelBytes(parsed.modelBytes);
      setModelAssetType(parsed.manifest.sourceType);
      setModelFilename(parsed.manifest.filename);
      setModelSourceType(parsed.manifest.originalSource ?? parsed.manifest.sourceType);
      setModelOriginalFilename(parsed.manifest.originalFilename ?? parsed.manifest.filename);
      setLoadStatus('ready');
      setTbkLoadState({ status: 'idle', step: '', error: '' });
    } catch (error) {
      console.error(error);
      if (tbkLoadRequestIdRef.current !== requestId) return;
      setLoadError('Failed to load TBK file.');
      setLoadStatus('error');
      setTbkLoadState({ status: 'error', step: '', error: 'Failed to load TBK file.' });
    }
  };

  const cancelTBKLoad = () => {
    setConfirmTBKLoadOpen(false);
    setPendingTBKFile(null);
    setPendingTBKApplyContext(false);
  };

  const confirmContextReplace = () => {
    if (pendingContextOnlySnapshot) {
      setSnapshot(pendingContextOnlySnapshot);
      setPendingContextOnlySnapshot(null);
      setConfirmContextReplaceOpen(false);
      return;
    }
    if (!pendingTBKFile) return;
    setConfirmContextReplaceOpen(false);
    setPendingTBKApplyContext(true);
    setConfirmTBKLoadOpen(true);
  };

  const keepCurrentContext = () => {
    if (pendingContextOnlySnapshot) {
      setPendingContextOnlySnapshot(null);
      setConfirmContextReplaceOpen(false);
      return;
    }
    if (!pendingTBKFile) return;
    setConfirmContextReplaceOpen(false);
    setPendingTBKApplyContext(false);
    setConfirmTBKLoadOpen(true);
  };

  const closeTBKLoadError = () => {
    setTbkLoadState({ status: 'idle', step: '', error: '' });
  };

  const confirmBlocksContextImport = async () => {
    if (!pendingTBKFile) return;
    setConfirmBlocksContextOpen(false);
    const file = pendingTBKFile;
    setPendingTBKFile(null);
    setPendingTBKApplyContext(false);
    if (!blocksTBKHasContext) {
      setLoadError('TBK file has no context to import.');
      setLoadStatus('error');
      setBlocksTBKHasContext(false);
      return;
    }
    try {
      const { context } = await parseTBKFile(file);
      if (!context) {
        setLoadError('TBK file has no context to import.');
        setLoadStatus('error');
        setBlocksTBKHasContext(false);
        return;
      }
      if (hasContext) {
        setPendingContextOnlySnapshot(context);
        setConfirmContextReplaceOpen(true);
      } else {
        setSnapshot(context);
      }
      setBlocksTBKHasContext(false);
    } catch (error) {
      console.error(error);
      setLoadError('Unable to read TBK file.');
      setLoadStatus('error');
      setBlocksTBKHasContext(false);
    }
  };

  const cancelBlocksContextImport = () => {
    setConfirmBlocksContextOpen(false);
    setPendingTBKFile(null);
    setBlocksTBKHasContext(false);
    setPendingTBKApplyContext(false);
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

            {showModelLoadProgress && (
              <div className="flex flex-col gap-1 text-xs text-[#2563eb]">
                <span>
                  Loading model{typeof loadProgress === 'number' ? ` (${loadProgress}%)` : ''}
                </span>
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
              onClick={openSendModal}
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
        accept=".glb,.gltf,.ifc,model/gltf-binary,model/gltf+json,application/ifc"
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

      {tbkLoadState.status !== 'idle' && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Loading TBK…</h3>
            {tbkLoadState.status === 'loading' ? (
              <div className="flex flex-col gap-2 text-sm text-slate-600">
                <span>{tbkLoadState.step}</span>
                <div className="imagegen-progress">
                  <div className="imagegen-progress-bar" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <span className="text-red-600">{tbkLoadState.error}</span>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeTBKLoadError}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {sendModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Send option to Scenarios</h3>
            <p className="text-sm text-slate-600 mb-3">Name the scenario before sending it to the board.</p>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
              Scenario name
              <input
                type="text"
                value={sendName}
                onChange={(event) => setSendName(event.target.value)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 shadow-inner focus:border-[#2563eb] focus:outline-none"
                placeholder="Scenario option"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSendModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSend}
                onClick={confirmSend}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
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

      {confirmContextReplaceOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <p className="text-sm text-slate-700 mb-4">
              Scenario context is fixed for this study. Replace current Scenario context with TBK context?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmContextReplace}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={keepCurrentContext}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Keep current
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBlocksContextOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <p className="text-sm text-slate-700 mb-3">
              This TBK was created in Blocks and contains no GLB or IFC model. Do you want to import the context of this TBK?
            </p>
            {!blocksTBKHasContext && (
              <p className="text-xs text-slate-500 mb-3">No context snapshot was found in this TBK.</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmBlocksContextImport}
                disabled={!blocksTBKHasContext}
                className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={cancelBlocksContextImport}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTBKLoadOpen && pendingTBKFile && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="text-lg font-semibold mb-2">Load model from TBK?</h3>
            <p className="text-sm text-slate-600 mb-2">This will replace your current model.</p>
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

function getSourceTypeFromFilename(filename: string): 'glb' | 'gltf' | 'ifc' | null {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith('.glb')) return 'glb';
  if (normalized.endsWith('.gltf')) return 'gltf';
  if (normalized.endsWith('.ifc')) return 'ifc';
  return null;
}

function stripExtension(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) return '';
  const index = trimmed.lastIndexOf('.');
  return index > 0 ? trimmed.slice(0, index) : trimmed;
}

function deriveAssetFilename(originalFilename: string, assetType: 'glb' | 'gltf') {
  const baseName = stripExtension(originalFilename);
  const safeBase = baseName || 'model';
  return `${safeBase}.${assetType}`;
}

function buildScenarioOption({
  model,
  filename,
  transform,
  name
}: {
  model: Object3D;
  filename: string;
  transform: { x: number; y: number; z: number; rotZ: number };
  name?: string;
}): ScenarioOption {
  const baseName = stripExtension(filename);
  const resolvedName = name?.trim() || baseName || `Model option ${new Date().toLocaleTimeString()}`;
  return {
    id: nanoid(),
    name: resolvedName,
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
