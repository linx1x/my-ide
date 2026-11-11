import { useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Hook for drag-resizable panels (mouse + touch via Pointer Events).
 * @param {RefObject} handleRef - ref to the resize handle element
 * @param {"horizontal"|"vertical"} direction - horizontal = left/right (width), vertical = up/down (height)
 * @param {number} min - minimum value in px
 * @param {number} max - maximum value in px
 * @param {(value: number) => void} onResize - called with new value during drag
 * @param {() => number} getStartValue - returns current value at drag start (e.g. from parent)
 */
type ResizeDirection = 'horizontal' | 'vertical';

export function useResizeHandle(
  handleRef: RefObject<HTMLElement | null>,
  direction: ResizeDirection,
  min: number,
  max: number,
  onResize: (value: number) => void,
  getStartValue: () => number
): void {
  const isHorizontal = direction === 'horizontal';
  const getStartValueRef = useRef(getStartValue);
  const onResizeRef = useRef(onResize);
  getStartValueRef.current = getStartValue;
  onResizeRef.current = onResize;

  const readStartDimension = useCallback(() => {
    const el = handleRef.current;
    const sidebar = el?.closest('.sidebar') as HTMLElement | null;
    const terminalPanel = el?.closest('.terminal-panel, .chat-terminal-section') as HTMLElement | null;
    return (
      getStartValueRef.current?.() ??
      (isHorizontal
        ? sidebar?.offsetWidth ?? 400
        : terminalPanel?.offsetHeight ?? 250)
    );
  }, [handleRef, isHorizontal]);

  useEffect(() => {
    const el = handleRef.current;
    if (!el) {
      return;
    }

    const usePointer = typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined';

    const pointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return;
      }
      e.preventDefault();

      const startClient = isHorizontal ? e.clientX : e.clientY;
      const startValue = readStartDimension();
      const captureId = e.pointerId;

      const onMove = (ev: MouseEvent | PointerEvent) => {
        const cur = isHorizontal ? ev.clientX : ev.clientY;
        const delta = isHorizontal ? cur - startClient : startClient - cur;
        const newValue = Math.max(min, Math.min(max, startValue + delta));
        onResizeRef.current(newValue);
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (ev.pointerId !== captureId) {
          return;
        }
        ev.preventDefault();
        onMove(ev);
      };

      const endPointer = (ev?: PointerEvent) => {
        if (ev && ev.pointerId !== captureId) {
          return;
        }
        el.classList.remove('dragging');
        if (el.hasPointerCapture?.(captureId)) {
          el.releasePointerCapture(captureId);
        }
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', endPointer);
        el.removeEventListener('pointercancel', endPointer);
      };

      const endMouse = () => {
        el.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', endMouse);
      };

      el.classList.add('dragging');

      if (usePointer) {
        try {
          el.setPointerCapture(captureId);
        } catch {
          /* ignore */
        }
        el.addEventListener('pointermove', onPointerMove, { passive: false });
        el.addEventListener('pointerup', endPointer);
        el.addEventListener('pointercancel', endPointer);
      } else {
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', endMouse);
      }
    };

    const mouseDown = (e: MouseEvent) => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault();
      pointerDown(e as unknown as PointerEvent);
    };

    if (usePointer) {
      el.addEventListener('pointerdown', pointerDown);
      return () => el.removeEventListener('pointerdown', pointerDown);
    }
    el.addEventListener('mousedown', mouseDown);
    return () => el.removeEventListener('mousedown', mouseDown);
  }, [handleRef, isHorizontal, min, max, readStartDimension]);
}
