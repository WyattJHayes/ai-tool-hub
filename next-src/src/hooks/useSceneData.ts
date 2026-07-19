'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearScenesDataCache, getScenesData } from '@/lib/tools-data';
import type { Scene } from '@/types/tool';

export function useSceneData() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestGeneration = useRef(0);

  const retry = useCallback(() => {
    requestGeneration.current += 1;
    clearScenesDataCache();
    setIsLoading(true);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const generation = requestGeneration.current;
    getScenesData()
      .then((data) => {
        if (!active || generation !== requestGeneration.current) return;
        if (!Array.isArray(data.scenes)) throw new Error('Invalid scene payload');
        setScenes(data.scenes);
      })
      .catch(() => {
        if (active && generation === requestGeneration.current) {
          setError('任务数据暂时无法加载');
        }
      })
      .finally(() => {
        if (active && generation === requestGeneration.current) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return { scenes, isLoading, error, retry };
}
