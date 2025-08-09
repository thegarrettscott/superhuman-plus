import { useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useEmailSuggestions } from "@/hooks/useEmailSuggestions";

interface EmailAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EmailAutocomplete({ value, onChange, placeholder = "To", className }: EmailAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { suggestions, loading } = useEmailSuggestions(inputValue);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    setOpen(newValue.length >= 2 && suggestions.length > 0);
  };

  const handleSelect = (email: string) => {
    // Handle multiple emails separated by commas
    const emails = inputValue.split(',').map(e => e.trim());
    const lastEmail = emails[emails.length - 1];
    
    // Replace the last partial email with the selected one
    if (emails.length > 1) {
      emails[emails.length - 1] = email;
      const newValue = emails.join(', ');
      setInputValue(newValue);
      onChange(newValue);
    } else {
      setInputValue(email);
      onChange(email);
    }
    
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          onFocus={() => {
            if (inputValue.length >= 2 && suggestions.length > 0) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            // Delay closing to allow selection
            setTimeout(() => setOpen(false), 200);
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandList>
            {loading ? (
              <CommandEmpty>Searching...</CommandEmpty>
            ) : suggestions.length === 0 ? (
              <CommandEmpty>No suggestions found</CommandEmpty>
            ) : (
              suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.email}
                  value={suggestion.email}
                  onSelect={() => handleSelect(suggestion.email)}
                  className="cursor-pointer"
                >
                  <div className="flex justify-between items-center w-full">
                    <span>{suggestion.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {suggestion.count} sent
                    </span>
                  </div>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}