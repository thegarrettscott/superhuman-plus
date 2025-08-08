import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmailContent } from "@/components/EmailContent";
import { ArrowLeft, Mail, Star, StarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Email = {
  id: string;
  gmailId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  body: string;
  bodyHtml?: string;
};

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = "Search - Freeform Email";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Search across all your connected email accounts.");
  }, []);

  useEffect(() => {
    const searchQuery = searchParams.get("q");
    if (searchQuery) {
      setQuery(searchQuery);
      performSearch(searchQuery);
    }
  }, [searchParams]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setEmails([]);
      return;
    }

    setIsLoading(true);
    try {
      const like = `%${searchQuery.trim()}%`;
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .or(`subject.ilike.${like},from_address.ilike.${like},snippet.ilike.${like},body_text.ilike.${like}`)
        .order('internal_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Search error:', error);
        toast({
          title: "Search failed",
          description: error.message
        });
        return;
      }

      const mapped: Email[] = (data || []).map((row: any) => ({
        id: row.id,
        gmailId: row.gmail_message_id,
        from: row.from_address || '',
        subject: row.subject || '(no subject)',
        snippet: row.snippet || '',
        date: row.internal_date ? new Date(row.internal_date).toLocaleString() : '',
        unread: !row.is_read,
        starred: Array.isArray(row.label_ids) && row.label_ids.includes('STARRED'),
        labels: Array.isArray(row.label_ids) ? row.label_ids.map((label: string) => label.toLowerCase()) : [],
        body: row.body_text || '',
        bodyHtml: row.body_html || undefined
      }));

      setEmails(mapped);
      if (mapped.length > 0) {
        setSelectedId(mapped[0].id);
      }
    } catch (err) {
      console.error('Search error:', err);
      toast({
        title: "Search failed",
        description: "An error occurred while searching"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  const toggleStar = async (email: Email) => {
    const { error } = await supabase.functions.invoke('gmail-actions', {
      body: {
        action: 'modify',
        id: email.gmailId,
        add: email.starred ? [] : ['STARRED'],
        remove: email.starred ? ['STARRED'] : []
      }
    });

    if (error) {
      toast({
        title: 'Failed to update',
        description: error.message
      });
    } else {
      setEmails(prev => prev.map(e => 
        e.id === email.id ? { ...e, starred: !e.starred } : e
      ));
    }
  };

  const markAsRead = async (email: Email) => {
    if (email.unread) {
      const { error } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'modify',
          id: email.gmailId,
          add: [],
          remove: ['UNREAD']
        }
      });

      if (!error) {
        setEmails(prev => prev.map(e => 
          e.id === email.id ? { ...e, unread: false } : e
        ));
      }
    }
  };

  const selected = emails.find(e => e.id === selectedId) ?? emails[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/mail')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Inbox
          </Button>
          
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <Input
              type="search"
              placeholder="Search across all your email accounts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full"
              autoFocus
            />
          </form>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Results List */}
        <div className="w-1/3 border-r bg-card/30">
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Search Results</h2>
              {!isLoading && emails.length > 0 && (
                <Badge variant="secondary">{emails.length} results</Badge>
              )}
            </div>
          </div>

          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Searching...
              </div>
            ) : emails.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {query ? "No results found" : "Enter a search term to get started"}
              </div>
            ) : (
              <div className="space-y-1">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedId === email.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      setSelectedId(email.id);
                      markAsRead(email);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${email.unread ? "font-semibold" : ""}`}>
                            {email.from}
                          </span>
                          {email.unread && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <div className={`text-sm ${email.unread ? "font-medium" : ""} truncate`}>
                          {email.subject}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {email.snippet}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {email.date}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(email);
                          }}
                        >
                          {email.starred ? (
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Email Content */}
        <div className="flex-1">
          {selected ? (
            <EmailContent email={selected} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select an email to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;