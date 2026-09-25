'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Download, Printer, ExternalLink, FileText, 
  ShieldCheck, ZoomIn, ZoomOut, RotateCw, Eye, 
  CheckCircle2, Building2, User, Calendar, Lock,
  RefreshCw, Upload
} from 'lucide-react';
import { DocumentRecord } from '@/types/database';
import { getDocumentBlobUrl, storeDocumentFile, fileToDataUrl } from '@/lib/store/document-storage';
import { saveLocalDocument } from '@/lib/store/app-store';

interface DocumentViewerModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewerModal({ document, isOpen, onClose }: DocumentViewerModalProps) {
  if (!isOpen || !document) return null;
  return <DocumentViewerContent document={document} onClose={onClose} />;
}

function DocumentViewerContent({ document: initialDoc, onClose }: { document: DocumentRecord; onClose: () => void }) {
  const [doc, setDoc] = useState<DocumentRecord>(initialDoc);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = 
    doc.mime_type?.includes('pdf') || 
    doc.file_name.toLowerCase().endsWith('.pdf') ||
    doc.file_data?.startsWith('data:application/pdf');

  const isImage = 
    doc.mime_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(doc.file_name) ||
    doc.file_data?.startsWith('data:image/');

  // Resolve the exact file binary from local cache, IndexedDB, or Supabase
  useEffect(() => {
    let isMounted = true;

    async function resolveFileUrl() {
      setLoading(true);

      // 1. Direct Base64 data URL
      if (doc.file_data) {
        if (isMounted) {
          setFileUrl(doc.file_data);
          setLoading(false);
        }
        return;
      }

      // 2. Browser IndexedDB Blob URL (stores raw uploaded PDF/Image files)
      try {
        const localBlobUrl = 
          (await getDocumentBlobUrl(doc.id)) || 
          (await getDocumentBlobUrl(doc.storage_path));

        if (localBlobUrl && isMounted) {
          setFileUrl(localBlobUrl);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Local blob check note:', err);
      }

      // 3. Remote Supabase Storage signed URL
      try {
        const res = await fetch(`/api/document-url?path=${encodeURIComponent(doc.storage_path)}&format=json`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.signedUrl) {
            setFileUrl(data.signedUrl);
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore
      }

      if (isMounted) {
        setFileUrl(null);
        setLoading(false);
      }
    }

    resolveFileUrl();

    return () => {
      isMounted = false;
    };
  }, [doc]);

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (fileUrl) {
      const a = window.document.createElement('a');
      a.href = fileUrl;
      a.download = doc.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } else {
      window.open(`/api/document-url?path=${encodeURIComponent(doc.storage_path)}`, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    if (!fileUrl) {
      window.open(`/api/document-url?path=${encodeURIComponent(doc.storage_path)}`, '_blank');
      return;
    }

    if (fileUrl.startsWith('data:application/pdf')) {
      const newTab = window.open();
      if (newTab) {
        newTab.document.write(
          `<!DOCTYPE html><html><head><title>${doc.file_name}</title><style>body,html{margin:0;height:100%;overflow:hidden;background:#525659;}</style></head><body><iframe src="${fileUrl}" width="100%" height="100%" style="border:none;"></iframe></body></html>`
        );
      } else {
        window.open(fileUrl, '_blank');
      }
    } else {
      window.open(fileUrl, '_blank');
    }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    let fileData: string | null = null;
    if (file.size <= 3 * 1024 * 1024) {
      try {
        fileData = await fileToDataUrl(file);
      } catch {
        // ignore
      }
    }

    await storeDocumentFile(doc.id, file, file.name, file.type);
    await storeDocumentFile(doc.storage_path, file, file.name, file.type);

    const updatedDoc: DocumentRecord = {
      ...doc,
      file_name: file.name,
      mime_type: file.type || 'application/pdf',
      file_size_bytes: file.size,
      file_data: fileData,
    };
    saveLocalDocument(updatedDoc);
    setDoc(updatedDoc);

    const blobUrl = URL.createObjectURL(file);
    setFileUrl(fileData || blobUrl);
    setLoading(false);
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'AADHAR_CARD':
        return { label: 'Aadhar Card (Govt ID)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'RENTAL_AGREEMENT':
        return { label: 'Rental Agreement (Signed)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'TENANT_PHOTO':
        return { label: 'Tenant Photo / Portrait', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'POLICE_VERIFICATION':
        return { label: 'Police Verification Form', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'ELECTRICITY_BILL':
        return { label: 'Electricity / EB Bill', color: 'bg-cyan-100 text-cyan-900 border-cyan-300' };
      default:
        return { label: type.replace('_', ' '), color: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const badge = getDocTypeBadge(doc.doc_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md" title={doc.file_name}>
                  {doc.file_name}
                </h2>
                <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {doc.tenant?.full_name ? `Tenant: ${doc.tenant.full_name}` : 'General Archive'} • {doc.room?.room_number ? `Room ${doc.room.room_number}` : 'All Units'}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && fileUrl && (
              <div className="hidden sm:flex items-center gap-1 mr-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold px-1 text-slate-300">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-[10px] font-bold px-1.5"
                  title="Reset Zoom"
                >
                  Reset
                </button>
              </div>
            )}

            {fileUrl && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Open in Full Browser Tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Canvas Area */}
        <div className="flex-1 bg-slate-900/95 overflow-hidden relative flex items-center justify-center">
          {loading ? (
            <div className="text-center p-8 space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-300">Loading exact document file...</p>
            </div>
          ) : fileUrl && isImage ? (
            // Image Previewer
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={fileUrl}
                alt={doc.file_name}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-700 bg-black/40"
              />
            </div>
          ) : fileUrl && isPdf ? (
            // Native PDF Interactive Viewer with Object + iFrame fallback
            <div className="w-full h-full flex flex-col bg-slate-800">
              <object
                data={`${fileUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                type="application/pdf"
                className="w-full h-full"
              >
                <iframe
                  src={`${fileUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  title={doc.file_name}
                  className="w-full h-full border-none"
                >
                  <div className="p-8 text-center space-y-4 text-white">
                    <p className="text-sm font-semibold">
                      Your browser does not display inline PDFs in this container.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" /> Open Full PDF File
                    </button>
                  </div>
                </iframe>
              </object>
            </div>
          ) : fileUrl ? (
            // General file fallback (render in iframe or offer view)
            <div className="w-full h-full flex flex-col bg-slate-800">
              <iframe
                src={fileUrl}
                title={doc.file_name}
                className="w-full h-full border-none"
              />
            </div>
          ) : (
            // Placeholder view when record has no attached physical binary file
            <div className="max-w-lg w-full mx-4 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center mx-auto shadow-xs">
                <FileText className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                  {badge.label}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-2">
                  {doc.file_name}
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  This is a sample or legacy metadata record without an attached physical binary file.
                </p>
              </div>

              {/* Attach File Right Here */}
              <div className="p-4 bg-indigo-50/60 border-2 border-dashed border-indigo-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Attach your exact PDF or image to this record:
                </span>
                <p className="text-[11px] text-slate-600">
                  Select your original PDF file to view and archive it securely.
                </p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer mt-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose PDF / Image File</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleAttachFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                Vault Path: {doc.storage_path}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Details */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <Lock className="w-3 h-3 text-emerald-400" /> Vault Storage
            </span>
            <span>•</span>
            <span className="font-mono text-slate-400 text-[10px] truncate max-w-xs">{doc.storage_path}</span>
          </div>
          <span className="font-semibold text-slate-400">
            {doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : 'PDF Document'}
          </span>
        </div>

      </div>
    </div>
  );
}
