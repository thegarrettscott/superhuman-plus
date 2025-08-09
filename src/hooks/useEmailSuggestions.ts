import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface EmailSuggestion {
  email: string;
  count: number;
}

export function useEmailSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<EmailSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim() || query.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        // Get user's sent emails
        const { data: logs, error } = await supabase
          .from('outgoing_mail_logs')
          .select('to_addresses')
          .eq('status', 'sent');

        if (error) {
          console.error('Error fetching email suggestions:', error);
          setSuggestions([]);
          return;
        }

        // Flatten all to_addresses and count frequency
        const emailCounts = new Map<string, number>();
        
        logs?.forEach(log => {
          if (log.to_addresses && Array.isArray(log.to_addresses)) {
            log.to_addresses.forEach((email: string) => {
              const cleanEmail = email.trim().toLowerCase();
              if (cleanEmail.includes(query.toLowerCase())) {
                emailCounts.set(cleanEmail, (emailCounts.get(cleanEmail) || 0) + 1);
              }
            });
          }
        });

        // Convert to array and sort by frequency
        const suggestions = Array.from(emailCounts.entries())
          .map(([email, count]) => ({ email, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Limit to top 10 suggestions

        setSuggestions(suggestions);
      } catch (error) {
        console.error('Error in fetchSuggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  return { suggestions, loading };
}