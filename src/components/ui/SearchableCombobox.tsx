'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Trash2, Plus, Check } from 'lucide-react';

interface SearchableComboboxProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  onAddOption?: (newOption: string) => void;
  onDeleteOption?: (optionToDelete: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function SearchableCombobox({
  value,
  onChange,
  options,
  onAddOption,
  onDeleteOption,
  placeholder = 'Select or type to search...',
  required = false,
  className = '',
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFiltering(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on typed keyword when filtering
  const filtered = isFiltering && keyword.trim()
    ? options.filter((opt) => opt.toLowerCase().includes(keyword.toLowerCase().trim()))
    : options;

  const currentText = isFiltering ? keyword : value;
  const isExactMatch = options.some(
    (opt) => opt.toLowerCase() === currentText.toLowerCase().trim()
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setKeyword(val);
    setIsFiltering(true);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelect = (opt: string) => {
    onChange(opt);
    setKeyword(opt);
    setIsFiltering(false);
    setIsOpen(false);
  };

  const handleAdd = () => {
    const toAdd = currentText.trim().toUpperCase();
    if (toAdd && onAddOption) {
      onAddOption(toAdd);
      onChange(toAdd);
      setKeyword(toAdd);
      setIsFiltering(false);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length === 1) {
        handleSelect(filtered[0]);
      } else if (!isExactMatch && currentText.trim() && onAddOption) {
        handleAdd();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setIsFiltering(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          required={required}
          value={isOpen && isFiltering ? keyword : value}
          onChange={handleInputChange}
          onFocus={() => {
            setKeyword(value || '');
            setIsFiltering(false);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase font-medium transition-all shadow-2xs"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setKeyword(value || '');
            setIsFiltering(false);
            setIsOpen(!isOpen);
          }}
          className="absolute right-2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-transform"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((opt) => {
                const isSelected = opt.toUpperCase() === (value || '').toUpperCase();
                return (
                  <div
                    key={opt}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-semibold cursor-pointer transition-colors group ${
                      isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      <span>{opt}</span>
                    </span>

                    {onDeleteOption && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onDeleteOption(opt);
                        }}
                        className="opacity-70 group-hover:opacity-100 p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-all ml-2 shrink-0 cursor-pointer"
                        title={`Delete ${opt}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2.5 text-xs text-slate-400 italic text-center">
                No matching options found
              </div>
            )}
          </div>

          {/* Add New Option Button */}
          {currentText.trim() && !isExactMatch && onAddOption && (
            <div className="p-1.5 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={handleAdd}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add &quot;{currentText.trim().toUpperCase()}&quot;</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
