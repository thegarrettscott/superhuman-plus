import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface EmailSuggestion {
  email: string;
  name?: string;
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
        // Return recent contacts when no query
        return await getRecentContacts();
      }

      const contactMap = new Map<string, { name?: string; frequency: number }>();

      // First, try to get contacts from synced Gmail contacts
      const { data: gmailContacts } = await supabase
        .from('gmail_contacts')
        .select('display_name, email_addresses')
        .or(`display_name.ilike.%${debouncedQuery}%`)
        .limit(20);

      if (gmailContacts) {
        gmailContacts.forEach(contact => {
          const emails = Array.isArray(contact.email_addresses) ? contact.email_addresses : [];
          emails.forEach((emailObj: any) => {
            if (emailObj.value) {
              const email = emailObj.value.toLowerCase();
              const name = contact.display_name;
              if (matchesQuery(email, name, debouncedQuery)) {
                contactMap.set(email, {
                  name: name || undefined,
                  frequency: 10 // Higher weight for synced contacts
                });
              }
            }
          });
        });
      }

      // Also search email addresses that contain the query directly
      const { data: gmailContactsEmail } = await supabase
        .from('gmail_contacts')
        .select('display_name, email_addresses')
        .textSearch('email_addresses', debouncedQuery)
        .limit(10);

      if (gmailContactsEmail) {
        gmailContactsEmail.forEach(contact => {
          const emails = Array.isArray(contact.email_addresses) ? contact.email_addresses : [];
          emails.forEach((emailObj: any) => {
            if (emailObj.value && emailObj.value.toLowerCase().includes(debouncedQuery.toLowerCase())) {
              const email = emailObj.value.toLowerCase();
              const name = contact.display_name;
              if (!contactMap.has(email)) {
                contactMap.set(email, {
                  name: name || undefined,
                  frequency: 10
                });
              }
            }
          });
        });
      }

      // Supplement with email history data
      const [sentEmails, receivedEmails] = await Promise.all([
        supabase
          .from('outgoing_mail_logs')
          .select('to_addresses, cc_addresses, bcc_addresses')
          .limit(200),
        supabase
          .from('email_messages')
          .select('from_address, to_addresses, cc_addresses')
          .limit(200)
      ]);

      // Process sent emails
      if (sentEmails.data) {
        sentEmails.data.forEach(email => {
          [...(email.to_addresses || []), ...(email.cc_addresses || []), ...(email.bcc_addresses || [])].forEach(addr => {
            if (addr && typeof addr === 'string') {
              const { email: cleanEmail, name } = extractEmailAndName(addr);
              if (cleanEmail && matchesQuery(cleanEmail, name, debouncedQuery)) {
                const existing = contactMap.get(cleanEmail);
                if (!existing) {
                  contactMap.set(cleanEmail, {
                    name: name,
                    frequency: 1
                  });
                } else {
                  existing.frequency += 1;
                }
              }
            }
          });
        });
      }

      // Process received emails
      if (receivedEmails.data) {
        receivedEmails.data.forEach(email => {
          if (email.from_address) {
            const { email: cleanEmail, name } = extractEmailAndName(email.from_address);
            if (cleanEmail && matchesQuery(cleanEmail, name, debouncedQuery)) {
              const existing = contactMap.get(cleanEmail);
              if (!existing) {
                contactMap.set(cleanEmail, {
                  name: name,
                  frequency: 0.5
                });
              } else {
                existing.frequency += 0.5;
              }
            }
          }
        });
      }

      // Convert to array and sort by frequency
      const suggestions: EmailSuggestion[] = Array.from(contactMap.entries())
        .map(([email, data]) => ({ 
          email, 
          name: data.name, 
          frequency: data.frequency 
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      return suggestions;
    },
    enabled: true, // Always enabled now
    staleTime: 5 * 60 * 1000,
  });

  // Function to get recent contacts when no query
  async function getRecentContacts(): Promise<EmailSuggestion[]> {
    const { data: gmailContacts } = await supabase
      .from('gmail_contacts')
      .select('display_name, email_addresses')
      .limit(5)
      .order('updated_at', { ascending: false });

    const suggestions: EmailSuggestion[] = [];
    
    if (gmailContacts) {
      gmailContacts.forEach(contact => {
        const emails = Array.isArray(contact.email_addresses) ? contact.email_addresses : [];
        emails.forEach((emailObj: any) => {
          if (emailObj.value && suggestions.length < 5) {
            suggestions.push({
              email: emailObj.value,
              name: contact.display_name || undefined,
              frequency: 1
            });
          }
        });
      });
    }

    return suggestions;
  }

  return { suggestions, isLoading };
}

// Extract email and name from strings like "John Doe <john@example.com>" or "john@example.com"
function extractEmailAndName(input: string): { email: string | null; name?: string } {
  const emailWithNameRegex = /^(.+?)\s*<([^>]+)>$/;
  const match = input.match(emailWithNameRegex);
  
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
    const email = match[2].trim();
    return { email, name };
  }
  
  // If no angle brackets, assume the whole string is an email
  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (simpleEmailRegex.test(input.trim())) {
    return { email: input.trim() };
  }
  
  return { email: null };
}

// Check if email or name matches the search query
function matchesQuery(email: string, name: string | undefined, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Match email address
  if (email.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  // Match name if it exists
  if (name && name.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  
  return false;
}