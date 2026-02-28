import { create } from 'zustand';
import type { StepResultData, WsMessage } from '../api/types';
import { executionApi } from '../api/client';

interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  runId: string | null;
  taskName: string | null;
  currentStep: number;
  totalSteps: number;
  currentLabel: string | null;
  stepResults: StepResultData[];
  modelStatus: 'not_loaded' | 'loading' | 'loaded';
  error: string | null;

  handleWsMessage: (msg: WsMessage) => void;
  startRun: (taskFile: string) => Promise<void>;
  loadModel: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  status: 'idle',
  runId: null,
  taskName: null,
  currentStep: 0,
  totalSteps: 0,
  currentLabel: null,
  stepResults: [],
  modelStatus: 'not_loaded',
  error: null,

  handleWsMessage: (msg) => {
    switch (msg.type) {
      case 'run_started':
        set({
          status: 'running',
          runId: msg.run_id ?? null,
          taskName: msg.task_name ?? null,
          totalSteps: msg.total_steps ?? 0,
          currentStep: 0,
          stepResults: [],
          error: null,
        });
        break;
      case 'step_started':
        set({
          currentStep: msg.step_num ?? 0,
          currentLabel: msg.label ?? null,
        });
        break;
      case 'step_completed': {
        const stepNum = msg.step_num ?? 0;
        set((state) => {
          if (state.stepResults.some(r => r.step_num === stepNum)) {
            return state;
          }
          return {
            stepResults: [...state.stepResults, {
              step_num: stepNum,
              description: msg.label ?? '',
              action: '',
              passed: msg.passed ?? false,
              duration_seconds: msg.duration_seconds ?? 0,
              error: msg.error ?? null,
              coordinates: msg.coordinates ?? null,
              screenshot_base64: msg.screenshot_base64 ?? null,
            }],
          };
        });
        break;
      }
      case 'run_completed':
        set({
          status: msg.passed ? 'completed' : 'failed',
        });
        break;
      case 'run_failed':
        set({
          status: 'failed',
          error: msg.error ?? 'Unknown error',
        });
        break;
      case 'model_loading':
        set({ modelStatus: 'loading' });
        break;
      case 'model_loaded':
        set({ modelStatus: 'loaded' });
        break;
      case 'run_status':
        set({
          status: (msg.status as ExecutionState['status']) ?? 'idle',
          runId: msg.run_id ?? null,
          taskName: msg.task_name ?? null,
          currentStep: msg.current_step ?? 0,
          totalSteps: msg.total_steps ?? 0,
          stepResults: msg.step_results ?? [],
        });
        break;
    }
  },

  startRun: async (taskFile: string) => {
    set({ status: 'running', stepResults: [], error: null });
    try {
      const res = await executionApi.run(taskFile);
      set({
        runId: res.run_id,
        taskName: res.task_name,
        totalSteps: res.total_steps,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to start run';
      set({ status: 'failed', error: typeof msg === 'string' ? msg : 'A run is already in progress' });
    }
  },

  loadModel: async () => {
    set({ modelStatus: 'loading' });
    await executionApi.loadModel();
  },

  fetchStatus: async () => {
    const status = await executionApi.status();
    set({
      status: (status.status as ExecutionState['status']),
      runId: status.run_id,
      taskName: status.task_name,
      currentStep: status.current_step ?? 0,
      totalSteps: status.total_steps ?? 0,
    });
    const modelStatus = await executionApi.modelStatus();
    set({ modelStatus: modelStatus.status as ExecutionState['modelStatus'] });
  },

  reset: () => set({
    status: 'idle',
    runId: null,
    taskName: null,
    currentStep: 0,
    totalSteps: 0,
    currentLabel: null,
    stepResults: [],
    error: null,
  }),
}));
