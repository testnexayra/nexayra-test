"use client";

import { X, Download, Share2 } from "lucide-react";

interface Props {
  pdfUrl: string | null;
  title: string;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  isWorking: boolean;
}

export default function PreviewModal({ pdfUrl, title, onClose, onDownload, onShare, isWorking }: Props) {
  if (!pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-backdrop" onClick={onClose}>
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-navy-800 rounded-2xl shadow-2xl flex flex-col animate-modal overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100 dark:border-navy-700 bg-navy-50/50">
          <div>
            <h3 className="font-display text-lg font-bold text-navy">Preview: {title}</h3>
            <p className="text-navy-400 text-xs mt-0.5">Review before generating or sharing</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDownload} disabled={isWorking}
              className="flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-700 dark:hover:bg-navy-700 text-white dark:bg-gold-400 dark:text-white font-semibold rounded-xl text-sm transition-all btn-press disabled:opacity-50 shadow-lg shadow-navy/20">
              <Download size={15} /> {isWorking ? "Working…" : "Download"}
            </button>
            <button onClick={onShare} disabled={isWorking}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all btn-press disabled:opacity-50">
              <Share2 size={15} /> Share
            </button>
            <button onClick={onClose} className="p-2 hover:bg-navy-100 rounded-xl transition-all">
              <X size={20} className="text-navy-400" />
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div className="flex-1 bg-navy-100">
          <iframe src={pdfUrl} className="w-full h-full border-0" title="PDF Preview" />
        </div>
      </div>
    </div>
  );
}
