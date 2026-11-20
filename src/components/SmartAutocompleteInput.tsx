import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeWhitespace } from '../utils/sarabanUtils';

interface SmartAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  matchMode?: 'includes' | 'startsWith';
}

interface DropdownRect {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export function SmartAutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className = '',
  ariaLabel,
  matchMode = 'includes',
}: SmartAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);

  const prefixQuery = useMemo(() => {
    if (matchMode !== 'startsWith') return '';
    return value.trimStart().replace(/\s+/g, ' ');
  }, [value, matchMode]);

  const filtered = useMemo(() => {
    if (matchMode === 'startsWith') {
      const query = prefixQuery.toLocaleLowerCase('th-TH');
      if (!query) return [];
      return suggestions
        .map((item) => normalizeWhitespace(item))
        .filter((item) => {
          const lower = item.toLocaleLowerCase('th-TH');
          return lower.startsWith(query) && lower !== query;
        })
        .slice(0, 12);
    }

    const query = normalizeWhitespace(value).toLocaleLowerCase('th-TH');
    if (!query) return [];
    return suggestions
      .filter((item) => {
        const lower = item.toLocaleLowerCase('th-TH');
        return lower.includes(query) && lower !== query;
      })
      .slice(0, 12);
  }, [value, suggestions, matchMode, prefixQuery]);

  const showDropdown = isOpen && filtered.length > 0;

  const updateDropdownPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setDropdownRect(null);
      return;
    }

    const margin = 12;
    const gap = 4;
    const preferredMaxHeight = 208;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
    if (openUpward) {
      setDropdownRect({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + gap,
        maxHeight: Math.min(preferredMaxHeight, Math.max(110, spaceAbove - gap)),
      });
    } else {
      setDropdownRect({
        left: rect.left,
        width: rect.width,
        top: rect.bottom + gap,
        maxHeight: Math.min(preferredMaxHeight, Math.max(110, spaceBelow - gap)),
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!showDropdown) {
      setDropdownRect(null);
      return;
    }
    updateDropdownPosition();
  }, [showDropdown, filtered.length, updateDropdownPosition]);

  useEffect(() => {
    if (!showDropdown) return;
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          setActiveIndex(-1);
          setIsOpen(
            matchMode === 'startsWith'
              ? next.trimStart().length > 0
              : normalizeWhitespace(next).length > 0
          );
        }}
        onBlur={() => {
          setIsOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
          } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
            e.preventDefault();
            handleSelect(filtered[activeIndex]);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
        className={className}
      />

      {showDropdown &&
        dropdownRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <ul
            role="listbox"
            style={{
              position: 'fixed',
              left: dropdownRect.left,
              width: dropdownRect.width,
              top: dropdownRect.top,
              bottom: dropdownRect.bottom,
              maxHeight: dropdownRect.maxHeight,
            }}
            className="z-[9999] bg-white border border-[#C9C4DC] rounded-xl shadow-xl overflow-y-auto py-1 saraban-scroll"
          >
            {filtered.map((item, idx) => (
              <li key={item}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                    idx === activeIndex
                      ? 'bg-[#ECEAF4] text-[#242038] font-semibold'
                      : 'text-slate-800 hover:bg-[#F5F4F9] hover:text-[#242038]'
                  }`}
                >
                  {matchMode === 'startsWith' && prefixQuery.length > 0 ? (
                    <>
                      <span className="font-bold text-[#574F7D]">
                        {item.slice(0, prefixQuery.length)}
                      </span>
                      <span>{item.slice(prefixQuery.length)}</span>
                    </>
                  ) : (
                    item
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
