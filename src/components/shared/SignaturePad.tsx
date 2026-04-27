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
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Lightweight canvas signature pad. Uses pointer events so it works
 * for mouse, touch and pen with no extra branching.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { width = 320, height = 140, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // High-DPI: scale up bitmap, leave CSS size alone
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3D2E1F';
  }, [width, height]);

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
      if (isEmpty || !canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png');
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
    <canvas
      ref={canvasRef}
      className={`touch-none rounded-md border border-[#D4C5B0] bg-white ${className ?? ''}`}
      style={{ width, height }}
      onPointerDown={start}
      onPointerMove={draw}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
    />
  );
});
