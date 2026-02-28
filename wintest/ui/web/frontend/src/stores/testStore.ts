import { create } from 'zustand';
import type { Test, TestListItem, StepInfo, ValidationResult } from '../api/types';
import { testApi } from '../api/client';

interface TestState {
  tests: TestListItem[];
  stepTypes: StepInfo[];
  currentTest: Test | null;
  validation: ValidationResult | null;
  loading: boolean;

  fetchTests: () => Promise<void>;
  fetchStepTypes: () => Promise<void>;
  fetchTest: (filename: string) => Promise<void>;
  saveTest: (test: Test, filename?: string) => Promise<string>;
  deleteTest: (filename: string) => Promise<void>;
  validateTest: (filename: string) => Promise<ValidationResult>;
  setCurrentTest: (test: Test | null) => void;
}

export const useTestStore = create<TestState>((set) => ({
  tests: [],
  stepTypes: [],
  currentTest: null,
  validation: null,
  loading: false,

  fetchTests: async () => {
    set({ loading: true });
    const tests = await testApi.list();
    set({ tests, loading: false });
  },

  fetchStepTypes: async () => {
    const stepTypes = await testApi.stepTypes();
    set({ stepTypes });
  },

  fetchTest: async (filename: string) => {
    set({ loading: true, validation: null });
    const test = await testApi.get(filename);
    set({ currentTest: test, loading: false });
  },

  saveTest: async (test: Test, filename?: string) => {
    if (filename) {
      await testApi.update(filename, test);
      return filename;
    } else {
      const res = await testApi.create(test);
      return res.filename;
    }
  },

  deleteTest: async (filename: string) => {
    await testApi.delete(filename);
    set((state) => ({
      tests: state.tests.filter(t => t.filename !== filename),
    }));
  },

  validateTest: async (filename: string) => {
    const result = await testApi.validate(filename);
    set({ validation: result });
    return result;
  },

  setCurrentTest: (test) => set({ currentTest: test, validation: null }),
}));
