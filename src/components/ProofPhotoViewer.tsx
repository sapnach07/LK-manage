import React from 'react';
import { X, Image as ImageIcon, Download } from 'lucide-react';

interface ProofPhotoViewerProps {
  photoDataUrl: string;
  title: string;
  onClose: () => void;
}

export const ProofPhotoViewer: React.FC<ProofPhotoViewerProps> = ({ photoDataUrl, title, onClose }) => {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="relative max-w-2xl w-full flex flex-col items-center">
        {/* Controls */}
        <div className="w-full flex items-center justify-between pb-3 text-white">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium truncate max-w-xs">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={photoDataUrl}
              download={`preuve-${title.toLowerCase().replace(/\s+/g, '-')}.jpg`}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Télécharger l'image"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-[80vh] flex items-center justify-center">
          <img
            src={photoDataUrl}
            alt={title}
            className="max-h-[75vh] w-auto object-contain rounded-xl"
          />
        </div>
      </div>
    </div>
  );
};
