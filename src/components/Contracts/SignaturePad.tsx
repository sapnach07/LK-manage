import React, { useRef, useState, useEffect } from 'react';
import { Eraser, CheckCircle2 } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  subtitle?: string;
  required?: boolean;
  onSignatureChange: (dataUrl: string | null) => void;
  initialSignature?: string | null;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  subtitle,
  required = false,
  onSignatureChange,
  initialSignature = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support high DPI screens
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0f172a'; // Deep ink color
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const getCanvasPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getCanvasPos(clientX, clientY);

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { x, y } = getCanvasPos(clientX, clientY);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <span>{label}</span>
            {required && <span className="text-rose-400">*</span>}
            {hasDrawn && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />}
          </label>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>

        {hasDrawn && (
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer px-2 py-0.5 rounded bg-slate-800"
          >
            <Eraser className="w-3 h-3" />
            <span>Effacer</span>
          </button>
        )}
      </div>

      <div className="relative rounded-xl border border-slate-700 bg-white shadow-inner overflow-hidden touch-none h-28">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 text-xs italic">
            Signez ici avec votre doigt
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-slate-400 font-mono">
          Signature électronique
        </div>
      </div>
    </div>
  );
};
