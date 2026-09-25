import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing document path' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Create temporary 60-second signed URL for secure viewing
  const { data, error } = await supabase.storage
    .from('tenant-vault')
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'File not found in vault' }, { status: 404 });
  }

  const format = searchParams.get('format');
  if (format === 'json') {
    return NextResponse.json({ signedUrl: data.signedUrl });
  }

  // Redirect directly to the signed URL so clicking the link views/downloads the file
  return NextResponse.redirect(data.signedUrl, 307);
}
