'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=users');
  }, [router]);

  return (
    <div className="p-12 text-center text-xs text-slate-400">
      Redirecting to User Management in Settings Hub...
    </div>
  );
}
