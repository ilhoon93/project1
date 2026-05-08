'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export interface SignaturePadHandle {
  /** Returns base64 data URL or null if empty. */
  toDataURL: () => string | null;
  clear: () => void;
}

interface Props {
  /** Height in CSS pixels. Width is now derived from the parent container so
   *  the pad can align with surrounding inputs. */
  height?: number;
  className?: string;
}

/**
 * Lightweight canvas signature pad. Uses pointer events so it works for
 * mouse, touch and pen with no extra branching.
 *
 * Width is intentionally responsive (`w-full`) — the bitmap is sized to the
 * wrapper's measured client width on mount and on size changes, so the pad
 * lines up with sibling inputs in flex/grid layouts. Stroke + border colors
 * read from CSS theme vars (`--mw-fg` / `--mw-dot`) so they follow the
 * selected palette instead of being locked to the cream theme.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 140, className },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const setupCanvas = () => {
      const cssWidth = wrapper.clientWidth;
      if (cssWidth <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cssWidth * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Theme-aware stroke color — falls back to cream's fg if the CSS var
      // hasn't been set (e.g. signature pad used outside SlideContainer).
      const fg = getComputedStyle(wrapper).getPropertyValue('--mw-fg').trim();
      ctx.strokeStyle = fg || '#3D2E1F';
    };

    setupCanvas();

    // Re-init when the wrapper resizes. The canvas content is cleared on
    // re-init — fine for a signature pad that's only sized once on mount.
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [height]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    const last = lastRef.current ?? pos;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    if (isEmpty) setIsEmpty(false);
  };

  const end = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
      const src = canvasRef.current;
      if (isEmpty || !src) return null;
      // Retina(DPR×2~3) 비트맵을 그대로 직렬화하면 200KB+ 가 되어 서버 한도에 걸리므로,
      // 최대 가로 600px 의 작은 캔버스로 다운스케일 후 PNG 로 직렬화한다.
      const MAX_W = 600;
      const ratio = src.height / src.width;
      const outW = Math.min(MAX_W, src.width);
      const outH = Math.round(outW * ratio);
      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d');
      if (!ctx) return src.toDataURL('image/png');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, outW, outH);
      return out.toDataURL('image/png');
    },
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
    },
  }));

  return (
    <div
      ref={wrapperRef}
      className={`w-full overflow-hidden rounded-md border border-[var(--mw-dot)] bg-white ${className ?? ''}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
    </div>
  );
});
