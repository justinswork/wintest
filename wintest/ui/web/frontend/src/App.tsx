import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { TestEditor } from './pages/TestEditor';
import { TestSuiteEditor } from './pages/TestSuiteEditor';
import { TestSuiteViewer } from './pages/TestSuiteViewer';
import { ExecutionViewer } from './pages/ExecutionViewer';
import { ReportList } from './pages/ReportList';
import { ReportViewer } from './pages/ReportViewer';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/tests/new', element: <TestEditor /> },
      { path: '/tests/:filename/edit', element: <TestEditor /> },
      { path: '/test-suites/new', element: <TestSuiteEditor /> },
      { path: '/test-suites/:filename', element: <TestSuiteViewer /> },
      { path: '/test-suites/:filename/edit', element: <TestSuiteEditor /> },
      { path: '/execution', element: <ExecutionViewer /> },
      { path: '/reports', element: <ReportList /> },
      { path: '/reports/:reportId', element: <ReportViewer /> },
      { path: '/settings', element: <Settings /> },
      { path: '/help', element: <Help /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
