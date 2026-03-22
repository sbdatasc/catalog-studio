import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, Search } from "lucide-react";
import { apiClient, type EntryListItem } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Props {
  catalogId: string;
  templateId: string;
  templateName: string;
  value: string | null;
  displayValue: string | null;
  onChange: (uuid: string | null, displayName: string | null) => void;
  disabled?: boolean;
}

export function TypeaheadSearch({
  catalogId,
  templateId,
  templateName,
  value,
  displayValue,
  onChange,
  disabled,
}: Props) {
  const [inputText, setInputText] = useState(displayValue ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<EntryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputText(displayValue ?? "");
  }, [displayValue]);

  const doSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      setSearchError(null);
      const { data, error } = await apiClient.entries.search(catalogId, templateId, q, 10);
      setLoading(false);
      if (error) {
        setSearchError("Search unavailable. Please try again.");
        setResults([]);
      } else {
        setResults(data ?? []);
        setIsOpen(true);
      }
    },
    [catalogId, templateId],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    setActiveIndex(-1);

    if (value !== null) {
      onChange(null, null);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 2) {
      setIsOpen(false);
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doSearch(text);
    }, 300);
  };

  const handleSelect = (entry: EntryListItem) => {
    setInputText(entry.displayName);
    setIsOpen(false);
    setResults([]);
    onChange(entry.id, entry.displayName);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setInputText("");
    setIsOpen(false);
    setResults([]);
    onChange(null, null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={`Search ${templateName}...`}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 pl-9",
            value ? "pr-8" : "pr-3",
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
        {!loading && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchError && (
        <p className="mt-1 text-xs text-destructive">{searchError}</p>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No matching entries found.
            </div>
          ) : (
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((entry, idx) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(entry);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                      idx === activeIndex && "bg-accent text-accent-foreground",
                    )}
                  >
                    {entry.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
