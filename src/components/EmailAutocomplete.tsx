import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useEmailSuggestions } from '@/hooks/useEmailSuggestions';
import { cn } from '@/lib/utils';

interface EmailAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EmailAutocomplete({ 
  value, 
  onChange, 
  placeholder = "To", 
  className 
}: EmailAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { suggestions } = useEmailSuggestions(value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(newValue.length > 0); // Always show dropdown when typing
    setHighlightedIndex(0);
  };

  const handleSuggestionClick = (email: string, name?: string) => {
    // Format as "Name <email>" if name exists, otherwise just email
    const formattedValue = name ? `${name} <${email}>` : email;
    onChange(formattedValue);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSuggestionClick(suggestions[highlightedIndex].email, suggestions[highlightedIndex].name);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleFocus = () => {
    if (value.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    // Delay closing to allow for clicks on suggestions
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.email}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                  index === highlightedIndex && "bg-accent"
                )}
                onClick={() => handleSuggestionClick(suggestion.email, suggestion.name)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start truncate flex-1">
                    {suggestion.name && (
                      <span className="font-medium truncate">{suggestion.name}</span>
                    )}
                    <span className={`truncate ${suggestion.name ? 'text-sm text-muted-foreground' : ''}`}>
                      {suggestion.email}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                    {Math.round(suggestion.frequency)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No suggestions found
            </div>
          )}
        </div>
      )}
    </div>
  );
}