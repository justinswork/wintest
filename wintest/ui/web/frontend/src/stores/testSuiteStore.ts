import { create } from 'zustand';
import type { TestSuite, TestSuiteListItem } from '../api/types';
import { testSuiteApi } from '../api/client';

interface TestSuiteState {
  testSuites: TestSuiteListItem[];
  currentTestSuite: TestSuite | null;
  loading: boolean;

  fetchTestSuites: () => Promise<void>;
  fetchTestSuite: (filename: string) => Promise<void>;
  saveTestSuite: (testSuite: TestSuite, filename?: string) => Promise<string>;
  deleteTestSuite: (filename: string) => Promise<void>;
  setCurrentTestSuite: (testSuite: TestSuite | null) => void;
}

export const useTestSuiteStore = create<TestSuiteState>((set) => ({
  testSuites: [],
  currentTestSuite: null,
  loading: false,

  fetchTestSuites: async () => {
    set({ loading: true });
    const testSuites = await testSuiteApi.list();
    set({ testSuites, loading: false });
  },

  fetchTestSuite: async (filename: string) => {
    set({ loading: true });
    const testSuite = await testSuiteApi.get(filename);
    set({ currentTestSuite: testSuite, loading: false });
  },

  saveTestSuite: async (testSuite: TestSuite, filename?: string) => {
    if (filename) {
      await testSuiteApi.update(filename, testSuite);
      return filename;
    } else {
      const res = await testSuiteApi.create(testSuite);
      return res.filename;
    }
  },

  deleteTestSuite: async (filename: string) => {
    await testSuiteApi.delete(filename);
    set((state) => ({
      testSuites: state.testSuites.filter(s => s.filename !== filename),
    }));
  },

  setCurrentTestSuite: (testSuite) => set({ currentTestSuite: testSuite }),
}));
