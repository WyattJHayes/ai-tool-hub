'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Command, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToolStore } from '@/stores/useToolStore';
import { ToolIcon } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { getSearchSuggestions } from '@/lib/search-suggestions.mjs';
import type { Tool } from '@/types/tool';

interface SearchBarProps {
  value?: string;
  placeholder?: string;
  ariaLabel?: string;
  compact?: boolean;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

interface SearchOption {
  key: string;
  value: string;
  label: string;
  kind: 'history' | 'suggestion';
  tool?: Tool;
}

export function SearchBar({ value: controlledValue, placeholder = '搜索工具、任务或能力', ariaLabel = placeholder, compact = false, onValueChange, onSubmit }: SearchBarProps = {}) {
  const router = useRouter();
  const instanceId = useId();
  const [value, setValue] = useState(controlledValue || '');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const addSearchHistory = useToolStore((state) => state.addSearchHistory);
  const searchHistory = useToolStore((state) => state.searchHistory);
  const tools = useToolStore((state) => state.tools);

  const suggestions = useMemo(
    () => getSearchSuggestions(tools, value),
    [tools, value]
  );
  const options = useMemo<SearchOption[]>(() => {
    if (!value) {
      return searchHistory.map((term) => ({
        key: `history-${term}`,
        value: term,
        label: `再次搜索 ${term}`,
        kind: 'history',
      }));
    }
    return suggestions.map((tool) => ({
      key: `suggestion-${tool.id}`,
      value: tool.name,
      label: `搜索 ${tool.name}`,
      kind: 'suggestion',
      tool,
    }));
  }, [searchHistory, suggestions, value]);
  const listboxId = `${instanceId}-options`;
  const showDropdown = focused && !popupDismissed && options.length > 0;
  const activeOption = showDropdown && activeIndex >= 0 ? options[activeIndex] : undefined;
  const activeOptionId = activeOption ? `${instanceId}-option-${activeIndex}` : undefined;

  const openResultsPage = useCallback((term: string) => {
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    router.push(`/tools${params.size ? `?${params.toString()}` : ''}`);
  }, [router]);

  useEffect(() => {
    // The local draft must reconcile when URL-driven controlled state changes.
    if (controlledValue !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(controlledValue);
    }
  }, [controlledValue]);

  const handleChange = useCallback((nextValue: string) => {
    setValue(nextValue);
    setActiveIndex(-1);
    setPopupDismissed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onValueChange?.(nextValue), 300);
  }, [onValueChange]);

  const submitTerm = useCallback((rawValue: string) => {
    const term = rawValue.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue(term);
    setFocused(false);
    setActiveIndex(-1);
    setPopupDismissed(true);
    if (term) addSearchHistory(term);
    if (onSubmit) onSubmit(term);
    else openResultsPage(term);
    inputRef.current?.blur();
  }, [addSearchHistory, onSubmit, openResultsPage]);

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitTerm(value);
  }, [submitTerm, value]);

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
    setActiveIndex(-1);
    setPopupDismissed(false);
    onValueChange?.('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return;
      event.preventDefault();
      setPopupDismissed(false);
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current >= options.length - 1 ? 0 : current + 1;
        return current <= 0 ? options.length - 1 : current - 1;
      });
      return;
    }
    if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      submitTerm(activeOption.value);
      return;
    }
    if (event.key === 'Escape' && (showDropdown || activeIndex >= 0)) {
      event.preventDefault();
      setActiveIndex(-1);
      setPopupDismissed(true);
    }
  };

  return (
    <form className="relative w-full" role="search" onSubmit={handleSubmit}>
      <div
        data-search-shell
        className={cn(
          'relative flex items-center rounded-lg border bg-[var(--surface)] transition-colors',
          compact ? 'h-11' : 'h-14',
          focused
            ? 'border-[var(--accent)] outline outline-2 outline-offset-2 outline-[var(--accent)]'
            : 'border-[var(--line-strong)] hover:border-[var(--muted-subtle)]'
        )}
      >
        <Search className="ml-4 h-5 w-5 shrink-0 text-[var(--muted-subtle)]" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            setFocused(true);
            setPopupDismissed(false);
          }}
          onBlur={() => {
            setFocused(false);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 appearance-none bg-transparent px-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted-subtle)] [&::-webkit-search-cancel-button]:hidden"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          aria-expanded={showDropdown}
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="清除搜索"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="hidden items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--muted)] sm:flex" aria-hidden="true">
            <Command className="h-3 w-3" /> K
          </span>
        )}
        <button
          type="submit"
          aria-label="提交搜索"
          title="搜索"
          className={cn(
            'mr-1 flex h-11 shrink-0 items-center justify-center rounded-md transition-colors',
            compact
              ? 'w-11 text-[var(--accent)] hover:bg-[var(--accent-soft)]'
              : 'min-w-[64px] bg-[var(--accent)] px-5 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]'
          )}
        >
          {compact ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : '搜索'}
        </button>
      </div>

      {showDropdown ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
          {!value ? (
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> 最近搜索
            </div>
          ) : null}
          <div id={listboxId} role="listbox">
            {options.map((option, index) => (
              <button
                type="button"
                role="option"
                id={`${instanceId}-option-${index}`}
                aria-selected={activeIndex === index}
                tabIndex={-1}
                key={option.key}
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => submitTerm(option.value)}
                className={cn(
                  'flex min-h-12 w-full items-center border-l-[3px] border-l-transparent border-b border-[var(--line)] px-4 text-left last:border-b-0 hover:bg-[var(--surface-hover)]',
                  option.kind === 'suggestion' ? 'min-h-[60px] gap-3' : 'justify-between',
                  activeIndex === index && 'border-l-[var(--accent)] bg-[var(--accent-soft)]'
                )}
                aria-label={option.label}
              >
                {option.tool ? (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-subtle)] text-[var(--accent)]">
                      <ToolIcon name={option.tool.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--ink)]">{option.tool.name}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{option.tool.desc}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-[var(--muted)]">{option.value}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-subtle)]" aria-hidden="true" />
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
