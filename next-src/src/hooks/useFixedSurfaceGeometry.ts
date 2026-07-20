'use client';

import { useLayoutEffect, type RefObject } from 'react';

export function useFixedSurfaceGeometry(
  ref: RefObject<HTMLElement | null>,
  cssVariable: '--mobile-nav-block-size' | '--compare-tray-block-size',
  enabled: boolean
) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const element = ref.current;
    if (!enabled || !element) {
      root.style.setProperty(cssVariable, '0px');
      return;
    }

    const update = () => root.style.setProperty(cssVariable, `${Math.ceil(element.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();

    return () => {
      observer.disconnect();
      root.style.setProperty(cssVariable, '0px');
    };
  }, [cssVariable, enabled, ref]);
}
