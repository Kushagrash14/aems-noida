import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import IdleSessionTracker from '@/components/session/IdleSessionTracker';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const validation = await validateSessionToken(sessionToken);

  if (!validation.valid || !validation.user) {
    redirect('/login');
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full flex-col bg-[#F5F4F0] overflow-hidden text-slate-800 antialiased font-sans">
        <div className="shrink-0 relative z-50">
          <Navbar user={validation.user} scope={validation.scope} />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar user={validation.user} />
          <main className="flex-1 overflow-y-auto bg-[#F5F4F0] px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5 pt-0">
            <div className="w-full max-w-[1920px] mx-auto">
              {children}
            </div>
          </main>
        </div>
        <IdleSessionTracker role={validation.user.role} />
      </div>
    </SidebarProvider>
  );
}
