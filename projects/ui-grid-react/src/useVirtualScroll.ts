import { useCallback, useRef, useState } from 'react';

export interface UseVirtualScrollOptions {
  itemCount: number;
  itemSize: number;
  viewportHeight: number;
  overscan?: number;
}

export interface UseVirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  scrollTop: number;
}

export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollResult {
  const { itemCount, itemSize, viewportHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const rawStart = Math.floor(scrollTop / itemSize) - overscan;
  const start = Math.max(0, rawStart);
  const rawEnd = rawStart + Math.ceil(viewportHeight / itemSize) + 2 * overscan;
  const end = Math.min(itemCount, rawEnd);

  const totalHeight = itemCount * itemSize;
  const offsetY = start * itemSize;

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleRange: { start, end },
    totalHeight,
    offsetY,
    onScroll,
    viewportRef,
    scrollTop,
  };
}
