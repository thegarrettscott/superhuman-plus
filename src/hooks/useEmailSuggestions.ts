import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface EmailSuggestion {
  email: string;
  frequency: number;
}

export function useEmailSuggestions(searchQuery: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['emailSuggestions', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 1) {
        return [];
      }

      // Get email addresses from outgoing mail logs (sent emails)
      const { data: sentEmails } = await supabase
        .from('outgoing_mail_logs')
        .select('to_addresses, cc_addresses, bcc_addresses');

      // Get email addresses from incoming messages (received emails - from field)
      const { data: receivedEmails } = await supabase
        .from('email_messages')
        .select('from_address, to_addresses, cc_addresses');

      // Extract and count email frequencies
      const emailFrequency = new Map<string, number>();

      // Process sent emails
      if (sentEmails) {
        sentEmails.forEach(email => {
          [...(email.to_addresses || []), ...(email.cc_addresses || []), ...(email.bcc_addresses || [])].forEach(addr => {
            if (addr && typeof addr === 'string') {
              const cleanEmail = extractEmail(addr);
              if (cleanEmail && cleanEmail.toLowerCase().includes(debouncedQuery.toLowerCase())) {
                emailFrequency.set(cleanEmail, (emailFrequency.get(cleanEmail) || 0) + 1);
              }
            }
          });
        });
      }

      // Process received emails (from addresses - people who sent to us)
      if (receivedEmails) {
        receivedEmails.forEach(email => {
          if (email.from_address) {
            const cleanEmail = extractEmail(email.from_address);
            if (cleanEmail && cleanEmail.toLowerCase().includes(debouncedQuery.toLowerCase())) {
              emailFrequency.set(cleanEmail, (emailFrequency.get(cleanEmail) || 0) + 0.5); // Weight received emails less than sent
            }
          }
          // Also check to/cc fields for emails we were part of
          [...(email.to_addresses || []), ...(email.cc_addresses || [])].forEach(addr => {
            if (addr && typeof addr === 'string') {
              const cleanEmail = extractEmail(addr);
              if (cleanEmail && cleanEmail.toLowerCase().includes(debouncedQuery.toLowerCase())) {
                emailFrequency.set(cleanEmail, (emailFrequency.get(cleanEmail) || 0) + 0.3);
              }
            }
          });
        });
      }

      // Convert to array and sort by frequency
      const suggestions: EmailSuggestion[] = Array.from(emailFrequency.entries())
        .map(([email, frequency]) => ({ email, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10); // Limit to top 10 suggestions

      return suggestions;
    },
    enabled: debouncedQuery.length >= 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return { suggestions, isLoading };
}

// Extract email from strings like "John Doe <john@example.com>" or "john@example.com"
function extractEmail(input: string): string | null {
  const emailRegex = /<([^>]+)>$/;
  const match = input.match(emailRegex);
  
  if (match) {
    return match[1].trim();
  }
  
  // If no angle brackets, assume the whole string is an email
  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (simpleEmailRegex.test(input.trim())) {
    return input.trim();
  }
  
  return null;
}