import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { BlocksModel, ScenarioOption } from '../types';
import { computeMetricsFromBlocksModel } from '../utils/metrics';

type ScenariosState = {
  options: ScenarioOption[];
  selectedOptionId?: string;
  addOption: (option: ScenarioOption) => void;
  replaceOption: (optionId: string, next: ScenarioOption) => void;
  selectOption: (id: string) => void;
  seedIfEmpty: () => void;
};

const defaultOption = (): ScenarioOption => {
  const model: BlocksModel = {
    schemaVersion: 1,
    units: 'metric',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: nanoid(),
        name: 'Block A',
        xSize: 20,
        ySize: 20,
        levels: 6,
        levelHeight: 3.2,
        posX: 0,
        posY: 0,
        posZ: 0,
        defaultFunction: 'Mixed'
      },
      {
        id: nanoid(),
        name: 'Block B',
        xSize: 15,
        ySize: 15,
        levels: 10,
        levelHeight: 3.2,
        posX: 30,
        posY: 0,
        posZ: 0,
        defaultFunction: 'Residential'
      }
    ]
  };

  return {
    id: nanoid(),
    name: 'Demo Option',
    createdAt: new Date().toISOString(),
    source: 'blocks',
    model,
    metrics: computeMetricsFromBlocksModel(model)
  };
};

export const useScenariosStore = create<ScenariosState>((set) => ({
  options: [],
  selectedOptionId: undefined,
  addOption: (option) =>
    set((state) => {
      if (state.options.length >= 3) return state;
      return {
        options: [...state.options, option],
        selectedOptionId: option.id
      };
    }),
  replaceOption: (optionId, next) =>
    set((state) => ({
      options: state.options.map((opt) => (opt.id === optionId ? next : opt)),
      selectedOptionId: next.id
    })),
  selectOption: (id) => set(() => ({ selectedOptionId: id })),
  seedIfEmpty: () =>
    set((state) => {
      if (state.options.length === 0) {
        const option = defaultOption();
        return { options: [option], selectedOptionId: option.id };
      }
      return state;
    })
}));
