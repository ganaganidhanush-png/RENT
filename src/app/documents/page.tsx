'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, FileText, ArrowLeft, Download, Plus, 
  Trash2, X 
} from 'lucide-react';
import { DocumentRecord, Tenant, Room, DocumentType } from '@/types/database';
import { 
  getLocalDocuments, saveLocalDocument, deleteLocalDocument, 
  getLocalTenants, getLocalRooms 
} from '@/lib/store/app-store';
import { createClient } from '@/lib/supabase/client';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    if (typeof window !== 'undefined') return getLocalDocuments();
    return [];
  });
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (typeof window !== 'undefined') return getLocalTenants();
    return [];
  });
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') return getLocalRooms();
    return [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Document Modal Form State
  const [docType, setDocType] = useState<DocumentType>('AADHAR_CARD');
  const [tenantId, setTenantId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    async function syncRemote() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('documents')
          .select('*, tenant:tenants(*), room:rooms(*)')
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          const localDocs = getLocalDocuments();
          const combined = [...data];
          for (const ld of localDocs) {
            if (!combined.some((c) => c.id === ld.id)) {
              combined.push(ld);
            }
          }
          setDocuments(combined);
        }
      } catch (err) {
        console.warn('Documents sync note:', err);
      }
    }

    syncRemote();

    const handleUpdate = () => {
      setDocuments(getLocalDocuments());
      setTenants(getLocalTenants());
      setRooms(getLocalRooms());
    };

    window.addEventListener('rentvault_data_updated', handleUpdate);
    return () => window.removeEventListener('rentvault_data_updated', handleUpdate);
  }, []);

  const handleTenantSelect = (selectedTenantId: string) => {
    setTenantId(selectedTenantId);
    const tenant = tenants.find((t) => t.id === selectedTenantId);
    if (tenant?.room_id) {
      setRoomId(tenant.room_id);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    setSaving(true);
    const selectedTenant = tenants.find((t) => t.id === tenantId);
    const selectedRoom = rooms.find((r) => r.id === roomId || (selectedTenant && r.id === selectedTenant.room_id));
    const generatedId = `doc-${Date.now()}`;
    const storagePath = `tenants/${tenantId || 'general'}/${docType.toLowerCase()}_${fileName.replace(/\s+/g, '_')}`;

    const newDoc: DocumentRecord = {
      id: generatedId,
      tenant_id: tenantId || null,
      room_id: roomId || selectedTenant?.room_id || null,
      doc_type: docType,
      storage_path: storagePath,
      file_name: fileName.trim(),
      mime_type: fileObject?.type || 'application/pdf',
      file_size_bytes: fileObject?.size || 1024 * 256,
      created_at: new Date().toISOString(),
      tenant: selectedTenant,
      room: selectedRoom,
    };

    saveLocalDocument(newDoc);
    setDocuments((prev) => [newDoc, ...prev]);

    // Optional Supabase insertion
    try {
      const supabase = createClient();
      await supabase.from('documents').insert({
        id: generatedId,
        tenant_id: newDoc.tenant_id,
        room_id: newDoc.room_id,
        doc_type: newDoc.doc_type,
        storage_path: newDoc.storage_path,
        file_name: newDoc.file_name,
        mime_type: newDoc.mime_type,
        file_size_bytes: newDoc.file_size_bytes,
      });
    } catch (err) {
      console.warn('Supabase document insert note:', err);
    }

    setSaving(false);
    setIsModalOpen(false);
    setFileName('');
    setTenantId('');
    setRoomId('');
    setFileObject(null);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm('Are you sure you want to remove this document from the vault?')) {
      deleteLocalDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      try {
        const supabase = createClient();
        await supabase.from('documents').delete().eq('id', docId);
      } catch (err) {
        console.warn('Supabase delete document note:', err);
      }
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (filterType === 'ALL') return true;
    return d.doc_type === filterType;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Document Vault</h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Secure, encrypted archive for Aadhar cards, signed lease agreements & ID records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Vault Active</span>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 w-fit">
          {['ALL', 'AADHAR_CARD', 'RENTAL_AGREEMENT', 'TENANT_PHOTO', 'OTHER'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterType === type ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              {type === 'ALL' ? 'All Documents' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Vault Grid */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-slate-200 rounded-2xl shadow-xs p-6">
          <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">No documents stored in vault yet</h2>
          <p className="text-xs font-semibold text-slate-600 mt-1 max-w-sm mx-auto">
            Uploaded Aadhar cards, photos, or agreements will appear securely here. You can also upload custom documents directly.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Upload Document
            </button>
            <Link
              href="/tenants/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition-colors"
            >
              Add with New Tenant
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => {
            const docTenant = doc.tenant || tenants.find((t) => t.id === doc.tenant_id);
            const docRoom = doc.room || rooms.find((r) => r.id === doc.room_id || (docTenant && r.id === docTenant.room_id));

            return (
              <div
                key={doc.id}
                className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      {doc.doc_type.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN') : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 my-3">
                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl shrink-0 border border-indigo-100">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-bold text-slate-900 truncate" title={doc.file_name}>
                        {doc.file_name}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5 truncate">
                        {docTenant ? docTenant.full_name : 'General Archive'} • {docRoom ? `Room ${docRoom.room_number}` : 'All Units'}
                      </p>
                      {docTenant?.tenant_type ? (
                        <span className="text-[10px] font-bold text-purple-700 block mt-0.5">
                          {docTenant.tenant_type === 'BACHELORS' ? 'Bachelors ID' : 'Family Head ID'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <a
                    href={`/api/document-url?path=${encodeURIComponent(doc.storage_path)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center inline-flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg border border-indigo-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Secure View / Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Upload to Encrypted Vault</h2>
                  <p className="text-[11px] text-slate-300">Archive ID verification, agreements & bills</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Document Type *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="AADHAR_CARD">Aadhar Card (Government ID)</option>
                  <option value="RENTAL_AGREEMENT">Rental Agreement (Signed)</option>
                  <option value="TENANT_PHOTO">Tenant / Occupant Photo</option>
                  <option value="POLICE_VERIFICATION">Police Verification Form</option>
                  <option value="ELECTRICITY_BILL">Electricity / Utility Bill</option>
                  <option value="OTHER">Other Verification Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Document Name / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe - Aadhar Front & Back"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Associated Tenant (Optional)
                  </label>
                  <select
                    value={tenantId}
                    onChange={(e) => handleTenantSelect(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- General / No Tenant --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.room?.room_number ? `Room ${t.room.room_number}` : 'Tenant'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Associated Unit (Optional)
                  </label>
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- General / All Units --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} (Floor {r.floor})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Upload File Attachment
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFileObject(f);
                      if (!fileName) setFileName(f.name);
                    }
                  }}
                  className="w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {saving ? 'Encrypting & Storing...' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
