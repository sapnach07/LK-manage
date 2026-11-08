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
  drawStroke,
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
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
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

    // If orientation lock fails or isn't supported, check if current screen is portrait
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
    // If inline and user touches or clicks, immediately open fullscreen mode as requested!
    if (!isModal) {
      e.preventDefault();
      openExpanded();
      return;
    }

    e.preventDefault();
    const canvas = modalCanvasRef.current;
    if (!canvas) return;

    // Capture pointer to prevent losing touches outside canvas boundary
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

  // Undo last stroke action
  const handleUndo = () => {
    setValidationError(null);
    setStrokes((prev) => (prev.length > 0 ? prev.slice(0, prev.length - 1) : prev));
  };

  // Clear all strokes
  const handleClear = () => {
    setValidationError(null);
    setStrokes([]);
  };

  // Validate and export signature
  const handleValidate = () => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;

    // Check minimum stroke length & non-empty
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
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <span>{label}</span>
            {required && <span className="text-rose-400">*</span>}
            {signaturePreview && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" />}
          </label>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {signaturePreview && (
            <button
              type="button"
              onClick={handleClearDirect}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer px-2 py-0.5 rounded bg-slate-800"
            >
              <Eraser className="w-3 h-3" />
              <span>Effacer</span>
            </button>
          )}

          <button
            type="button"
            onClick={openExpanded}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Agrandir</span>
          </button>
        </div>
      </div>

      {/* Small inline signature box */}
      <div
        onClick={openExpanded}
        className="relative rounded-xl border border-slate-700 bg-white shadow-inner overflow-hidden cursor-pointer touch-none h-28 group transition hover:border-amber-400/80"
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
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <span className="text-xs italic font-medium text-slate-500">
              Touchez ici ou cliquez sur « Agrandir » pour signer
            </span>
            <span className="text-[10px] text-amber-600/80 font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
              Plein écran disponible
            </span>
          </div>
        )}

        {/* Floating badge inside inline box */}
        <div className="pointer-events-none absolute bottom-1.5 right-2 text-[9px] text-slate-400 font-mono">
          {signaturePreview ? 'Signature enregistrée' : 'Format PNG transparent'}
        </div>
      </div>

      {/* FULLSCREEN SIGNATURE OVERLAY (MODAL) */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950 flex flex-col text-slate-100 select-none overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          {/* Top Bar */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{label}</span>
              <span className="text-xs text-slate-400 hidden sm:inline">• Tracé tactile lissé</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Undo Button */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Annuler le dernier trait</span>
                <span className="xs:hidden">Annuler</span>
              </button>

              {/* Clear Button */}
              <button
                type="button"
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>

              {/* Validate Button */}
              <button
                type="button"
                onClick={handleValidate}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Valider</span>
              </button>

              {/* Close Button without saving */}
              <button
                type="button"
                onClick={closeExpanded}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer ml-1"
                aria-label="Fermer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Orientation warning banner if phone is still portrait */}
          {showOrientationHint && (
            <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs flex items-center justify-between shrink-0 animate-pulse">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-400 rotate-90 shrink-0" />
                <span className="font-medium">
                  Tourne ton téléphone pour signer plus confortablement
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOrientationHint(false)}
                className="text-[10px] text-amber-400 hover:underline cursor-pointer"
              >
                Ignorer
              </button>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="px-4 py-2 bg-rose-500/20 border-b border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 font-medium shrink-0 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Very large signature canvas area: white background, black ink, baseline, discreet "Signez ici" */}
          <div
            className="flex-1 relative bg-white m-3 sm:m-4 rounded-2xl shadow-2xl border-2 border-slate-300 overflow-hidden"
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

            {/* Baseline for comfortable handwriting */}
            <div className="pointer-events-none absolute left-8 right-8 bottom-16 sm:bottom-20 border-b border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-400 select-none pb-1">
              <span>Ligne de signature</span>
              <span className="text-[10px] font-mono">X ................................................................</span>
            </div>

            {/* Discreet watermark "Signez ici" */}
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
