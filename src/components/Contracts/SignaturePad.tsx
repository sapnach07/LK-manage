import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  Eraser,
  Undo2,
  Check,
  CheckCircle2,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import {
  Stroke,
  Point,
  redrawAllStrokes,
  isSignatureValid,
  exportCroppedTransparentSignaturePng,
} from '../../utils/signatureUtils';

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
  // Canvases
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);

  // Fullscreen modal state
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showOrientationHint, setShowOrientationHint] = useState(false);

  // Current exported signature preview
  const [signaturePreview, setSignaturePreview] = useState<string | null>(initialSignature);

  // Sync initial signature if updated from props
  useEffect(() => {
    if (initialSignature !== undefined) {
      setSignaturePreview(initialSignature);
    }
  }, [initialSignature]);

  // Orientation lock attempt helper
  const tryLockLandscape = useCallback(async () => {
    let locked = false;
    try {
      if (
        typeof screen !== 'undefined' &&
        screen.orientation &&
        typeof (screen.orientation as any).lock === 'function'
      ) {
        await (screen.orientation as any).lock('landscape');
        locked = true;
      }
    } catch {
      locked = false;
    }

    const isPortrait =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(orientation: portrait)').matches;

    if (!locked && isPortrait) {
      setShowOrientationHint(true);
    } else {
      setShowOrientationHint(false);
    }
  }, []);

  const tryUnlockOrientation = useCallback(() => {
    try {
      if (
        typeof screen !== 'undefined' &&
        screen.orientation &&
        typeof screen.orientation.unlock === 'function'
      ) {
        screen.orientation.unlock();
      }
    } catch {
      // Ignored
    }
  }, []);

  // Listen to orientation change to dismiss hint once rotated
  useEffect(() => {
    if (!isExpanded) return;

    const handleOrientationChange = () => {
      const isPortrait =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(orientation: portrait)').matches;
      if (!isPortrait) {
        setShowOrientationHint(false);
      }
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isExpanded]);

  // Open fullscreen modal
  const openExpanded = useCallback(() => {
    setIsExpanded(true);
    setValidationError(null);
    tryLockLandscape();
  }, [tryLockLandscape]);

  // Close fullscreen modal
  const closeExpanded = useCallback(() => {
    setIsExpanded(false);
    setValidationError(null);
    setShowOrientationHint(false);
    tryUnlockOrientation();
  }, [tryUnlockOrientation]);

  // Helper to get coordinates on canvas
  const getCanvasPos = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Re-render strokes when strokes array changes in modal
  useEffect(() => {
    if (!isExpanded) return;
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    redrawAllStrokes(ctx, rect.width, rect.height, strokes, '#000000', 3.5);
  }, [isExpanded, strokes]);

  // Draw on active canvas
  const handlePointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
    isModal: boolean
  ) => {
    if (!isModal) {
      e.preventDefault();
      openExpanded();
      return;
    }

    e.preventDefault();
    const canvas = modalCanvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    isDrawingRef.current = true;
    setValidationError(null);

    const pos = getCanvasPos(canvas, e.clientX, e.clientY);
    currentStrokeRef.current = [pos];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3.5 / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasPos(canvas, e.clientX, e.clientY);
    const stroke = currentStrokeRef.current;

    stroke.push(pos);

    if (stroke.length >= 3) {
      const len = stroke.length;
      const pPrev = stroke[len - 2];
      const pPrevPrev = stroke[len - 3];
      const xc1 = (pPrevPrev.x + pPrev.x) / 2;
      const yc1 = (pPrevPrev.y + pPrev.y) / 2;
      const xc2 = (pPrev.x + pos.x) / 2;
      const yc2 = (pPrev.y + pos.y) / 2;

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(xc1, yc1);
      ctx.quadraticCurveTo(pPrev.x, pPrev.y, xc2, yc2);
      ctx.stroke();
      ctx.restore();
    } else if (stroke.length === 2) {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      ctx.lineTo(stroke[1].x, stroke[1].y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUpOrLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = modalCanvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }

    if (currentStrokeRef.current.length > 0) {
      const newStroke = [...currentStrokeRef.current];
      setStrokes((prev) => [...prev, newStroke]);
      currentStrokeRef.current = [];
    }
  };

  const handleUndo = () => {
    setValidationError(null);
    setStrokes((prev) => (prev.length > 0 ? prev.slice(0, prev.length - 1) : prev));
  };

  const handleClear = () => {
    setValidationError(null);
    setStrokes([]);
  };

  const handleValidate = () => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;

    const check = isSignatureValid(strokes, 70, 16);
    if (!check.valid) {
      setValidationError(check.reason || 'Signature trop courte, recommencez');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const transparentPng = exportCroppedTransparentSignaturePng(
      strokes,
      rect.width,
      rect.height,
      18,
      600,
      240
    );

    if (!transparentPng) {
      setValidationError('Signature trop courte, recommencez');
      return;
    }

    setSignaturePreview(transparentPng);
    onSignatureChange(transparentPng);
    closeExpanded();
  };

  const handleClearDirect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStrokes([]);
    setSignaturePreview(null);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-1.5 select-none">
      {/* Label and inline action header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-semibold text-[#ECE9E2] flex items-center gap-1.5">
            <span>{label}</span>
            {required && <span className="text-[#E5604D]">*</span>}
            {signaturePreview && <CheckCircle2 className="w-3.5 h-3.5 text-[#5FB48C] inline" />}
          </label>
          {subtitle && <p className="text-xs text-[#98A2B0]">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {signaturePreview && (
            <button
              type="button"
              onClick={handleClearDirect}
              className="min-h-[44px] flex items-center gap-1 text-xs text-[#98A2B0] hover:text-[#E5604D] transition cursor-pointer px-2.5 rounded-[8px] bg-[#151A22] border border-[#2A3340]"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          )}

          <button
            type="button"
            onClick={openExpanded}
            className="min-h-[44px] flex items-center gap-1.5 text-xs font-semibold text-[#151A22] bg-[#C8A96A] hover:bg-[#d6b777] transition cursor-pointer px-3 rounded-[8px]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Agrandir</span>
          </button>
        </div>
      </div>

      {/* Small inline signature box */}
      <div
        onClick={openExpanded}
        className="relative rounded-[8px] border border-[#2A3340] bg-white overflow-hidden cursor-pointer touch-none h-28 group transition hover:border-[#C8A96A]"
        style={{ touchAction: 'none' }}
      >
        {signaturePreview ? (
          <div className="w-full h-full p-2 flex items-center justify-center">
            <img
              src={signaturePreview}
              alt="Signature"
              className="max-h-full max-w-full object-contain pointer-events-none"
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1.5">
            <span className="text-xs italic font-medium">
              Touchez ici ou cliquez sur « Agrandir » pour signer
            </span>
            <span className="text-[11px] text-[#151A22] font-semibold px-2 py-0.5 rounded-[4px] bg-[#C8A96A]">
              Plein écran disponible
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] text-slate-400 font-mono">
          {signaturePreview ? 'Signature enregistrée' : 'Format PNG transparent'}
        </div>
      </div>

      {/* FULLSCREEN SIGNATURE OVERLAY (MODAL) */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[100] bg-[#151A22] flex flex-col text-[#ECE9E2] select-none overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          {/* Top Bar */}
          <div className="px-4 py-3 bg-[#1C232D] border-b border-[#2A3340] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#ECE9E2]">{label}</span>
              <span className="text-xs text-[#98A2B0] hidden sm:inline">• Tracé lissé</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Undo Button */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#ECE9E2] text-xs font-medium border border-[#2A3340] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Annuler dernier trait</span>
                <span className="sm:hidden">Annuler</span>
              </button>

              {/* Clear Button */}
              <button
                type="button"
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-[8px] bg-[#151A22] hover:bg-[#2A3340] text-[#E5604D] text-xs font-medium border border-[#2A3340] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>

              {/* Validate Button */}
              <button
                type="button"
                onClick={handleValidate}
                className="min-h-[44px] flex items-center gap-1.5 px-4 rounded-[8px] bg-[#C8A96A] hover:bg-[#d6b777] text-[#151A22] text-xs font-semibold transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Valider</span>
              </button>

              {/* Close Button without saving */}
              <button
                type="button"
                onClick={closeExpanded}
                className="min-h-[44px] min-w-[44px] rounded-[8px] bg-[#151A22] text-[#98A2B0] hover:text-[#ECE9E2] border border-[#2A3340] transition cursor-pointer flex items-center justify-center ml-1"
                aria-label="Fermer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Orientation warning banner if phone is still portrait */}
          {showOrientationHint && (
            <div className="px-4 py-2 bg-[#1C232D] border-b border-[#2A3340] text-[#C8A96A] text-xs flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#C8A96A] rotate-90 shrink-0" />
                <span className="font-medium">
                  Tourne ton téléphone pour signer plus confortablement
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOrientationHint(false)}
                className="text-xs text-[#98A2B0] hover:text-[#ECE9E2] cursor-pointer"
              >
                Ignorer
              </button>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="px-4 py-2 bg-[#1C232D] border-b border-[#E5604D] text-[#E5604D] text-xs flex items-center gap-2 font-medium shrink-0">
              <AlertCircle className="w-4 h-4 text-[#E5604D] shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Canvas area */}
          <div
            className="flex-1 relative bg-white m-3 sm:m-4 rounded-[8px] border border-[#2A3340] overflow-hidden"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={modalCanvasRef}
              className="w-full h-full cursor-crosshair block"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => handlePointerDown(e, true)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrLeave}
              onPointerCancel={handlePointerUpOrLeave}
            />

            {/* Baseline */}
            <div className="pointer-events-none absolute left-8 right-8 bottom-16 sm:bottom-20 border-b border-dashed border-slate-300 flex items-center justify-between text-xs text-slate-400 select-none pb-1">
              <span>Ligne de signature</span>
              <span className="text-[10px] font-mono">X ................................................................</span>
            </div>

            {/* Discreet watermark */}
            {strokes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 text-2xl sm:text-3xl font-serif italic tracking-wide select-none">
                Signez ici
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
