import { useEffect, useState } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;
let externalPush: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export function showToast(message: string, type: ToastItem['type'] = 'success') {
  externalPush?.({ message, type });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    externalPush = (toast) => {
      const id = nextId++;
      setToasts(prev => [...prev, { ...toast, id }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    return () => { externalPush = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
