import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string; // ISO or human
  unread: boolean;
  starred: boolean;
  labels: string[]; // e.g. ["inbox"], ["archived"], etc.
  body: string;
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


  async function loadEmails() {
    const { data, error } = await supabase
      .from('email_messages')
      .select('*')
      .order('internal_date', { ascending: false })
      .limit(100);
    if (error) {
      console.error('loadEmails error', error);
      return;
    }
    const mapped: Email[] = ((data as any[]) || []).map((row: any) => ({
      id: row.id,
      from: row.from_address || '',
      subject: row.subject || '(no subject)',
      snippet: row.snippet || '',
      date: row.internal_date ? new Date(row.internal_date).toLocaleString() : '',
      unread: !row.is_read,
      starred: false,
      labels: ['inbox'],
      body: row.body_text || '',
    }));
    if (mapped.length) {
      setEmails(mapped);
      setSelectedId(mapped[0].id);
    } else if (!autoImported) {
      setAutoImported(true);
      // If a Gmail account is connected, auto-import up to 100 messages
      const { data: accRows, error: accErr } = await supabase
        .from('email_accounts')
        .select('id')
        .limit(1);
      if (accErr) {
        console.warn('email_accounts check error', accErr);
        return;
      }
      if (accRows && accRows.length > 0) {
        toast({ title: 'Importing…', description: 'Fetching your latest 100 emails.' });
        const { data: impData, error: impError } = await supabase.functions.invoke('gmail-actions', { body: { action: 'import', max: 100 } });
        if (impError) {
          toast({ title: 'Import failed', description: impError.message });
        } else {
          toast({ title: 'Imported', description: `${impData?.imported ?? 0} messages imported.` });
          await loadEmails();
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
      else loadEmails();
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
  }, [filtered, selected]);

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

  const toggleStar = (id: string) =>
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)));

  const handleImport = async (max = 100) => {
    toast({ title: 'Importing…', description: `Fetching latest ${max} emails.` });
    const { data, error } = await supabase.functions.invoke("gmail-actions", { body: { action: "import", max } });
    if (error) {
      toast({ title: "Import failed", description: error.message });
      return;
    }
    toast({ title: "Imported", description: `${data?.imported ?? 0} messages imported.` });
    await loadEmails();
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
              <Button variant="outline" onClick={() => handleImport(100)}>Import Emails</Button>
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
              <ul className="divide-y">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      className={`w-full text-left px-4 py-3 focus:outline-none transition-colors ${
                        selected?.id === m.id ? "bg-accent" : "hover:bg-accent"
                      }`}
                      onClick={() => setSelectedId(m.id)}
                      aria-current={selected?.id === m.id}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          className="shrink-0 rounded-md border px-2 py-1 text-xs"
                          aria-label={m.starred ? "Unstar" : "Star"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(m.id);
                          }}
                        >
                          {m.starred ? (
                            <span className="inline-flex items-center gap-1 text-primary"><Star className="h-3.5 w-3.5" /> Starred</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground"><StarOff className="h-3.5 w-3.5" /> Star</span>
                          )}
                        </button>
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-2">
                            <p className={`truncate ${m.unread ? "font-semibold" : ""}`}>{m.subject}</p>
                            {m.unread && <Badge>New</Badge>}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{m.from} — {m.snippet}</p>
                        </div>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{m.date}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </section>

        {/* Detail */}
        <article className="rounded-lg border bg-card overflow-hidden">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b p-4">
                <h2 className="text-base font-semibold leading-none tracking-tight">{selected.subject}</h2>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" onClick={() => toast({ title: "Reply", description: "Reply opened (mock)", })}>
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
                  <p className="leading-7">{selected.body}</p>
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
      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />

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

function ComposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const toRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => toRef.current?.focus(), 50);
  }, [open]);

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
          <Input ref={toRef} placeholder="To" aria-label="To" />
          <Input placeholder="Subject" aria-label="Subject" />
          <div>
            <textarea
              aria-label="Message body"
              className="min-h-[160px] w-full rounded-md border bg-background p-3 outline-none"
              placeholder="Say hello…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { onOpenChange(false); toast({ title: "Sent", description: "Message sent (mock)", }); }}>
            <Send className="mr-2 h-4 w-4" /> Send
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
