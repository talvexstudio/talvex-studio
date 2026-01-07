import type { Object3D } from 'three';

export type Units = 'metric' | 'imperial';

export type BlockFunction = 'Retail' | 'Office' | 'Residential' | 'Mixed' | 'Others';

export interface BlockParams {
  id: string;
  name: string;
  xSize: number;
  ySize: number;
  levels: number;
  levelHeight: number;
  posX: number;
  posY: number;
  posZ: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  defaultFunction: BlockFunction;
}

export interface BlocksModel {
  schemaVersion: 1;
  units: Units;
  blocks: BlockParams[];
  createdAt: string;
}

export interface Metrics {
  totalGFA: number;
  totalLevels: number;
  maxHeight: number;
  gfaByFunction: Partial<Record<BlockFunction, number>>;
  units: Units;
}

export type ExternalModelTransform = {
  position: { x: number; y: number; z: number };
  rotationY: number;
};

type BlocksScenarioOption = {
  id: string;
  name: string;
  createdAt: string;
  source: 'blocks';
  model: BlocksModel;
  metrics: Metrics;
  externalModel?: never;
  externalModelTransform?: never;
};

type ModelsScenarioOption = {
  id: string;
  name: string;
  createdAt: string;
  source: 'models';
  model?: never;
  externalModel: Object3D;
  externalModelTransform: ExternalModelTransform;
  metrics: Metrics;
};

export type ScenarioOption = BlocksScenarioOption | ModelsScenarioOption;
