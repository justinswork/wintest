import { Outlet } from 'react-router-dom';
import { Sidebar } from './Navbar';
import { ToastContainer } from '../common/Toast';

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
