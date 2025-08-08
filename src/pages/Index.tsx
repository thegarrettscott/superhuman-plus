import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Archive, Mail, Reply, Send, Star, StarOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
// Superhuman-style Gmail client (mocked). Connect Supabase later to enable Gmail OAuth + syncing.

type Email = {
  id: string; // local DB id (uuid)
  gmailId: string; // Gmail message id
  from: string;
  subject: string;
  snippet: string;
  date: string; // ISO or human
  unread: boolean;
  starred: boolean;
  labels: string[]; // e.g. ["inbox"], ["archived"], etc.
  body: string;
  bodyHtml?: string;
};

// Demo data removed; start with an empty inbox that populates from Supabase.


const isTypingInInput = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
};

const Index = () => {
  // SEO basics
  useEffect(() => {
    document.title = "Velocity Mail — Superhuman-style Gmail";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "A Superhuman-style Gmail client: keyboard-first, fast triage, elegant UI.");

    // Connection feedback
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      toast({ title: "Gmail connected", description: "Your Google account is linked." });
      params.delete("gmail");
      const url = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, "");
      window.history.replaceState({}, "", url);
    }
  }, []);

  const [mailbox, setMailbox] = useState<"inbox" | "archived" | "starred">("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const navigate = useNavigate();
  const [autoImported, setAutoImported] = useState(false);
  const [replyDraft, setReplyDraft] = useState<{ to?: string; subject?: string; body?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const PAGE_SIZE = 50;


  async function loadEmails(page = 1) {
    const offset = (page - 1) * PAGE_SIZE;
    
    // Get total count
    const { count } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });
    if (count !== null) setTotalEmails(count);
    
    const { data, error } = await supabase
      .from('email_messages')
      .select('*')
      .order('internal_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
      
    if (error) {
      console.error('loadEmails error', error);
      return;
    }
    
    const mapped: Email[] = ((data as any[]) || []).map((row: any) => ({
      id: row.id,
      gmailId: row.gmail_message_id,
      from: row.from_address || '',
      subject: row.subject || '(no subject)',
      snippet: row.snippet || '',
      date: row.internal_date ? new Date(row.internal_date).toLocaleString() : '',
      unread: !row.is_read,
      starred: Array.isArray(row.label_ids) && row.label_ids.includes('STARRED'),
      labels: ['inbox'],
      body: row.body_text || '',
      bodyHtml: row.body_html || undefined,
    }));
    
    // Always set emails and select first email for any page
    setEmails(mapped);
    if (mapped.length > 0) {
      setSelectedId(mapped[0].id);
    }
    
    // Load bodies proactively for all emails on current page
    mapped.forEach(async (email) => {
      if (!email.body) {
        const { data } = await supabase.functions.invoke('gmail-actions', {
          body: { action: 'get', id: email.gmailId },
        });
        if (data) {
          setEmails((prev) => prev.map((e) => (
            e.id === email.id ? { ...e, body: data.body_text || e.body, bodyHtml: data.body_html || e.bodyHtml } : e
          )));
        }
      }
    });
    
    // Auto-import only on first page if no emails exist
    if (mapped.length === 0 && !autoImported && page === 1) {
      setAutoImported(true);
      const { data: accRows, error: accErr } = await supabase
        .from('email_accounts')
        .select('id')
        .limit(1);
      if (accErr) {
        console.warn('email_accounts check error', accErr);
        return;
      }
      if (accRows && accRows.length > 0) {
        toast({ title: 'Importing…', description: 'Fetching your latest emails.' });
        const { data: impData, error: impError } = await supabase.functions.invoke('gmail-actions', { body: { action: 'import', max: 100 } });
        if (impError) {
          toast({ title: 'Import failed', description: impError.message });
        } else {
          toast({ title: 'Imported', description: `${impData?.imported ?? 0} messages imported.` });
          await loadEmails(1);
        }
      }
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/auth');
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/auth');
      else loadEmails(1);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const base = emails.filter((e) => {
      if (mailbox === "inbox") return e.labels.includes("inbox");
      if (mailbox === "archived") return e.labels.includes("archived");
      if (mailbox === "starred") return e.starred;
      return true;
    });
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        e.snippet.toLowerCase().includes(q)
    );
  }, [emails, mailbox, query]);

  const selected = useMemo(() => filtered.find((e) => e.id === selectedId) ?? filtered[0], [filtered, selectedId]);

  useEffect(() => {
    if (selected && !filtered.some((e) => e.id === selected.id)) {
      setSelectedId(filtered[0]?.id);
    }
    if (selected && !selected.body) {
      (async () => {
        const { data, error } = await supabase.functions.invoke('gmail-actions', {
          body: { action: 'get', id: selected.gmailId },
        });
        if (!error && data) {
          setEmails((prev) => prev.map((e) => (
            e.id === selected.id ? { ...e, body: data.body_text || e.body, bodyHtml: data.body_html || e.bodyHtml } : e
          )));
        }
      })();
    }
  }, [filtered, selected, selectedId]);

  // Signature moment: subtle pointer-reactive light field in header
  const glowRef = useRef<HTMLDivElement>(null);
  const onPointerMove = (e: React.MouseEvent) => {
    if (!glowRef.current) return;
    const rect = glowRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glowRef.current.style.setProperty("--x", `${x}px`);
    glowRef.current.style.setProperty("--y", `${y}px`);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }
      if (isTypingInInput(e.target)) return;
      const idx = filtered.findIndex((m) => m.id === selectedId);
      switch (e.key.toLowerCase()) {
        case "c":
          setComposeOpen(true);
          break;
        case "j": {
          const next = filtered[Math.min(idx + 1, filtered.length - 1)];
          if (next) setSelectedId(next.id);
          break;
        }
        case "k": {
          const prev = filtered[Math.max(idx - 1, 0)];
          if (prev) setSelectedId(prev.id);
          break;
        }
        case "e": {
          e.preventDefault();
          archiveSelected();
          break;
        }
        case "r": {
          e.preventDefault();
          toast({ title: "Reply", description: "Reply opened (mock)", });
          break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedId]);

  const archiveSelected = () => {
    if (!selected) return;
    setEmails((prev) =>
      prev.map((e) =>
        e.id === selected.id
          ? { ...e, labels: ["archived"], unread: false }
          : e
      )
    );
    setMailbox("inbox");
    toast({ title: "Archived", description: "Conversation moved to Archive." });
  };

  const toggleReadFor = async (email: Email) => {
    const willBeUnread = !email.unread ? true : false; // toggle
    // Modify Gmail labels: add/remove UNREAD
    const add = willBeUnread ? ['UNREAD'] : [];
    const remove = willBeUnread ? [] : ['UNREAD'];
    const { error } = await supabase.functions.invoke('gmail-actions', {
      body: { action: 'modify', id: email.gmailId, add, remove },
    });
    if (error) {
      toast({ title: 'Failed', description: error.message });
      return;
    }
    setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, unread: willBeUnread } : e)));
  };

  const toggleStar = async (email: Email) => {
    const willBeStarred = !email.starred;
    const add = willBeStarred ? ['STARRED'] : [];
    const remove = willBeStarred ? [] : ['STARRED'];
    const { error } = await supabase.functions.invoke('gmail-actions', {
      body: { action: 'modify', id: email.gmailId, add, remove },
    });
    if (error) {
      toast({ title: 'Failed', description: error.message });
      return;
    }
    setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, starred: willBeStarred } : e)));
  };

  const handleImport = async (max = 100) => {
    toast({ title: 'Importing…', description: `Fetching latest ${max} emails.` });
    const { data, error } = await supabase.functions.invoke("gmail-actions", { body: { action: "import", max } });
    if (error) {
      toast({ title: "Import failed", description: error.message });
      return;
    }
    toast({ title: "Imported", description: `${data?.imported ?? 0} messages imported.` });
    await loadEmails(1);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header onMouseMove={onPointerMove} className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div ref={glowRef} className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(600px circle at var(--x) var(--y), hsl(var(--primary)/0.12), transparent 60%)",
            }}
          />
          <div className="container flex items-center gap-3 py-3">
            <Mail className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight">Velocity Mail — Superhuman-style Gmail client</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:block w-72">
                <Input
                  aria-label="Search mail"
                  placeholder="Search (Cmd/Ctrl+K)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                  toast({ title: "Login required", description: "Please log in to connect Gmail." });
                  return;
                }
                const { data, error } = await supabase.functions.invoke("gmail-oauth", {
                  body: { redirect_url: window.location.origin },
                });
                if (error || !data?.authUrl) {
                  toast({ title: "Error", description: error?.message || "Could not start Google OAuth." });
                  return;
                }
                window.location.href = data.authUrl;
              }}>Connect Gmail</Button>
              <Button onClick={() => setComposeOpen(true)}>Compose</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 py-4">
        {/* Sidebar */}
        <aside className="rounded-lg border bg-card">
          <nav className="p-2">
            <SidebarItem
              label="Inbox"
              active={mailbox === "inbox"}
              count={emails.filter((e) => e.labels.includes("inbox") && e.unread).length}
              onClick={() => setMailbox("inbox")}
            />
            <SidebarItem
              label="Starred"
              active={mailbox === "starred"}
              count={emails.filter((e) => e.starred && e.labels.includes("inbox")).length}
              onClick={() => setMailbox("starred")}
            />
            <SidebarItem
              label="Archived"
              active={mailbox === "archived"}
              count={emails.filter((e) => e.labels.includes("archived")).length}
              onClick={() => setMailbox("archived")}
            />
          </nav>
          <div className="px-3 pb-3">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Shortcuts: C compose, E archive, J/K navigate, Cmd/Ctrl+K commands.
            </div>
          </div>
        </aside>

        {/* List */}
        <section className="rounded-lg border bg-card overflow-hidden">
          <ScrollArea className="h-[calc(100vh-9.5rem)]">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No messages yet. Click "Connect Gmail" to load your inbox.
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((m) => (
                  <div key={m.id}>
                    <button
                      className={`w-full text-left px-3 py-1.5 focus:outline-none transition-colors ${
                        selected?.id === m.id ? "bg-accent" : "hover:bg-accent"
                      }`}
                      onClick={() => setSelectedId(m.id)}
                      aria-current={selected?.id === m.id}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          className="shrink-0 text-xs p-1"
                          aria-label={m.starred ? "Unstar" : "Star"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(m);
                          }}
                        >
                          {m.starred ? (
                            <Star className="h-3 w-3 text-primary fill-primary" />
                          ) : (
                            <StarOff className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex min-w-0 flex-col flex-1 gap-0.5">
                          <div className="flex items-center gap-2">
                            <p className={`truncate text-sm leading-tight ${m.unread ? "font-semibold" : ""}`}>{m.subject}</p>
                            {m.unread && <div className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                          </div>
                          <p className="truncate text-xs leading-tight text-muted-foreground">{m.from} — {m.snippet}</p>
                        </div>
                        <span className="ml-auto shrink-0 w-20 text-right tabular-nums text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {totalEmails > PAGE_SIZE && (
            <div className="border-t p-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => {
                        if (currentPage > 1) {
                          const newPage = currentPage - 1;
                          setCurrentPage(newPage);
                          loadEmails(newPage);
                        }
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, Math.ceil(totalEmails / PAGE_SIZE)) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => {
                            setCurrentPage(page);
                            loadEmails(page);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {Math.ceil(totalEmails / PAGE_SIZE) > 5 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => {
                        if (currentPage < Math.ceil(totalEmails / PAGE_SIZE)) {
                          const newPage = currentPage + 1;
                          setCurrentPage(newPage);
                          loadEmails(newPage);
                        }
                      }}
                      className={currentPage >= Math.ceil(totalEmails / PAGE_SIZE) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </section>

        {/* Detail */}
        <article className="rounded-lg border bg-card overflow-hidden">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b p-4">
                <h2 className="text-base font-semibold leading-none tracking-tight">{selected.subject}</h2>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" onClick={async () => {
                    if (selected) await toggleReadFor(selected);
                  }}>
                    {selected?.unread ? 'Mark as read' : 'Mark as unread'}
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    if (!selected) return;
                    setReplyDraft({
                      to: selected.from,
                      subject: selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`,
                      body: `\n\nOn ${selected.date}, ${selected.from} wrote:\n> ${selected.body}`,
                    });
                    setComposeOpen(true);
                  }}>
                    <Reply className="mr-2 h-4 w-4" /> Reply
                  </Button>
                  <Button variant="secondary" onClick={archiveSelected}>
                    <Archive className="mr-2 h-4 w-4" /> Archive (E)
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 p-4">
                  <div className="text-sm text-muted-foreground">From: {selected.from}</div>
                  {selected.bodyHtml ? (
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selected.bodyHtml }} />
                  ) : (
                    <p className="leading-7 whitespace-pre-wrap">{selected.body}</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-muted-foreground">
              Select a conversation to view
            </div>
          )}
        </article>
      </main>

      {/* Compose */}
      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} initialTo={replyDraft?.to} initialSubject={replyDraft?.subject} initialBody={replyDraft?.body} />

      {/* Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => setMailbox("inbox")}>
              Inbox
              <CommandShortcut>I</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => setMailbox("starred")}>
              Starred
            </CommandItem>
            <CommandItem onSelect={() => setMailbox("archived")}>
              Archived
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => setComposeOpen(true)}>
              New email
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};

function SidebarItem({ label, count, active, onClick }: { label: string; count?: number; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-accent" : "hover:bg-accent"
      }`}
    >
      <span className="font-medium">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{count}</span>
      )}
    </button>
  );
}

function ComposeDialog({ open, onOpenChange, initialTo, initialSubject, initialBody }: { open: boolean; onOpenChange: (v: boolean) => void; initialTo?: string; initialSubject?: string; initialBody?: string }) {
  const toRef = useRef<HTMLInputElement>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setTimeout(() => toRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTo(initialTo || "");
      setSubject(initialSubject || "");
      setBody(initialBody || "");
    }
  }, [open, initialTo, initialSubject, initialBody]);

  const handleSend = async () => {
    const toList = to.split(',').map((s) => s.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast({ title: 'Add recipient', description: 'Please add at least one email address.' });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('gmail-actions', {
      body: { action: 'send', to: toList, subject, text: body },
    });
    setSending(false);
    if (error) {
      toast({ title: 'Send failed', description: error.message });
      return;
    }
    toast({ title: 'Sent', description: 'Message delivered.' });
    onOpenChange(false);
    setTo("");
    setSubject("");
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <span className="sr-only">Compose</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input ref={toRef} placeholder="To" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input placeholder="Subject" aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div>
            <textarea
              aria-label="Message body"
              className="min-h-[160px] w-full rounded-md border bg-background p-3 outline-none"
              placeholder="Say hello…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="mr-2 h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
            <X className="mr-2 h-4 w-4" /> Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
