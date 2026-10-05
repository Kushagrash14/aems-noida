'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditLogsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=security_audit');
  }, [router]);

  return (
    <div className="p-12 text-center text-xs text-slate-400">
      Redirecting to Security & Audit Trail in Settings Hub...
    </div>
  );
}
