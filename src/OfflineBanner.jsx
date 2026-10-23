import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLang } from './i18n.js';

/** Barra roja fija cuando no hay conexión con el servidor (se quita sola al volver). */
export default function OfflineBanner({ onRetry }) {
  const { t } = useLang();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const net = (e) => setOffline(!e.detail);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('lm:net', net);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('lm:net', net); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div role="alert" className="flex items-start gap-2 bg-rose-600 px-4 py-2 text-xs font-bold text-white">
      <WifiOff size={14} className="mt-px shrink-0" />
      <span className="flex-1">{t('offline.banner')}</span>
      {onRetry && <button onClick={onRetry} className="shrink-0 underline hover:no-underline">{t('offline.retry')}</button>}
    </div>
  );
}
