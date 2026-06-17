import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

export interface PerformanceMetrics {
  fps: number;
  fpsHistory: number[];
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  blockCount: number;
  particleCount: number;
  explosionCount: number;
  physicsBodyCount: number;
  renderTimeMs: number;
  renderTimeHistory: number[];
}

const HISTORY_LENGTH = 60;

export function usePerformanceMetrics(): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    fpsHistory: new Array(HISTORY_LENGTH).fill(60),
    memoryUsed: 0,
    memoryTotal: 0,
    memoryPercent: 0,
    blockCount: 0,
    particleCount: 0,
    explosionCount: 0,
    physicsBodyCount: 0,
    renderTimeMs: 0,
    renderTimeHistory: new Array(HISTORY_LENGTH).fill(0),
  });

  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());
  const rafRef = useRef<number>();

  useEffect(() => {
    let disposed = false;

    const measure = () => {
      if (disposed) return;

      const now = performance.now();
      frameCountRef.current++;

      const elapsed = now - lastFpsUpdateRef.current;
      if (elapsed >= 500) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;

        const state = useGameStore.getState();
        const world = state.world;
        const bodyCount = world?.bodies?.length ?? 0;

        const blocks = state.blocks.size;
        const particles = state.particles.size;
        const explosions = state.explosions.size;

        let memUsed = 0;
        let memTotal = 0;
        let memPercent = 0;

        const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
        if (perfMemory) {
          memUsed = perfMemory.usedJSHeapSize / (1024 * 1024);
          memTotal = perfMemory.totalJSHeapSize / (1024 * 1024);
          memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
        }

        setMetrics((prev) => ({
          ...prev,
          fps,
          fpsHistory: [...prev.fpsHistory.slice(1), fps],
          memoryUsed: Math.round(memUsed * 10) / 10,
          memoryTotal: Math.round(memTotal * 10) / 10,
          memoryPercent: Math.round(memPercent * 10) / 10,
          blockCount: blocks,
          particleCount: particles,
          explosionCount: explosions,
          physicsBodyCount: bodyCount,
          renderTimeMs: Math.round((1000 / fps) * 100) / 100,
          renderTimeHistory: [...prev.renderTimeHistory.slice(1), Math.round((1000 / fps) * 100) / 100],
        }));
      }

      rafRef.current = requestAnimationFrame(measure);
    };

    rafRef.current = requestAnimationFrame(measure);

    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return metrics;
}

export default usePerformanceMetrics;
