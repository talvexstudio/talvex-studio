import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BlocksModel, BlockFunction, Units } from '../types';
import { toMeters, fromMeters } from '../utils/units';

export const MAX_CONTEXT_BUILDINGS = 600;
const CONTEXT_BATCH_SIZE = 20;
const CONTEXT_COLOR = 0x48505f;
const DEBUG_CONTEXT = false;
let rendererInstanceCounter = 0;

export type ContextMeshPayload = {
  id: string;
  height: number;
  footprint: Array<[number, number]>;
};

type PickHandler = (blockId: string | null, info?: { additive?: boolean }) => void;
export type TransformMode = 'translate' | 'rotate';
export type TransformCommit = {
  id: string;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
};
export type ExternalModelTransform = {
  position: { x: number; y: number; z: number };
  rotationY: number;
};

export type MassingRenderer = {
  setModel: (model?: BlocksModel) => void;
  setAutoSpin: (enabled: boolean) => void;
  setSelectedBlocks: (blockIds: string[]) => void;
  setPickHandler: (handler?: PickHandler) => void;
  setContext: (payload: ContextMeshPayload[] | null | undefined, radiusM?: number) => Promise<number>;
  setExternalModel: (model: THREE.Object3D | null) => void;
  setExternalModelTransform: (transform: ExternalModelTransform) => void;
  frameContext: () => boolean;
  setTransformOptions: (options: {
    enabled: boolean;
    mode: TransformMode;
    targetId?: string | null;
    selectedIds?: string[];
    onCommit?: (payload: TransformCommit[]) => void;
  }) => void;
  dispose: () => void;
  instanceId: number;
};

export function createMassingRenderer(container: HTMLElement): MassingRenderer {
  const instanceId = ++rendererInstanceCounter;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x65788b);

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 400;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  camera.position.set(90, 80, 90);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 4, 0);

  let isTransformDragging = false;
  let transformOptions: {
    enabled: boolean;
    mode: TransformMode;
    targetId: string | null;
    selectedIds: string[];
    onCommit?: (payload: TransformCommit[]) => void;
  } = {
    enabled: false,
    mode: 'translate',
    targetId: null,
    selectedIds: [],
    onCommit: undefined
  };

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xf7f3e9, 0.95);
  directional.position.set(60, 120, 30);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.near = 1;
  directional.shadow.camera.far = 600;
  directional.shadow.camera.left = -200;
  directional.shadow.camera.right = 200;
  directional.shadow.camera.top = 200;
  directional.shadow.camera.bottom = -200;
  scene.add(directional);
  scene.add(directional.target);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50000, 50000),
    new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const massingGroup = new THREE.Group();
  scene.add(massingGroup);
  const contextGroup = new THREE.Group();
  contextGroup.position.y = -0.05;
  scene.add(contextGroup);
  const modelsGroup = new THREE.Group();
  scene.add(modelsGroup);
  const contextBounds = new THREE.Box3();
  if (DEBUG_CONTEXT && import.meta.env.DEV) {
    console.log(`[Renderer ${instanceId}] created`, { contextGroupId: contextGroup.uuid });
  }
  let bboxHelper: THREE.Box3Helper | null = null;
  if (DEBUG_CONTEXT && import.meta.env.DEV) {
    scene.add(new THREE.AxesHelper(20));
    bboxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xffff88);
    bboxHelper.visible = false;
    scene.add(bboxHelper);
  }

  const blockMeshes = new Map<string, THREE.Group>();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const selectionHelpers = new Map<string, THREE.BoxHelper>();
  const transformControls: any = new TransformControls(camera, renderer.domElement);
  transformControls.visible = false;
  transformControls.setMode(transformOptions.mode);
  transformControls.showX = transformControls.showY = transformControls.showZ = true;
  transformControls.setSpace('world');
  scene.add(transformControls);
  let highlightedIds: string[] = [];

  let autoSpin = false;
  let raf: number;
  let resizeObserver: ResizeObserver | undefined;
  let pickHandler: PickHandler | undefined;
  let contextBuildToken = 0;
  let currentUnits: Units = 'metric';
  const contextSize = new THREE.Vector3();
  const startTransforms = new Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>();
  let refStartPos: THREE.Vector3 | null = null;
  let refStartQuat: THREE.Quaternion | null = null;

  const cacheStartTransform = () => {
    startTransforms.clear();
    refStartPos = null;
    refStartQuat = null;
    if (!transformOptions.targetId) return;
    const refObj = blockMeshes.get(transformOptions.targetId);
    if (!refObj) return;
    refStartPos = new THREE.Vector3();
    refStartQuat = new THREE.Quaternion();
    refObj.getWorldPosition(refStartPos);
    refObj.getWorldQuaternion(refStartQuat);
    transformOptions.selectedIds.forEach((id) => {
      const obj = blockMeshes.get(id);
      if (!obj) return;
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      obj.getWorldPosition(pos);
      obj.getWorldQuaternion(quat);
      startTransforms.set(id, { pos, quat });
    });
  };

  const computeDelta = () => {
    if (!refStartPos || !refStartQuat || !transformOptions.targetId) return null;
    const refObj = blockMeshes.get(transformOptions.targetId);
    if (!refObj) return null;
    const curPos = new THREE.Vector3();
    const curQuat = new THREE.Quaternion();
    refObj.getWorldPosition(curPos);
    refObj.getWorldQuaternion(curQuat);
    if (transformOptions.mode === 'translate') {
      const deltaPos = curPos.clone().sub(refStartPos);
      const deltaQuat = new THREE.Quaternion(); // identity
      return { deltaPos, deltaQuat, pivot: refStartPos.clone() };
    }
    const deltaQuat = curQuat.clone().multiply(refStartQuat.clone().invert());
    const deltaPos = new THREE.Vector3(); // no translation in rotate mode
    return { deltaPos, deltaQuat, pivot: refStartPos.clone() };
  };

  const applyPreview = () => {
    const delta = computeDelta();
    if (!delta) return;
    const { deltaPos, deltaQuat, pivot } = delta;
    transformOptions.selectedIds.forEach((id) => {
      const obj = blockMeshes.get(id);
      const start = startTransforms.get(id);
      if (!obj || !start) return;
      if (id === transformOptions.targetId) return; // TransformControls already updates ref
      let newPos: THREE.Vector3;
      let newQuat: THREE.Quaternion;
      if (transformOptions.mode === 'translate') {
        newPos = start.pos.clone().add(deltaPos);
        newQuat = start.quat.clone();
      } else {
        const offset = start.pos.clone().sub(pivot).applyQuaternion(deltaQuat);
        newPos = pivot.clone().add(offset);
        newQuat = deltaQuat.clone().multiply(start.quat);
      }
      obj.position.copy(newPos);
      obj.quaternion.copy(newQuat);
      obj.updateMatrixWorld(true);
    });
  };

  const commitTransform = () => {
    const delta = computeDelta();
    if (!delta || !transformOptions.onCommit) return;
    const { deltaPos, deltaQuat, pivot } = delta;
    const payload: TransformCommit[] = [];
    transformOptions.selectedIds.forEach((id) => {
      const obj = blockMeshes.get(id);
      const start = startTransforms.get(id);
      if (!obj || !start) return;
      let newPos: THREE.Vector3;
      let newQuat: THREE.Quaternion;
      if (id === transformOptions.targetId) {
        newPos = new THREE.Vector3();
        obj.getWorldPosition(newPos);
        newQuat = new THREE.Quaternion();
        obj.getWorldQuaternion(newQuat);
      } else if (transformOptions.mode === 'translate') {
        newPos = start.pos.clone().add(deltaPos);
        newQuat = start.quat.clone();
      } else {
        const offset = start.pos.clone().sub(pivot).applyQuaternion(deltaQuat);
        newPos = pivot.clone().add(offset);
        newQuat = deltaQuat.clone().multiply(start.quat);
      }
      payload.push({
        id,
        position: { x: newPos.x, y: newPos.y, z: newPos.z },
        quaternion: { x: newQuat.x, y: newQuat.y, z: newQuat.z, w: newQuat.w }
      });
    });
    if (payload.length > 0) {
      transformOptions.onCommit(payload);
    }
    startTransforms.clear();
    refStartPos = null;
    refStartQuat = null;
  };

  const updateTransformTarget = () => {
    transformControls.detach();
    transformControls.visible = false;
    startTransforms.clear();
    refStartPos = null;
    refStartQuat = null;
    if (!transformOptions.enabled || !transformOptions.targetId) return;
    const target = blockMeshes.get(transformOptions.targetId);
    if (!target) return;
    transformControls.setMode(transformOptions.mode);
    transformControls.attach(target);
    transformControls.visible = true;
  };

  transformControls.addEventListener('dragging-changed', (event: any) => {
    isTransformDragging = event.value;
    controls.enabled = !event.value;
    if (event.value) {
      cacheStartTransform();
    } else {
      commitTransform();
    }
  });
  transformControls.addEventListener('mouseDown', () => {
    isTransformDragging = true;
  });
  transformControls.addEventListener('mouseUp', () => {
    isTransformDragging = false;
  });
  transformControls.addEventListener('change', () => {
    if (isTransformDragging) {
      applyPreview();
    }
  });

  const handleResize = () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  window.addEventListener('resize', handleResize);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
  }

  const animate = () => {
    raf = requestAnimationFrame(animate);
    if (autoSpin) {
      massingGroup.rotation.y += 0.002;
      contextGroup.rotation.y += 0.002;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const handlePointerDown = (event: PointerEvent) => {
    if (isTransformDragging || transformControls.dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes: THREE.Object3D[] = [];
    blockMeshes.forEach((group) => {
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          meshes.push(child);
        }
      });
    });
    const intersects = raycaster.intersectObjects(meshes, false);
    const additive = !!(event.ctrlKey || event.metaKey);
    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh & { userData: { blockId?: string } };
      if (mesh.userData.blockId) {
        pickHandler?.(mesh.userData.blockId, { additive });
        return;
      }
    }
    pickHandler?.(null, { additive });
  };

  renderer.domElement.addEventListener('pointerdown', handlePointerDown);

  const logContextChildren = (stage: string) => {
    if (!DEBUG_CONTEXT || !import.meta.env.DEV) return;
    console.log(`[Renderer ${instanceId}] ${stage}`, {
      contextChildren: contextGroup.children.length,
      contextGroupId: contextGroup.uuid
    });
  };

  const updateContextHelper = () => {
    if (!bboxHelper || !DEBUG_CONTEXT || !import.meta.env.DEV) return;
    bboxHelper.box.copy(contextBounds);
    bboxHelper.visible = !contextBounds.isEmpty();
  };

  const disposeSelectionHelper = (helper: THREE.BoxHelper) => {
    scene.remove(helper);
    helper.geometry.dispose();
    (helper.material as THREE.Material).dispose?.();
  };

  const applySelectionHighlight = () => {
    const active = new Set(highlightedIds);
    selectionHelpers.forEach((helper, id) => {
      if (!active.has(id) || !blockMeshes.get(id)) {
        disposeSelectionHelper(helper);
        selectionHelpers.delete(id);
      }
    });

    highlightedIds.forEach((id) => {
      const mesh = blockMeshes.get(id);
      if (!mesh) return;
      let helper = selectionHelpers.get(id);
      if (!helper) {
        helper = new THREE.BoxHelper(mesh, 0xffffff);
        const material = helper.material as THREE.LineBasicMaterial;
        material.depthTest = false;
        material.transparent = true;
        material.opacity = 0.9;
        material.color.set(0xffffff);
        selectionHelpers.set(id, helper);
        scene.add(helper);
      } else {
        helper.setFromObject(mesh);
        helper.visible = true;
      }
    });
  };

  const setModel = (model?: BlocksModel) => {
    logContextChildren('setModel/start');
    if (!model) {
      blockMeshes.forEach((group, id) => {
        massingGroup.remove(group);
        disposeObject(group);
        const helper = selectionHelpers.get(id);
        if (helper) {
          disposeSelectionHelper(helper);
          selectionHelpers.delete(id);
        }
      });
      blockMeshes.clear();
      highlightedIds = [];
      updateTransformTarget();
      return;
    }
    currentUnits = model.units;

    const leftover = new Set(blockMeshes.keys());

    model.blocks.forEach((block) => {
      leftover.delete(block.id);
      let container = blockMeshes.get(block.id);
      if (!container) {
        container = createBlockContainer(block.id);
        massingGroup.add(container);
        blockMeshes.set(block.id, container);
      }
      updateBlockContainer(container, block, model.units);
    });

    leftover.forEach((id) => {
      const container = blockMeshes.get(id);
      if (!container) return;
      massingGroup.remove(container);
      disposeObject(container);
      blockMeshes.delete(id);
      const helper = selectionHelpers.get(id);
      if (helper) {
        disposeSelectionHelper(helper);
        selectionHelpers.delete(id);
      }
    });

    applySelectionHighlight();
    updateTransformTarget();
    logContextChildren('setModel/end');
  };

  const updateCameraFar = (radiusM?: number) => {
    const baseFar = 2000;
    if (typeof radiusM === 'number' && Number.isFinite(radiusM) && radiusM > 0) {
      camera.far = Math.max(baseFar, radiusM * 6);
    } else if (!contextBounds.isEmpty()) {
      const size = contextBounds.getSize(contextSize);
      camera.far = Math.max(baseFar, size.length() * 2);
    } else {
      camera.far = baseFar;
    }
    camera.updateProjectionMatrix();
  };

  return {
    setModel,
    setAutoSpin: (enabled: boolean) => {
      autoSpin = enabled;
    },
    setSelectedBlocks: (blockIds: string[]) => {
      highlightedIds = blockIds.slice();
      applySelectionHighlight();
    },
    setPickHandler: (handler?: PickHandler) => {
      pickHandler = handler;
    },
    setContext: (payload: ContextMeshPayload[] | null | undefined, radiusM?: number) => {
      if (typeof payload === 'undefined') {
        if (import.meta.env?.DEV) {
          console.warn('[massingRenderer] setContext called with undefined payload.');
        }
        payload = null;
      }
      updateCameraFar(radiusM);
      console.info(
        `[Renderer][Context] set buildings=${payload?.length ?? 0} radius=${radiusM ?? 'n/a'} far=${camera.far}`
      );
      if (import.meta.env.DEV) {
        console.log(`[Renderer ${instanceId}] setContext called`, {
          isNull: !payload,
          receivedCount: payload?.length ?? 0
        });
      }
      contextBuildToken += 1;
      const token = contextBuildToken;
      if (!payload || payload.length === 0) {
        clearGroup(contextGroup);
        contextBounds.makeEmpty();
        contextGroup.updateMatrixWorld(true);
        updateCameraFar(radiusM);
        return Promise.resolve(0);
      }
      const nextContextGroup = new THREE.Group();
      return buildContextGeometry(payload, nextContextGroup, () => token === contextBuildToken, instanceId).then(
        (builtCount) => {
          if (token !== contextBuildToken) {
            clearGroup(nextContextGroup);
            return builtCount;
          }
          clearGroup(contextGroup);
          while (nextContextGroup.children.length > 0) {
            const child = nextContextGroup.children[0];
            contextGroup.add(child);
          }
          contextBounds.makeEmpty();
          if (contextGroup.children.length > 0) {
            contextBounds.expandByObject(contextGroup);
          }
          contextGroup.updateMatrixWorld(true);
          updateCameraFar(radiusM);
          if (import.meta.env.DEV) {
            const size = contextBounds.getSize(new THREE.Vector3());
            const center = contextBounds.getCenter(new THREE.Vector3());
            console.log('[Renderer] context bbox', {
              instanceId,
              contextChildren: contextGroup.children.length,
              contextGroupId: contextGroup.uuid,
              bboxMin: contextBounds.min.toArray(),
              bboxMax: contextBounds.max.toArray(),
              bboxSize: size.toArray(),
              bboxCenter: center.toArray()
            });
            console.log('[Renderer] context build summary', {
              instanceId,
              builtCount
            });
          }
          logContextChildren('setContext/after-build');
          updateContextHelper();
          return builtCount;
        }
      );
    },
    setExternalModel: (model: THREE.Object3D | null) => {
      clearGroup(modelsGroup);
      if (model) {
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        modelsGroup.add(model);
      }
      modelsGroup.updateMatrixWorld(true);
    },
    setExternalModelTransform: (transform: ExternalModelTransform) => {
      modelsGroup.position.set(transform.position.x, transform.position.y, transform.position.z);
      modelsGroup.rotation.set(0, THREE.MathUtils.degToRad(transform.rotationY), 0);
      modelsGroup.updateMatrixWorld(true);
    },
    frameContext: () => {
      if (contextGroup.children.length === 0 || contextBounds.isEmpty()) return false;
      const center = contextBounds.getCenter(new THREE.Vector3());
      const size = contextBounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.length(), 40);
      controls.target.copy(center);
      const offset = new THREE.Vector3(1, 0.6, 1).normalize().multiplyScalar(distance);
      camera.position.copy(center.clone().add(offset));
      camera.updateProjectionMatrix();
      controls.update();
      return true;
    },
    setTransformOptions: (options) => {
      transformOptions = {
        enabled: options.enabled,
        mode: options.mode,
        targetId: options.targetId ?? null,
        selectedIds: options.selectedIds ?? [],
        onCommit: options.onCommit
      };
      transformControls.setMode(transformOptions.mode);
      updateTransformTarget();
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      transformControls.detach();
      renderer.dispose();
      contextGroup.clear();
      clearGroup(modelsGroup);
      selectionHelpers.forEach((helper) => disposeSelectionHelper(helper));
      selectionHelpers.clear();
      highlightedIds = [];
      container.innerHTML = '';
    },
    instanceId
  };
}

function getBlockDimensions(block: BlocksModel['blocks'][number], units: BlocksModel['units']) {
  const width = toMeters(block.xSize, units);
  const depth = toMeters(block.ySize, units);
  const height = toMeters(block.levelHeight * block.levels, units);
  return { width, depth, height };
}

function createBlockContainer(blockId: string) {
  const group = new THREE.Group();
  group.userData.blockId = blockId;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.01, depthWrite: false })
  );
  hull.name = 'block-hull';
  hull.userData.blockId = blockId;
  hull.castShadow = false;
  hull.receiveShadow = false;
  group.add(hull);
  const floors = new THREE.Group();
  floors.name = 'block-floors';
  group.add(floors);
  return group;
}

function updateBlockContainer(group: THREE.Group, block: BlocksModel['blocks'][number], units: Units) {
  const { width, depth, height } = getBlockDimensions(block, units);
  const hull = group.getObjectByName('block-hull') as THREE.Mesh;
  if (hull) {
    hull.geometry.dispose();
    hull.geometry = new THREE.BoxGeometry(width, height, depth);
  }

  group.position.set(
    toMeters(block.posX, units),
    height / 2 + toMeters(block.posY, units),
    toMeters(block.posZ, units)
  );
  const rotX = THREE.MathUtils.degToRad(block.rotationX ?? 0);
  const rotY = THREE.MathUtils.degToRad(block.rotationY ?? 0);
  const rotZ = THREE.MathUtils.degToRad(block.rotationZ ?? 0);
  group.rotation.order = 'XYZ';
  group.rotation.set(rotX, rotY, rotZ);
  group.userData.blockId = block.id;

  const floors = group.getObjectByName('block-floors') as THREE.Group;
  const targetCount = Math.max(1, block.levels);
  while (floors.children.length > targetCount) {
    const child = floors.children.pop();
    if (child) {
      floors.remove(child);
      disposeObject(child);
    }
  }
  const baseColor = new THREE.Color(getFunctionColor(block.defaultFunction));
  const floorColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.2);
  const levelHeight = toMeters(block.levelHeight, units);
  const floorThickness = levelHeight * 0.9;

  while (floors.children.length < targetCount) {
    const material = new THREE.MeshStandardMaterial({
      color: floorColor,
      transparent: true,
      opacity: 0.8,
      roughness: 0.35,
      metalness: 0.08,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, floorThickness, depth), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.blockId = block.id;
    floors.add(mesh);
  }

  floors.children.forEach((child, index) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(width, floorThickness, depth);
    const centerOffset = -height / 2 + levelHeight * index + levelHeight / 2;
    mesh.position.set(0, centerOffset, 0);
    mesh.userData.blockId = block.id;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(floorColor);
    mat.opacity = 0.8;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((mat) => mat.dispose?.());
      } else {
        material?.dispose?.();
      }
    }
  });
}

function getFunctionColor(fn: BlockFunction) {
  switch (fn) {
    case 'Retail':
      return 0xd05b5b;
    case 'Office':
      return 0x4a83d4;
    case 'Residential':
      return 0xf1d45c;
    case 'Mixed':
      return 0x6dbd91;
    default:
      return 0xb1b1b1;
  }
}

function buildContextGeometry(
  payload: ContextMeshPayload[] | null,
  targetGroup: THREE.Group,
  isCurrent: () => boolean,
  instanceId: number
): Promise<number> {
  clearGroup(targetGroup);
  if (!payload || payload.length === 0) {
    if (import.meta.env.DEV) {
      console.log(`[Renderer ${instanceId}] buildContext start`, { receivedCount: 0 });
    }
    return Promise.resolve(0);
  }

  const items = payload.slice(0, MAX_CONTEXT_BUILDINGS);
  if (import.meta.env.DEV) {
    console.log(`[Renderer ${instanceId}] buildContext start`, { receivedCount: items.length });
  }
  let index = 0;
  let built = 0;

  const schedule = (fn: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(fn);
    } else {
      setTimeout(fn, 16);
    }
  };

  return new Promise((resolve) => {
    const processChunk = () => {
      if (!isCurrent()) {
        clearGroup(targetGroup);
        resolve(0);
        return;
      }

      const limit = Math.min(index + CONTEXT_BATCH_SIZE, items.length);
      for (; index < limit; index++) {
        const mesh = createContextMesh(items[index]);
        if (mesh) {
          targetGroup.add(mesh);
          built += 1;
        }
      }

      if (index < items.length) {
        schedule(processChunk);
      } else {
        if (built === 0 && import.meta.env.DEV) {
          items.slice(0, 3).forEach((item, idx) => {
            console.log(`[Renderer ${instanceId}] context item sample ${idx}`, {
              id: item.id,
              points: item.footprint.slice(0, 3)
            });
          });
        }
        resolve(built);
      }
    };

    processChunk();
  });
}

function createContextMesh(payload: ContextMeshPayload) {
  if (!payload.footprint || payload.footprint.length < 3 || !Number.isFinite(payload.height) || payload.height <= 0) {
    return null;
  }

  const shape = new THREE.Shape();
  payload.footprint.forEach(([x, z], index) => {
    const yCoord = -z;
    if (index === 0) {
      shape.moveTo(x, yCoord);
    } else {
      shape.lineTo(x, yCoord);
    }
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: payload.height, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: CONTEXT_COLOR,
      transparent: true,
      opacity: 0.9,
      roughness: 0.95,
      metalness: 0.05
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isContext = true;
  return mesh;
}

function clearGroup(group: THREE.Group) {
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
}
