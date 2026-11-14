import { useMemo, useState } from 'react';
import { normalizeWhitespace } from '../utils/sarabanUtils';

interface SmartAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function SmartAutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className = '',
  ariaLabel,
}: SmartAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const query = normalizeWhitespace(value).toLocaleLowerCase('th-TH');
    if (!query) return [];
    return suggestions
      .filter((item) => {
        const lower = item.toLocaleLowerCase('th-TH');
        return lower.includes(query) && lower !== query;
      })
      .slice(0, 12);
  }, [value, suggestions]);

  const showDropdown = isOpen && filtered.length > 0;

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          setActiveIndex(-1);
          setIsOpen(normalizeWhitespace(next).length > 0);
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

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border-2 border-[#4F46E5] rounded-xl shadow-lg max-h-48 overflow-y-auto py-1 saraban-scroll"
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
                    ? 'bg-[#EEF2FF] text-[#1E1B4B] font-semibold'
                    : 'text-slate-800 hover:bg-[#EEF2FF] hover:text-[#1E1B4B]'
                }`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
