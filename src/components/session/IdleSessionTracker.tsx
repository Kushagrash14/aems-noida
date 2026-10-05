'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, LogOut } from 'lucide-react';

interface IdleSessionTrackerProps {
  role?: string;
}

export default function IdleSessionTracker({ role }: IdleSessionTrackerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [kickoutReason, setKickoutReason] = useState<string | null>(null);
  const lastActiveRef = useRef<number>(Date.now());

  // Inactivity limit set to 24 hours (86,400,000 ms) for smooth uninterrupted usage
  const maxIdleMs = 24 * 60 * 60 * 1000;

  const handleActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
  }, []);

  // Ping heartbeat to check single session status and touch server activity
  const checkHeartbeat = useCallback(async () => {
    if (pathname === '/login' || pathname.startsWith('/qr/report')) return;

    // Check client idle first
    const idleTime = Date.now() - lastActiveRef.current;
    if (idleTime > maxIdleMs) {
      setKickoutReason('Your session expired due to inactivity (' + (maxIdleMs / 60000) + ' min limit).');
      return;
    }

    try {
      const res = await fetch('/api/auth/heartbeat', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.reason === 'kicked_out') {
          setKickoutReason('Another device logged into your account. AEMS v2 enforces a single active session policy.');
        } else if (data.reason === 'idle_timeout') {
          setKickoutReason('Your session expired due to inactivity.');
        }
      }
    } catch {
      // Offline or network flicker, ignore single failure
    }
  }, [pathname, maxIdleMs]);

  useEffect(() => {
    if (pathname === '/login' || pathname.startsWith('/qr/report')) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    // Global listener to blur number inputs on mouse scroll (prevents accidental value changes)
    const handleWheel = () => {
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });

    // Heartbeat every 30 seconds
    const interval = setInterval(checkHeartbeat, 30000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      window.removeEventListener('wheel', handleWheel);
      clearInterval(interval);
    };
  }, [handleActivity, checkHeartbeat, pathname]);

  const handleDismiss = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (!kickoutReason) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Session Terminated</h3>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">{kickoutReason}</p>
        <button
          onClick={handleDismiss}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Return to Login
        </button>
      </div>
    </div>
  );
}
