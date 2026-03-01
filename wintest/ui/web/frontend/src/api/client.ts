import axios from 'axios';
import type { Test, TestListItem, StepInfo, ValidationResult, ReportSummary, ReportData, RunResponse, RunStatus, TestSuite, TestSuiteListItem, RunTestSuiteResponse } from './types';

const api = axios.create({ baseURL: '/api' });

export const testApi = {
  list: () => api.get<TestListItem[]>('/tests').then(r => r.data),
  get: (filename: string) => api.get<Test>(`/tests/${filename}`).then(r => r.data),
  create: (test: Test) => api.post('/tests', test).then(r => r.data),
  update: (filename: string, test: Test) => api.put(`/tests/${filename}`, test).then(r => r.data),
  delete: (filename: string) => api.delete(`/tests/${filename}`).then(r => r.data),
  validate: (filename: string) => api.post<ValidationResult>(`/tests/${filename}/validate`).then(r => r.data),
  stepTypes: () => api.get<StepInfo[]>('/tests/steps').then(r => r.data),
};

export const testSuiteApi = {
  list: () => api.get<TestSuiteListItem[]>('/test-suites').then(r => r.data),
  get: (filename: string) => api.get<TestSuite>(`/test-suites/${filename}`).then(r => r.data),
  create: (testSuite: TestSuite) => api.post('/test-suites', testSuite).then(r => r.data),
  update: (filename: string, testSuite: TestSuite) => api.put(`/test-suites/${filename}`, testSuite).then(r => r.data),
  delete: (filename: string) => api.delete(`/test-suites/${filename}`).then(r => r.data),
};

export const executionApi = {
  run: (testFile: string) => api.post<RunResponse>('/execution/run', { test_file: testFile }).then(r => r.data),
  runTestSuite: (suiteFile: string) => api.post<RunTestSuiteResponse>('/execution/run-test-suite', { suite_file: suiteFile }).then(r => r.data),
  status: () => api.get<RunStatus>('/execution/status').then(r => r.data),
  modelStatus: () => api.get<{ status: string }>('/execution/model-status').then(r => r.data),
  loadModel: () => api.post('/execution/load-model').then(r => r.data),
  cancel: () => api.post('/execution/cancel').then(r => r.data),
};

export const reportApi = {
  list: () => api.get<ReportSummary[]>('/reports').then(r => r.data),
  get: (id: string) => api.get<ReportData>(`/reports/${id}`).then(r => r.data),
  delete: (id: string) => api.delete(`/reports/${id}`).then(r => r.data),
  screenshotUrl: (id: string, filename: string) => `/api/reports/${id}/screenshots/${filename}`,
};
