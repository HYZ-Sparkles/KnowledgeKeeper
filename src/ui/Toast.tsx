import { useEffect } from 'react';

export default function Toast({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 2000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`toast ${message ? 'on' : ''}`} role="status">
      {message}
    </div>
  );
}
