import { NextResponse } from 'next/server';

const serverStartTime = Date.now();
let pingCount = 0;
let lastPingTime = new Date().toISOString();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  pingCount += 1;
  lastPingTime = new Date().toISOString();

  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  const host = request.headers.get('host') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return NextResponse.json(
    {
      status: 'healthy',
      service: 'RentVault',
      keepAlive: true,
      message: 'Render container active and responsive',
      timestamp: lastPingTime,
      uptimeSeconds,
      uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
      totalPingsReceived: pingCount,
      host,
      isRender: Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL),
      renderUrl: process.env.RENDER_EXTERNAL_URL || null,
      userAgent: userAgent.slice(0, 50),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Keep-Alive-Status': 'active',
      },
    }
  );
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Keep-Alive-Status': 'active',
    },
  });
}
