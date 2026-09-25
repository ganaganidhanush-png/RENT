export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startKeepAliveDaemon } = await import('@/lib/services/keep-alive');
    startKeepAliveDaemon();
  }
}
