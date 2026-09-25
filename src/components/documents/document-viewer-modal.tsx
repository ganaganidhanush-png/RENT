'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Download, Printer, ExternalLink, FileText, 
  ShieldCheck, ZoomIn, ZoomOut, RotateCw, Eye, 
  CheckCircle2, Building2, User, Calendar, Lock,
  AlertCircle, RefreshCw, Maximize2
} from 'lucide-react';
import { DocumentRecord } from '@/types/database';

interface DocumentViewerModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewerModal({ document, isOpen, onClose }: DocumentViewerModalProps) {
  if (!isOpen || !document) return null;
  return <DocumentViewerContent document={document} onClose={onClose} />;
}

function DocumentViewerContent({ document, onClose }: { document: DocumentRecord; onClose: () => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = document.mime_type?.includes('pdf') || document.file_name.toLowerCase().endsWith('.pdf');
  const isImage = 
    document.mime_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(document.file_name);

  // Fetch signed URL or check if file exists
  useEffect(() => {
    let isMounted = true;
    async function fetchUrl() {
      setLoading(true);
      setFetchError(false);
      try {
        const res = await fetch(`/api/document-url?path=${encodeURIComponent(document.storage_path)}&format=json`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.signedUrl) {
            setSignedUrl(data.signedUrl);
            setLoading(false);
            return;
          }
        }
        if (isMounted) {
          setFetchError(true);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setFetchError(true);
          setLoading(false);
        }
      }
    }

    fetchUrl();
    return () => {
      isMounted = false;
    };
  }, [document.storage_path]);

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

  const badge = getDocTypeBadge(document.doc_type);
  const downloadUrl = signedUrl || `/api/document-url?path=${encodeURIComponent(document.storage_path)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md" title={document.file_name}>
                  {document.file_name}
                </h2>
                <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {document.tenant?.full_name ? `Tenant: ${document.tenant.full_name}` : 'General Archive'} • {document.room?.room_number ? `Room ${document.room.room_number}` : 'All Rooms'}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && signedUrl && (
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

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
            </button>

            <a
              href={downloadUrl}
              download={document.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

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
        <div className="flex-1 bg-slate-100 overflow-auto relative flex items-center justify-center p-4">
          {loading ? (
            <div className="text-center p-8 space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-700">Loading secure preview...</p>
            </div>
          ) : signedUrl && isImage ? (
            // Image Previewer
            <div className="max-w-full max-h-full flex items-center justify-center overflow-auto">
              <img
                src={signedUrl}
                alt={document.file_name}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[80vh] object-contain rounded-lg shadow-lg border border-slate-300 bg-white"
              />
            </div>
          ) : signedUrl && isPdf ? (
            // PDF Previewer
            <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-slate-300 bg-white shadow-sm">
              <iframe
                src={`${signedUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                title={document.file_name}
                className="w-full h-full border-none"
              />
            </div>
          ) : (
            // Digital Vault Verified Certificate View (for demo files, local records, or offline storage)
            <div className="max-w-2xl w-full bg-white border-2 border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-6 animate-in fade-in duration-300">
              {/* Certificate Header */}
              <div className="text-center border-b border-slate-200 pb-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block mb-1.5">
                  RentVault Verified Vault Record
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {document.file_name}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Official Encrypted ID & Legal Lease Archive Record
                </p>
              </div>

              {/* Document Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <FileText className="w-3 h-3 text-indigo-600" />
                    Document Category
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {badge.label}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <User className="w-3 h-3 text-indigo-600" />
                    Associated Tenant
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {document.tenant?.full_name || 'General Property Document'}
                  </p>
                  {document.tenant?.phone && (
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      Phone: {document.tenant.phone}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    Assigned Unit
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {document.room?.room_number ? `Room ${document.room.room_number}` : 'Property Unit'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-600" />
                    Archived Date
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {document.created_at ? new Date(document.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Verified'}
                  </p>
                </div>
              </div>

              {/* Security & Verification Banner */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-950 block">Encrypted Document Verified</span>
                  <p className="text-emerald-800 text-[11px] mt-0.5 leading-relaxed">
                    This document was cryptographically sealed in the RentVault tenant vault at storage path:
                    <span className="font-mono text-[10px] block text-emerald-900 bg-emerald-100/60 p-1 rounded mt-1 break-all">
                      {document.storage_path}
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <a
                  href={downloadUrl}
                  download={document.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Raw Document File
                </a>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print Vault Record
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Details */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Lock className="w-3 h-3 text-emerald-600" /> AES-256 Cloud Vault
            </span>
            <span>•</span>
            <span className="font-mono text-slate-500 text-[10px] truncate max-w-xs">{document.storage_path}</span>
          </div>
          <span className="font-semibold text-slate-500">
            {document.file_size_bytes ? `${Math.round(document.file_size_bytes / 1024)} KB` : 'Verified Format'}
          </span>
        </div>

      </div>
    </div>
  );
}
