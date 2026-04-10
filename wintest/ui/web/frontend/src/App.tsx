import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { TestList } from './pages/TestList';
import { TestEditor } from './pages/TestEditor';
import { TestSuiteList } from './pages/TestSuiteList';
import { TestSuiteEditor } from './pages/TestSuiteEditor';
import { TestSuiteViewer } from './pages/TestSuiteViewer';
import { ExecutionViewer } from './pages/ExecutionViewer';
import { ReportList } from './pages/ReportList';
import { ReportViewer } from './pages/ReportViewer';
import { TestBuilder } from './pages/TestBuilder';
import { Trends } from './pages/Trends';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/tests', element: <TestList /> },
      { path: '/tests/new', element: <TestEditor /> },
      { path: '/tests/edit/*', element: <TestEditor /> },
      { path: '/test-suites', element: <TestSuiteList /> },
      { path: '/test-suites/new', element: <TestSuiteEditor /> },
      { path: '/test-suites/view/*', element: <TestSuiteViewer /> },
      { path: '/test-suites/edit/*', element: <TestSuiteEditor /> },
      { path: '/builder', element: <TestBuilder /> },
      { path: '/execution', element: <ExecutionViewer /> },
      { path: '/reports', element: <ReportList /> },
      { path: '/reports/:reportId', element: <ReportViewer /> },
      { path: '/trends', element: <Trends /> },
      { path: '/settings', element: <Settings /> },
      { path: '/help', element: <Help /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
