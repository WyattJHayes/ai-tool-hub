'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Command, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToolStore } from '@/stores/useToolStore';
import { ToolIcon } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { getSearchSuggestions } from '@/lib/search-suggestions.mjs';

interface SearchBarProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export function SearchBar({ value: controlledValue, onValueChange, onSubmit }: SearchBarProps = {}) {
  const router = useRouter();
  const [value, setValue] = useState(controlledValue || '');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const addSearchHistory = useToolStore((state) => state.addSearchHistory);
  const searchHistory = useToolStore((state) => state.searchHistory);
  const tools = useToolStore((state) => state.tools);

  const suggestions = useMemo(
    () => getSearchSuggestions(tools, value),
    [tools, value]
  );

  const openResultsPage = useCallback((term: string) => {
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    router.push(`/tools${params.size ? `?${params.toString()}` : ''}`);
  }, [router]);

  useEffect(() => {
    // The local draft must reconcile when URL-driven controlled state changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (controlledValue !== undefined) setValue(controlledValue);
  }, [controlledValue]);

  const handleChange = useCallback((nextValue: string) => {
    setValue(nextValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onValueChange?.(nextValue), 300);
  }, [onValueChange]);

  const submitTerm = useCallback((rawValue: string) => {
    const term = rawValue.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue(term);
    if (term) addSearchHistory(term);
    if (onSubmit) onSubmit(term);
    else openResultsPage(term);
    inputRef.current?.blur();
  }, [addSearchHistory, onSubmit, openResultsPage]);

  const handleSubmit = useCallback(() => submitTerm(value), [submitTerm, value]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue('');
    onValueChange?.('');
    inputRef.current?.focus();
  };

  const showHistory = focused && !value && searchHistory.length > 0;
  const showSuggestions = Boolean(focused && value && suggestions.length > 0);
  const showDropdown = showHistory || showSuggestions;

  return (
    <div className="relative w-full">
      <div
        className={cn(
          'relative flex h-14 items-center rounded-lg border bg-[var(--surface)] transition-colors duration-150',
          focused
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]'
            : 'border-[var(--line-strong)] hover:border-[var(--muted-subtle)]'
        )}
      >
        <Search className="ml-4 h-5 w-5 shrink-0 text-[var(--muted-subtle)]" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
            if (event.key === 'Escape') handleClear();
          }}
          placeholder="搜索工具、用途或任务"
          className="h-full min-w-0 flex-1 appearance-none bg-transparent px-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted-subtle)] [&::-webkit-search-cancel-button]:hidden"
          role="combobox"
          aria-autocomplete="list"
          aria-label="搜索工具、用途或任务"
          aria-controls="tool-search-options"
          aria-expanded={showDropdown}
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="清除搜索"
            className="mr-1 flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="mr-3 hidden items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--muted)] sm:flex" aria-hidden="true">
            <Command className="h-3 w-3" /> K
          </span>
        )}
      </div>

      {showDropdown ? (
        <div
          id="tool-search-options"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_30px_rgba(23,26,23,0.12)]"
        >
          {showHistory ? (
            <div>
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
                <Clock className="h-3.5 w-3.5" /> 最近搜索
              </div>
              {searchHistory.map((term) => (
                <button
                  type="button"
                  key={term}
                  onMouseDown={() => {
                    submitTerm(term);
                  }}
                  className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                  aria-label={`再次搜索 ${term}`}
                >
                  <span>{term}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-subtle)]" />
                </button>
              ))}
            </div>
          ) : null}

          {showSuggestions ? suggestions.map((tool) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={tool.id}
              onMouseDown={() => {
                submitTerm(tool.name);
              }}
              className="flex min-h-[60px] w-full items-center gap-3 border-b border-[var(--line)] px-4 text-left last:border-b-0 hover:bg-[var(--surface-subtle)]"
              aria-label={`搜索 ${tool.name}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]">
                <ToolIcon name={tool.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--ink)]">{tool.name}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{tool.desc}</span>
              </span>
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}
