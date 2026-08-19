'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { trapDialogTabKey } from '@/features/resume/ui';
import { useUserStore } from '@/stores/useUserStore';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme-bootstrap.mjs';

interface ThemeOption {
  key: Theme;
  name: string;
  page: string;
  accent: string;
}

/** Display metadata for the theme picker (swatches use literal colors). */
const THEME_OPTIONS: ThemeOption[] = [
  { key: 'dark', name: '暗色', page: '#080b0e', accent: '#46d9f2' },
  { key: 'light', name: '亮色', page: '#f3f6f8', accent: '#007e99' },
  { key: 'cyberpunk', name: '赛博朋克', page: '#06060b', accent: '#8b5cf6' },
  { key: 'amber', name: '暮色琥珀', page: '#1a1410', accent: '#f59e0b' },
  { key: 'ocean', name: '深海', page: '#0a1220', accent: '#60a5fa' },
  { key: 'forest', name: '森林', page: '#0f1512', accent: '#34d399' },
];

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const theme = useUserStore((state) => state.theme);
  const setTheme = useUserStore((state) => state.setTheme);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === 'Tab' && dialogRef.current) {
        trapDialogTabKey(event, dialogRef.current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (dialogRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const select = (key: Theme) => {
    setTheme(key);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
        title="选择主题"
      >
        <Palette className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="sr-only">选择主题</span>
      </button>
      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="选择主题"
          tabIndex={-1}
          className="absolute right-0 top-[calc(100%+8px)] z-[1100] w-44 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
        >
          {THEME_OPTIONS.map((option) => {
            const active = option.key === theme;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => select(option.key)}
                aria-pressed={active}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                  active
                    ? 'bg-[var(--surface-hover)] font-medium text-[var(--ink)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
                )}
              >
                <span className="flex items-center" aria-hidden="true">
                  <span
                    className="h-4 w-4 rounded-[3px] border border-[var(--line-strong)]"
                    style={{ background: option.page }}
                  />
                  <span
                    className="-ml-1.5 h-4 w-4 rounded-[3px] border border-[var(--line-strong)]"
                    style={{ background: option.accent }}
                  />
                </span>
                <span className="flex-1 text-left">{option.name}</span>
                {active ? (
                  <Check className="h-4 w-4 text-[var(--accent-ink)]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
