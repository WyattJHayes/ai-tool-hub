'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Command, Clock, ArrowRight } from 'lucide-react';
import { useToolStore } from '@/stores/useToolStore';
import { ToolIcon } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { getSearchSuggestions } from '@/lib/search-suggestions.mjs';

export function SearchBar() {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setSearchTerm = useToolStore((s) => s.setSearchTerm);
  const addSearchHistory = useToolStore((s) => s.addSearchHistory);
  const searchHistory = useToolStore((s) => s.searchHistory);
  const tools = useToolStore((s) => s.tools);

  const suggestions = useMemo(
    () => getSearchSuggestions(tools, value),
    [tools, value]
  );

  // Debounced search
  const handleChange = useCallback(
    (v: string) => {
      setValue(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchTerm(v);
      }, 300);
    },
    [setSearchTerm]
  );

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      setSearchTerm(value);
      addSearchHistory(value.trim());
    }
    inputRef.current?.blur();
  }, [value, setSearchTerm, addSearchHistory]);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleClear = () => {
    setValue('');
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const showHistory = focused && !value && searchHistory.length > 0;
  const showSuggestions = focused && suggestions.length > 0 && value;
  const showDropdown = showHistory || showSuggestions;

  return (
    <div className="relative w-full">
      <div
        className={cn(
          'relative flex h-16 items-center rounded-2xl border',
          'bg-white/5 backdrop-blur-xl transition-all duration-300',
          focused
            ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
            : 'border-white/10 hover:border-white/20'
        )}
      >
        <Search className="ml-5 h-5 w-5 shrink-0 text-white/30" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="搜索 AI 工具..."
          className="h-full flex-1 bg-transparent px-4 text-base text-white outline-none placeholder:text-white/25"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="清除搜索"
            className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {!value && (
          <div className="mr-5 hidden items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/30 sm:flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        )}
      </div>

      {/* Dropdown: search history or suggestions */}
      {showDropdown && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10',
            'bg-[#141414]/95 backdrop-blur-xl shadow-2xl'
          )}
        >
          {/* S-03: Search history */}
          {showHistory && (
            <div className="border-b border-white/5">
              <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                <Clock className="h-3 w-3 text-white/20" />
                <span className="text-[11px] text-white/25">最近搜索</span>
              </div>
              {searchHistory.map((term) => (
                <button
                  type="button"
                  key={term}
                  aria-label={`再次搜索 ${term}`}
                  onMouseDown={() => {
                    handleChange(term);
                    inputRef.current?.blur();
                  }}
                  className="flex w-full items-center justify-between px-5 py-2.5 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <span>{term}</span>
                  <ArrowRight className="h-3 w-3 text-white/20" />
                </button>
              ))}
            </div>
          )}

          {/* Tool suggestions */}
          {showSuggestions && suggestions.map((tool) => (
            <button
              type="button"
              key={tool.id}
              aria-label={`搜索 ${tool.name}`}
              onMouseDown={() => {
                handleChange(tool.name);
                addSearchHistory(tool.name);
                inputRef.current?.blur();
              }}
              className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ToolIcon name={tool.icon} className="h-5 w-5 text-white/50" />
              <div className="flex flex-col">
                <span className="font-medium text-white/90">{tool.name}</span>
                <span className="truncate text-xs text-white/40">{tool.desc}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
