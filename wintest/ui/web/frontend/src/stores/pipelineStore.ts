import { create } from 'zustand';
import type { Pipeline, PipelineListItem, SchedulerStatus } from '../api/types';
import { pipelineApi } from '../api/client';

interface PipelineState {
  pipelines: PipelineListItem[];
  currentPipeline: Pipeline | null;
  schedulerStatus: SchedulerStatus;
  loading: boolean;

  fetchPipelines: () => Promise<void>;
  fetchPipeline: (filename: string) => Promise<void>;
  savePipeline: (pipeline: Pipeline, filename?: string) => Promise<string>;
  deletePipeline: (filename: string) => Promise<void>;
  setEnabled: (filename: string, enabled: boolean) => Promise<void>;
  fetchSchedulerStatus: () => Promise<void>;
  startScheduler: () => Promise<{ started: boolean; reason?: string; pid?: number; exit_code?: number; error?: string }>;
  stopScheduler: () => Promise<{ stopped: boolean; forced?: boolean; reason?: string }>;
  setCurrentPipeline: (pipeline: Pipeline | null) => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  pipelines: [],
  currentPipeline: null,
  schedulerStatus: { running: false, pid: null, started_at: null, current_run: null },
  loading: false,

  fetchPipelines: async () => {
    set({ loading: true });
    const pipelines = await pipelineApi.list();
    set({ pipelines, loading: false });
  },

  fetchPipeline: async (filename: string) => {
    set({ loading: true });
    const pipeline = await pipelineApi.get(filename);
    set({ currentPipeline: pipeline, loading: false });
  },

  savePipeline: async (pipeline, filename) => {
    if (filename) {
      await pipelineApi.update(filename, pipeline);
      return filename;
    }
    const res = await pipelineApi.create(pipeline);
    return res.filename;
  },

  deletePipeline: async (filename) => {
    await pipelineApi.delete(filename);
    set((state) => ({
      pipelines: state.pipelines.filter(p => p.filename !== filename),
    }));
  },

  setEnabled: async (filename, enabled) => {
    await pipelineApi.setEnabled(filename, enabled);
    set((state) => ({
      pipelines: state.pipelines.map(p =>
        p.filename === filename ? { ...p, enabled } : p
      ),
    }));
  },

  fetchSchedulerStatus: async () => {
    const schedulerStatus = await pipelineApi.schedulerStatus();
    set({ schedulerStatus });
  },

  startScheduler: async () => {
    const res = await pipelineApi.startScheduler();
    // Refresh status shortly after — give the process a moment to write its PID
    setTimeout(async () => {
      const s = await pipelineApi.schedulerStatus();
      set({ schedulerStatus: s });
    }, 1500);
    return res;
  },

  stopScheduler: async () => {
    const res = await pipelineApi.stopScheduler();
    const s = await pipelineApi.schedulerStatus();
    set({ schedulerStatus: s });
    return res;
  },

  setCurrentPipeline: (pipeline) => set({ currentPipeline: pipeline }),
}));
