import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Object3D } from 'three';
import { BlocksModel } from '../types';
import {
  createMassingRenderer,
  MassingRenderer,
  ContextMeshPayload,
  TransformMode,
  TransformCommit,
  ExternalModelTransform
} from './massingRenderer';

type RendererHostProps = {
  model?: BlocksModel | null;
  context?: ContextMeshPayload[] | null;
  contextRadiusM?: number;
  onContextStatus?: (status: 'loading' | 'ready') => void;
  autoSpin?: boolean;
  onReady?: (renderer: MassingRenderer | null) => void;
  className?: string;
  selectedBlockIds?: string[];
  onPickBlock?: (id: string | null, info?: { additive?: boolean }) => void;
  gumballEnabled?: boolean;
  gumballMode?: TransformMode;
  referenceBlockId?: string | null;
  onTransformCommit?: (payload: TransformCommit[]) => void;
  externalModel?: Object3D | null;
  externalModelTransform?: ExternalModelTransform;
};

export function RendererHost({
  model,
  context,
  contextRadiusM,
  onContextStatus,
  autoSpin = false,
  onReady,
  className,
  selectedBlockIds = [],
  onPickBlock,
  gumballEnabled = false,
  gumballMode = 'translate',
  referenceBlockId = null,
  onTransformCommit,
  externalModel,
  externalModelTransform
}: RendererHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<MassingRenderer | null>(null);
  const readyCallbackRef = useRef(onReady);
  const contextRequestIdRef = useRef(0);

  useEffect(() => {
    readyCallbackRef.current = onReady;
  }, [onReady]);

  useLayoutEffect(() => {
    if (!containerRef.current || rendererRef.current) return;
    const renderer = createMassingRenderer(containerRef.current);
    rendererRef.current = renderer;
    if (import.meta.env.DEV) {
      console.log('[RendererHost] mount', { instanceId: renderer.instanceId });
    }
    readyCallbackRef.current?.(renderer);
    return () => {
      if (import.meta.env.DEV) {
        console.log('[RendererHost] unmount', { instanceId: renderer.instanceId });
      }
      renderer.dispose();
      rendererRef.current = null;
      readyCallbackRef.current?.(null);
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;
    if (import.meta.env.DEV) {
      console.log('[RendererHost] apply model', { hasModel: !!model });
    }
    rendererRef.current.setModel(model ?? undefined);
  }, [model]);

  useEffect(() => {
    if (!rendererRef.current) return;
    if (import.meta.env.DEV) {
      console.log('[RendererHost] setContext', { isNull: !context, count: context?.length ?? 0 });
    }
    contextRequestIdRef.current += 1;
    const requestId = contextRequestIdRef.current;
    onContextStatus?.('loading');
    rendererRef.current
      .setContext(context ?? null, contextRadiusM)
      .then(() => {
        if (contextRequestIdRef.current === requestId) {
          onContextStatus?.('ready');
        }
      })
      .catch(() => {
        if (contextRequestIdRef.current === requestId) {
          onContextStatus?.('ready');
        }
      });
  }, [context, contextRadiusM, onContextStatus]);

  useEffect(() => {
    rendererRef.current?.setAutoSpin(!!autoSpin);
  }, [autoSpin]);

  useEffect(() => {
    rendererRef.current?.setSelectedBlocks(selectedBlockIds ?? []);
  }, [selectedBlockIds]);

  useEffect(() => {
    rendererRef.current?.setPickHandler(onPickBlock);
  }, [onPickBlock]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setExternalModel(externalModel ?? null);
  }, [externalModel]);

  useEffect(() => {
    if (!rendererRef.current || !externalModelTransform) return;
    rendererRef.current.setExternalModelTransform(externalModelTransform);
  }, [externalModelTransform]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setTransformOptions({
      enabled: gumballEnabled,
      mode: gumballMode,
      targetId: referenceBlockId,
      selectedIds: selectedBlockIds,
      onCommit: onTransformCommit
    });
  }, [gumballEnabled, gumballMode, referenceBlockId, onTransformCommit, selectedBlockIds]);

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}
