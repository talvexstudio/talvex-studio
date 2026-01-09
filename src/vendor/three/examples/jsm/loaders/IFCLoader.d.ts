import { Loader, LoadingManager, Group } from 'three';

export class IFCLoader extends Loader {
  constructor(manager?: LoadingManager);
  load(
    url: string,
    onLoad: (model: Group) => void,
    onProgress?: (event: ProgressEvent<EventTarget>) => void,
    onError?: (event: ErrorEvent) => void
  ): void;
  parse(data: ArrayBuffer): Promise<Group>;
  ifcManager: {
    setWasmPath(path: string): void;
    dispose(): void;
  };
}
