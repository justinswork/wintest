import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { TaskEditor } from './pages/TaskEditor';
import { ExecutionViewer } from './pages/ExecutionViewer';
import { ReportList } from './pages/ReportList';
import { ReportViewer } from './pages/ReportViewer';
import { Settings } from './pages/Settings';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/tasks/new', element: <TaskEditor /> },
      { path: '/tasks/:filename/edit', element: <TaskEditor /> },
      { path: '/execution', element: <ExecutionViewer /> },
      { path: '/reports', element: <ReportList /> },
      { path: '/reports/:reportId', element: <ReportViewer /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
