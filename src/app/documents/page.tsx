import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ShieldCheck, FileText, ArrowLeft, Download } from 'lucide-react';
import { DocumentRecord, Tenant, Room } from '@/types/database';

export const revalidate = 0;

interface DocumentWithDetails extends DocumentRecord {
  tenant?: Tenant;
  room?: Room;
}

export default async function DocumentsPage() {
  const supabase = await createClient();

  let documents: DocumentWithDetails[] = [];

  try {
    const { data } = await supabase
      .from('documents')
      .select('*, tenant:tenants(*), room:rooms(*)')
      .order('created_at', { ascending: false });

    if (data) {
      documents = data;
    }
  } catch (err) {
    console.error('Error fetching documents:', err);
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Document Vault</h1>
            <p className="text-xs text-slate-500 mt-0.5">Secure, encrypted archive for Aadhar cards and rental agreements</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
          <ShieldCheck className="w-4 h-4" />
          <span>Encrypted Storage Active</span>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-300 rounded-2xl shadow-xs p-6">
          <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">No documents stored in vault yet</h2>
          <p className="text-xs font-semibold text-slate-600 mt-1 max-w-sm mx-auto">
            When you register tenants and upload their Aadhar cards, photos, or agreements, they will appear securely here.
          </p>
          <Link
            href="/tenants/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all"
          >
            Upload via Add Tenant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-slate-300 rounded-xl p-5 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {doc.doc_type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                  </span>
                </div>

                <div className="flex items-center gap-3 my-3">
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{doc.file_name}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      {doc.tenant?.full_name || 'Tenant'} • {doc.room?.room_number || 'Room'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <a
                  href={`/api/document-url?path=${encodeURIComponent(doc.storage_path)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  View with Secure Signed URL
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
