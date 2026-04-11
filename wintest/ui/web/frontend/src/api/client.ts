import axios from 'axios';
import type { Test, TestListItem, StepInfo, ValidationResult, ReportSummary, ReportData, RunResponse, RunStatus, TestSuite, TestSuiteListItem, RunTestSuiteResponse } from './types';

const api = axios.create({ baseURL: '/api' });

export const testApi = {
  list: () => api.get<TestListItem[]>('/tests').then(r => r.data),
  get: (filepath: string) => api.get<Test>(`/tests/file/${filepath}`).then(r => r.data),
  create: (test: Test) => api.post('/tests', test).then(r => r.data),
  update: (filepath: string, test: Test) => api.put(`/tests/file/${filepath}`, test).then(r => r.data),
  delete: (filepath: string) => api.delete(`/tests/file/${filepath}`).then(r => r.data),
  validate: (filepath: string) => api.post<ValidationResult>(`/tests/file/${filepath}/validate`).then(r => r.data),
  stepTypes: () => api.get<StepInfo[]>('/tests/steps').then(r => r.data),
};

export const testSuiteApi = {
  list: () => api.get<TestSuiteListItem[]>('/test-suites').then(r => r.data),
  get: (filepath: string) => api.get<TestSuite>(`/test-suites/file/${filepath}`).then(r => r.data),
  create: (testSuite: TestSuite) => api.post('/test-suites', testSuite).then(r => r.data),
  update: (filepath: string, testSuite: TestSuite) => api.put(`/test-suites/file/${filepath}`, testSuite).then(r => r.data),
  delete: (filepath: string) => api.delete(`/test-suites/file/${filepath}`).then(r => r.data),
};

export const executionApi = {
  run: (testFile: string) => api.post<RunResponse>('/execution/run', { test_file: testFile }).then(r => r.data),
  runTestSuite: (suiteFile: string) => api.post<RunTestSuiteResponse>('/execution/run-test-suite', { suite_file: suiteFile }).then(r => r.data),
  status: () => api.get<RunStatus>('/execution/status').then(r => r.data),
  modelStatus: () => api.get<{ status: string }>('/execution/model-status').then(r => r.data),
  loadModel: () => api.post('/execution/load-model').then(r => r.data),
  cancel: () => api.post('/execution/cancel').then(r => r.data),
};

export const builderApi = {
  start: () => api.post('/builder/start').then(r => r.data),
  step: (step: Record<string, unknown>) => api.post('/builder/step', step).then(r => r.data),
  stop: () => api.post('/builder/stop').then(r => r.data),
  screenshot: () => api.get('/builder/screenshot').then(r => r.data),
  detectNewFile: (dir_path: string, known_files: Record<string, number>) =>
    api.post('/builder/detect-new-file', { dir_path, known_files }).then(r => r.data),
};

export const fileApi = {
  pickExecutable: () => api.post<{ path: string }>('/files/pick-executable').then(r => r.data.path),
  pickFile: () => api.post<{ path: string }>('/files/pick-file').then(r => r.data.path),
  pickFolder: () => api.post<{ path: string }>('/files/pick-folder').then(r => r.data.path),
  openFolder: (path: string) => api.post('/files/open-folder', { path }).then(r => r.data),
};

export const savedAppsApi = {
  list: () => api.get<string[]>('/saved-apps').then(r => r.data),
  add: (path: string) => api.post('/saved-apps', { path }).then(r => r.data),
  remove: (path: string) => api.delete('/saved-apps', { data: { path } }).then(r => r.data),
};

export const baselineApi = {
  list: () => api.get('/baselines').then(r => r.data),
  save: (image_base64: string, name: string) => api.post('/baselines', { image_base64, name }).then(r => r.data),
  saveFromFile: (source_path: string, name: string) => api.post('/baselines/from-file', { source_path, name }).then(r => r.data),
  get: (id: string) => api.get(`/baselines/${id}`).then(r => r.data),
  delete: (id: string) => api.delete(`/baselines/${id}`).then(r => r.data),
};

export const settingsApi = {
  getModel: () => api.get('/settings/model').then(r => r.data),
  setModel: (model_path: string) => api.put('/settings/model', { model_path }).then(r => r.data),
  getWorkspace: () => api.get('/settings/workspace').then(r => r.data),
  setWorkspace: (root: string) => api.put('/settings/workspace', { root }).then(r => r.data),
};

export const reportApi = {
  list: () => api.get<ReportSummary[]>('/reports').then(r => r.data),
  get: (id: string) => api.get<ReportData>(`/reports/${id}`).then(r => r.data),
  delete: (id: string) => api.delete(`/reports/${id}`).then(r => r.data),
  screenshotUrl: (id: string, filename: string) => `/api/reports/${id}/screenshots/${filename}`,
};
