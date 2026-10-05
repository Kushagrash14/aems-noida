export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const g = globalThis as unknown as { __aems_smart_mail_timer?: ReturnType<typeof setInterval> };
  if (g.__aems_smart_mail_timer) return;

  const { processDueCampaigns } = await import('@/lib/smartMail');
  g.__aems_smart_mail_timer = setInterval(() => {
    void processDueCampaigns();
  }, 60_000);
  console.log('[AEMS SMART MAIL] Automail scheduler started (checks every 60s)');
}
