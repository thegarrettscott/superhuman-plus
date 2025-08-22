import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { EmailContent } from "@/components/EmailContent";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Archive, Mail, Reply, Send, Star, StarOff, X, Filter, Plus } from "lucide-react";
import { CreateFilterDialog } from "@/components/CreateFilterDialog";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { EmailAutocomplete } from "@/components/EmailAutocomplete";
import { ComposeDialog } from "@/components/ComposeDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import { useState as useLocalState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import SyncProgress from "@/components/SyncProgress";
import BackgroundSyncMonitor from "@/components/BackgroundSyncMonitor";
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
  filterResults?: { filterId: string; filterName: string; tags: string[] }[];
  tags?: string[];
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
      toast({
        title: "Gmail connected",
        description: "Your Google account is linked."
      });
      params.delete("gmail");
      const url = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, "");
      window.history.replaceState({}, "", url);
    }
  }, []);
  const [mailbox, setMailbox] = useState<"inbox" | "archived" | "starred" | "sent" | "drafts" | string>("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  
  const [cmdOpen, setCmdOpen] = useState(false);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useLocalState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [autoImported, setAutoImported] = useState(false);
  const [initialImportCompleted, setInitialImportCompleted] = useState(false);
  const [showSyncUIOnLoad, setShowSyncUIOnLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isImportingSent, setIsImportingSent] = useState(false);
  const [replyDraft, setReplyDraft] = useState<{
    to?: string;
    subject?: string;
    body?: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalUnreads, setTotalUnreads] = useState(0);
  const [filters, setFilters] = useState<any[]>([]);
  const [filterCategories, setFilterCategories] = useState<{[key: string]: number}>({});
  const [showCreateFilter, setShowCreateFilter] = useState(false);
  const [createFilterEmail, setCreateFilterEmail] = useState<Email | null>(null);
  const [footerReplyOpen, setFooterReplyOpen] = useState(false);
  const [footerTo, setFooterTo] = useState("");
  const [footerSubject, setFooterSubject] = useState("");
  const [footerBody, setFooterBody] = useState("");
  const [showCreateInbox, setShowCreateInbox] = useState(false);
  const [newInboxName, setNewInboxName] = useState('');
  const [showSignatureSettings, setShowSignatureSettings] = useState(false);
  const [signature, setSignature] = useState('');
  const [newSignature, setNewSignature] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [processingFilters, setProcessingFilters] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingSummary, setProcessingSummary] = useState<string | null>(null);
  const PAGE_SIZE = 50;
  async function loadCategoriesAndUnreads() {
    // Load all unique categories/labels from user's emails
    const {
      data: labelData
    } = await supabase.from('email_messages').select('label_ids').not('label_ids', 'is', null);
    const categories: string[] = [];
    if (labelData) {
      const allLabels = new Set<string>();
      labelData.forEach((row: any) => {
        if (Array.isArray(row.label_ids)) {
          row.label_ids.forEach((label: string) => {
            // Include custom categories but exclude system labels
            if (!['INBOX', 'STARRED', 'SENT', 'TRASH', 'SPAM', 'DRAFT', 'UNREAD', 'IMPORTANT'].includes(label)) {
              allLabels.add(label);
            }
          });
        }
      });
      categories.push(...Array.from(allLabels).sort());
    }

    // Load total unread count across all emails
    const {
      count
    } = await supabase.from('email_messages').select('*', {
      count: 'exact',
      head: true
    }).eq('is_read', false).not('label_ids', 'cs', ['TRASH']);
    const totalUnreads = count || 0;

    // Load active filters and calculate filter-based categories
    const { data: filtersData } = await supabase
      .from('email_filters')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
    const filterCategories: {[key: string]: number} = {};
    if (filtersData) {
      // Calculate email counts for each filter
      for (const filter of filtersData) {
        const actions = filter.actions as any;
        const tags: string[] = actions?.add_tags || [];
        if (!tags.length) {
          filterCategories[filter.name] = 0;
          continue;
        }
        const { data: tagIdRows } = await supabase
          .from('email_tags')
          .select('id')
          .in('name', tags);
        const tagIds = (tagIdRows || []).map((t: any) => t.id);
        if (!tagIds.length) {
          filterCategories[filter.name] = 0;
          continue;
        }
        const { count } = await supabase
          .from('email_message_tags')
          .select('message_id', { count: 'exact', head: true })
          .in('tag_id', tagIds);
        filterCategories[filter.name] = count || 0;
      }
    }

    return {
      categories,
      totalUnreads,
      filters: filtersData || [],
      filterCategories
    };
  }
  // Cache email lists using React Query
  const {
    data: emailData,
    isLoading: emailsLoading,
    refetch: refetchEmails
  } = useQuery({
    queryKey: ['emails', mailbox, query, currentPage],
    queryFn: () => loadEmailsWithCache(currentPage, mailbox),
    staleTime: 30000,
    // Cache for 30 seconds
    gcTime: 300000,
    // Keep in cache for 5 minutes
    refetchOnWindowFocus: false // Prevent refetch on window focus
  });

  // Cache categories and unreads
  const {
    data: categoriesData,
    refetch: refetchCategories
  } = useQuery({
    queryKey: ['categories'],
    queryFn: loadCategoriesAndUnreads,
    staleTime: 60000 // Cache for 1 minute
  });
  async function loadEmailsWithCache(page = 1, targetMailbox = mailbox): Promise<{
    emails: Email[];
    total: number;
  }> {
    const offset = (page - 1) * PAGE_SIZE;

    // Build base filter by mailbox and search
    let countQuery = supabase.from('email_messages').select('*', {
      count: 'exact',
      head: true
    });
    let dataQuery = supabase.from('email_messages').select('*').order('internal_date', {
      ascending: false
    });

    // Mailbox filters
    if (targetMailbox === 'inbox') {
      countQuery = countQuery.contains('label_ids', ['INBOX']);
      dataQuery = dataQuery.contains('label_ids', ['INBOX']);
    } else if (targetMailbox === 'starred') {
      countQuery = countQuery.contains('label_ids', ['STARRED']);
      dataQuery = dataQuery.contains('label_ids', ['STARRED']);
    } else if (targetMailbox === 'sent') {
      // Check if we have any sent emails first, if not trigger background import
      const {
        count: sentCount
      } = await supabase.from('email_messages').select('*', {
        count: 'exact',
        head: true
      }).contains('label_ids', ['SENT']);

      if (sentCount === 0) {
        // Sent emails will be imported by BackgroundSyncMonitor
        console.log('No sent emails found - will be imported in background');
      }

      countQuery = countQuery.contains('label_ids', ['SENT']);
      dataQuery = dataQuery.contains('label_ids', ['SENT']);
    } else if (targetMailbox === 'drafts') {
      // Check if we have any drafts first, if not trigger background import
      const {
        count: draftCount
      } = await supabase.from('email_messages').select('*', {
        count: 'exact',
        head: true
      }).contains('label_ids', ['DRAFT']);

      if (draftCount === 0) {
        // Drafts will be imported by BackgroundSyncMonitor
        console.log('No drafts found - will be imported in background');
      }

      countQuery = countQuery.contains('label_ids', ['DRAFT']);
      dataQuery = dataQuery.contains('label_ids', ['DRAFT']);
    } else if (targetMailbox === 'archived') {
      countQuery = countQuery.not('label_ids', 'cs', ['INBOX']).not('label_ids', 'cs', ['TRASH']);
      dataQuery = dataQuery.not('label_ids', 'cs', ['INBOX']).not('label_ids', 'cs', ['TRASH']);
    } else if (targetMailbox !== 'inbox' && targetMailbox !== 'starred' && targetMailbox !== 'sent' && targetMailbox !== 'archived' && targetMailbox !== 'drafts') {
      // Custom category/label
      countQuery = countQuery.contains('label_ids', [targetMailbox]);
      dataQuery = dataQuery.contains('label_ids', [targetMailbox]);
    }

    // Search filter - using improved search index
    const q = query.trim();
    if (q) {
      const like = `%${q}%`;
      countQuery = countQuery.or(`subject.ilike.${like},from_address.ilike.${like},snippet.ilike.${like},body_text.ilike.${like}`);
      dataQuery = dataQuery.or(`subject.ilike.${like},from_address.ilike.${like},snippet.ilike.${like},body_text.ilike.${like}`);
    }

    const {
      count
    } = await countQuery;
    const total = count || 0;
    const {
      data,
      error
    } = await dataQuery.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('loadEmails error', error);
      throw error;
    }
    const mapped: Email[] = (data as any[] || []).map((row: any) => ({
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

    // Load filter results and tags for each email (async for speed)
    await Promise.all(mapped.map(async (email) => {
      // Get tags for this email
      const { data: messageTagRows, error: mtErr } = await supabase
        .from('email_message_tags')
        .select('tag_id')
        .eq('message_id', email.id);

      let tagNames: string[] = [];
      if (!mtErr && messageTagRows && messageTagRows.length > 0) {
        const tagIds = messageTagRows.map((r: any) => r.tag_id);
        const { data: tagRows } = await supabase
          .from('email_tags')
          .select('id, name')
          .in('id', tagIds);
        tagNames = tagRows?.map((t: any) => t.name) || [];
      }
      email.tags = tagNames;

      // Filter results shown on list chips
      email.filterResults = filters
        .filter(f => {
          const actions = f.actions as any;
          const addTags: string[] = actions?.add_tags || [];
          return f.is_active && addTags.some((tag: string) => email.tags?.includes(tag));
        })
        .map(f => ({
          filterId: f.id,
          filterName: f.name,
          tags: (f.actions as any)?.add_tags || []
        }));
    }));

    return {
      emails: mapped,
      total
    };
  }
  // Update emails when emailData changes
  useEffect(() => {
    if (emailData) {
      setEmails(emailData.emails);
      setTotalEmails(emailData.total);
      
      // Preserve current selection if the email still exists in the new list
      if (selectedId && emailData.emails.some(email => email.id === selectedId)) {
        // Current selection is still valid, keep it
        return;
      }
      
      // Only auto-select first email on initial load when no email is selected
      if (emailData.emails.length > 0 && !selectedId) {
        setSelectedId(emailData.emails[0].id);
      }
    }
  }, [emailData, selectedId]);

  // Update categories when data changes
  useEffect(() => {
    if (categoriesData) {
      setCategories(categoriesData.categories);
      setTotalUnreads(categoriesData.totalUnreads);
      setFilters(categoriesData.filters);
      setFilterCategories(categoriesData.filterCategories);
    }
  }, [categoriesData]);
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setCurrentUser(session.user.id);
        // Fetch user's email account ID and import status
        supabase.from('email_accounts')
          .select('id, initial_import_completed')
          .eq('user_id', session.user.id)
          .limit(1)
          .single()
          .then(({ data }) => {
            if (data) {
              setCurrentAccount(data.id);
              setInitialImportCompleted(data.initial_import_completed);
            }
          });
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setCurrentUser(session.user.id);
        // Fetch user's email account ID and import status
        supabase.from('email_accounts')
          .select('id, initial_import_completed')
          .eq('user_id', session.user.id)
          .limit(1)
          .single()
          .then(({ data }) => {
            if (data) {
              setCurrentAccount(data.id);
              setInitialImportCompleted(data.initial_import_completed);
            }
          });
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh emails every ~2 minutes when tab is visible and focused
  useEffect(() => {
    console.log('Setting up auto-refresh interval');
    const REFRESH_MS = 2 * 60 * 1000;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      if (cancelled) return;
      console.log('Auto-refreshing emails...');
      try {
        // Only refresh data, don't trigger new imports
        // BackgroundSyncMonitor handles all import operations
        // Use refetchOnWindowFocus: false and only invalidate in background
        queryClient.invalidateQueries({
          queryKey: ['emails'],
          refetchType: 'none' // Don't immediately refetch, just mark as stale
        });
        queryClient.invalidateQueries({
          queryKey: ['categories'],
          refetchType: 'none'
        });
      } catch (e) {
        console.warn('Auto-import failed:', e);
      }
    };
    const interval = window.setInterval(() => {
      if (!isTypingInInput(document.activeElement)) {
        void tick();
      }
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    const onFocus = () => void tick();
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    // Trigger immediately on mount as well
    void tick();

    return () => {
      console.log('Cleaning up auto-refresh interval');
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [queryClient, initialImportCompleted, autoImported]);
  const filtered = useMemo(() => {
    // Get user's email for sent filtering
    const getUserEmail = async () => {
      const {
        data: accountData
      } = await supabase.from('email_accounts').select('email_address').limit(1);
      return accountData?.[0]?.email_address;
    };

    // Filter based on current mailbox
    const base = emails.filter(e => {
      if (mailbox === "inbox") return e.labels.includes("inbox");
      if (mailbox === "sent") {
        // Check if email has SENT label or is from user's address
        return e.labels.includes("sent") || e.from.includes("@pipedreamlabs.co"); // Temporary hardcode, should use dynamic user email
      }
      if (mailbox === "drafts") return e.labels.includes("draft");
      if (mailbox === "starred") return e.starred;
      if (mailbox === "archived") return !e.labels.includes("inbox") && !e.labels.includes("trash");
      if (mailbox !== "inbox" && mailbox !== "sent" && mailbox !== "starred" && mailbox !== "archived" && mailbox !== "drafts") {
        // Custom category
        return e.labels.includes(mailbox.toLowerCase());
      }
      return true;
    });
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(e => e.subject.toLowerCase().includes(q) || e.from.toLowerCase().includes(q) || e.snippet.toLowerCase().includes(q));
  }, [emails, mailbox, query]);
  const selected = useMemo(() => filtered.find(e => e.id === selectedId) ?? filtered[0], [filtered, selectedId]);
  
  // Mobile navigation functions
  const handleEmailSelect = (emailId: string) => {
    setSelectedId(emailId);
    if (isMobile) {
      setMobileView('detail');
    }
  };

  const handleMobileBack = () => {
    if (isMobile) {
      setMobileView('list');
      setSelectedId(undefined);
    }
  };

  // Swipe gesture support for mobile
  const swipeHandlers = useSwipeGestures({
    onSwipeRight: () => {
      if (isMobile && mobileView === 'detail') {
        handleMobileBack();
      }
    },
    onSwipeLeft: () => {
      if (isMobile && mobileView === 'list' && selected) {
        handleEmailSelect(selected.id);
      }
    }
  });

  useEffect(() => {
    if (selected && !filtered.some(e => e.id === selected.id)) {
      setSelectedId(filtered[0]?.id);
    }
    if (selected && !selected.body) {
      (async () => {
        const {
          data,
          error
        } = await supabase.functions.invoke('gmail-actions', {
          body: {
            action: 'get',
            id: selected.gmailId
          }
        });
        if (!error && data) {
          setEmails(prev => prev.map(e => e.id === selected.id ? {
            ...e,
            body: data.body_text || e.body,
            bodyHtml: data.body_html || e.bodyHtml
          } : e));
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
      const idx = filtered.findIndex(m => m.id === selectedId);
      switch (e.key.toLowerCase()) {
        case "c":
          setFooterReplyOpen(true);
          break;
        case "j":
          {
            const next = filtered[Math.min(idx + 1, filtered.length - 1)];
            if (next) setSelectedId(next.id);
            break;
          }
        case "k":
          {
            const prev = filtered[Math.max(idx - 1, 0)];
            if (prev) setSelectedId(prev.id);
            break;
          }
        case "e":
          {
            e.preventDefault();
            archiveSelected();
            break;
          }
        case "backspace":
        case "delete":
          {
            e.preventDefault();
            deleteSelected();
            break;
          }
        case "r":
          {
            e.preventDefault();
            const current = selected;
            if (current) openReplyFooter(current);
            break;
          }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedId]);
  const refillAfterChange = async () => {
    // Invalidate and refetch current data
    await refetchEmails();
    if (emailData && emailData.emails.length === 0 && currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
    }
  };
  // Optimistic archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (email: Email) => {
      const {
        error
      } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'modify',
          id: email.gmailId,
          add: [],
          remove: ['INBOX']
        }
      });
      if (error) throw error;
      return email;
    },
    onMutate: async email => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['emails']
      });

      // Snapshot previous value
      const previousEmails = queryClient.getQueryData(['emails', mailbox, query, currentPage]);

      // Optimistically update to remove email
      queryClient.setQueryData(['emails', mailbox, query, currentPage], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          emails: old.emails.filter((e: Email) => e.id !== email.id),
          total: old.total - 1
        };
      });

      // Update local state immediately
      setEmails(prev => prev.filter(e => e.id !== email.id));
      setSelectedId(prev => prev === email.id ? undefined : prev);
      return {
        previousEmails
      };
    },
    onError: (err, email, context) => {
      // Rollback on error
      if (context?.previousEmails) {
        queryClient.setQueryData(['emails', mailbox, query, currentPage], context.previousEmails);
      }
      // Restore local state
      refetchEmails();
      toast({
        title: 'Failed to archive',
        description: 'Could not archive email. Please try again.'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Archived',
        description: 'Email moved to Archive.'
      });
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ['emails']
      });
      queryClient.invalidateQueries({
        queryKey: ['categories']
      });
    }
  });
  const archiveSelected = () => {
    if (!selected) return;
    archiveMutation.mutate(selected);
  };
  // Optimistic delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (email: Email) => {
      const {
        error
      } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'modify',
          id: email.gmailId,
          add: ['TRASH'],
          remove: []
        }
      });
      if (error) throw error;
      return email;
    },
    onMutate: async email => {
      await queryClient.cancelQueries({
        queryKey: ['emails']
      });
      const previousEmails = queryClient.getQueryData(['emails', mailbox, query, currentPage]);
      queryClient.setQueryData(['emails', mailbox, query, currentPage], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          emails: old.emails.filter((e: Email) => e.id !== email.id),
          total: old.total - 1
        };
      });
      setEmails(prev => prev.filter(e => e.id !== email.id));
      setSelectedId(prev => prev === email.id ? undefined : prev);
      return {
        previousEmails
      };
    },
    onError: (err, email, context) => {
      if (context?.previousEmails) {
        queryClient.setQueryData(['emails', mailbox, query, currentPage], context.previousEmails);
      }
      refetchEmails();
      toast({
        title: 'Failed to delete',
        description: 'Could not delete email. Please try again.'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Deleted',
        description: 'Email moved to Trash.'
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['emails']
      });
      queryClient.invalidateQueries({
        queryKey: ['categories']
      });
    }
  });
  const deleteSelected = () => {
    if (!selected) return;
    deleteMutation.mutate(selected);
  };
  const toggleReadFor = async (email: Email) => {
    const willBeUnread = !email.unread ? true : false; // toggle
    
    // Update local state immediately for responsiveness
    setEmails(prev => prev.map(e => e.id === email.id ? {
      ...e,
      unread: willBeUnread
    } : e));

    // Update database first
    const { error: dbError } = await supabase
      .from('email_messages')
      .update({ is_read: !willBeUnread })
      .eq('id', email.id);

    if (dbError) {
      console.error('Failed to update read status in database:', dbError);
      // Revert local state on error
      setEmails(prev => prev.map(e => e.id === email.id ? {
        ...e,
        unread: email.unread
      } : e));
      toast({
        title: 'Failed',
        description: 'Could not update email status'
      });
      return;
    }

    // Then update Gmail labels: add/remove UNREAD
    const add = willBeUnread ? ['UNREAD'] : [];
    const remove = willBeUnread ? [] : ['UNREAD'];
    const { error } = await supabase.functions.invoke('gmail-actions', {
      body: {
        action: 'modify',
        id: email.gmailId,
        add,
        remove
      }
    });
    
    if (error) {
      console.warn('Failed to update Gmail labels:', error);
      // Don't revert local/DB state since database update succeeded
    }

    // Refresh categories to update unread counts
    await refetchCategories();
  };
  // Optimistic star toggle mutation
  const starMutation = useMutation({
    mutationFn: async ({
      email,
      willBeStarred
    }: {
      email: Email;
      willBeStarred: boolean;
    }) => {
      const add = willBeStarred ? ['STARRED'] : [];
      const remove = willBeStarred ? [] : ['STARRED'];
      const {
        error
      } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'modify',
          id: email.gmailId,
          add,
          remove
        }
      });
      if (error) throw error;
      return {
        email,
        willBeStarred
      };
    },
    onMutate: async ({
      email,
      willBeStarred
    }) => {
      await queryClient.cancelQueries({
        queryKey: ['emails']
      });
      const previousEmails = queryClient.getQueryData(['emails', mailbox, query, currentPage]);

      // Optimistically update star status
      queryClient.setQueryData(['emails', mailbox, query, currentPage], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          emails: old.emails.map((e: Email) => e.id === email.id ? {
            ...e,
            starred: willBeStarred
          } : e)
        };
      });
      setEmails(prev => prev.map(e => e.id === email.id ? {
        ...e,
        starred: willBeStarred
      } : e));
      return {
        previousEmails
      };
    },
    onError: (err, variables, context) => {
      if (context?.previousEmails) {
        queryClient.setQueryData(['emails', mailbox, query, currentPage], context.previousEmails);
      }
      refetchEmails();
      toast({
        title: 'Failed to update',
        description: 'Could not update star status. Please try again.'
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['emails']
      });
    }
  });
  const toggleStar = (email: Email) => {
    const willBeStarred = !email.starred;
    starMutation.mutate({
      email,
      willBeStarred
    });
  };
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());
  
  const markAsRead = async (email: Email) => {
    if (!email.unread || markingAsRead.has(email.id)) return; // Already read or currently marking as read

    // Mark as currently processing
    setMarkingAsRead(prev => new Set(prev).add(email.id));

    try {
      // Update database first
      const { error } = await supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('id', email.id);
        
      if (error) {
        console.error('Failed to mark email as read:', error);
        return;
      }

      // Update local state after successful database update
      setEmails(prev => prev.map(e => e.id === email.id ? {
        ...e,
        unread: false
      } : e));

      // Also update the Gmail side to mark as read (don't await this)
      supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'modify',
          id: email.gmailId,
          remove: ['UNREAD']
        }
      }).then(({ error: gmailError }) => {
        if (gmailError) {
          console.warn('Failed to mark email as read in Gmail:', gmailError);
        }
      });

      // Refresh categories to update unread counts (don't await this)
      refetchCategories();
    } finally {
      // Remove from processing set
      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.delete(email.id);
        return newSet;
      });
    }
  };
  const openReplyFooter = (email: Email) => {
    const emailMatch = email.from.match(/<(.+?)>/) || email.from.match(/([^\s<>]+@[^\s<>]+)/);
    const senderEmail = emailMatch ? emailMatch[1] || emailMatch[0] : email.from;
    const replySubject = email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`;
    const quoted = `\n\nOn ${email.date}, ${email.from} wrote:\n> ${email.body?.split('\n').join('\n> ')}`;
    setFooterTo(senderEmail);
    setFooterSubject(replySubject);
    setFooterBody(quoted);
    setFooterReplyOpen(true);
  };
  const sendFooterReply = async () => {
    const toList = footerTo.split(',').map(s => s.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast({
        title: 'Add recipient',
        description: 'Please add at least one email address.'
      });
      return;
    }
    
    // Add signature to body if it exists
    const bodyWithSignature = signature ? `${footerBody}\n\n${signature}` : footerBody;
    
    try {
      const {
        error
      } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'send',
          to: toList,
          subject: footerSubject,
          text: bodyWithSignature
        }
      });
      if (error) {
        toast({
          title: 'Send failed',
          description: error.message
        });
        return;
      }
      toast({
        title: 'Sent',
        description: 'Reply delivered.'
      });
      setFooterReplyOpen(false);
      setFooterBody('');
    } catch (e) {
      toast({
        title: 'Send failed',
        description: 'Unexpected error'
      });
    }
  };
  const handleSendReply = async (to: string, subject: string, body: string) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          subject,
          body
        })
      });
      if (response.ok) {
        toast({
          title: "Reply sent",
          description: "Your reply has been sent successfully"
        });
      } else {
        throw new Error('Failed to send reply');
      }
    } catch (error) {
      toast({
        title: "Failed to send reply",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };
  const handleImport = async (max = 100) => {
    toast({
      title: 'Importing…',
      description: `Fetching latest ${max} emails.`
    });
    const {
      data,
      error
    } = await supabase.functions.invoke("gmail-actions", {
      body: {
        action: "import",
        max
      }
    });
    if (error) {
      toast({
        title: "Import failed",
        description: error.message
      });
      return;
    }
    toast({
      title: "Imported",
      description: `${data?.imported ?? 0} messages imported.`
    });
    // Invalidate cache to refresh
    queryClient.invalidateQueries({
      queryKey: ['emails']
    });
    setCurrentPage(1);
  };

  const handleCreateInbox = async () => {
    if (!newInboxName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the inbox."
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("gmail-actions", {
        body: {
          action: "create-label",
          name: newInboxName.trim()
        }
      });

      if (error) {
        toast({
          title: "Create failed",
          description: error.message
        });
        return;
      }

      toast({
        title: "Inbox created",
        description: `"${newInboxName.trim()}" inbox created successfully.`
      });

      // Refresh categories
      queryClient.invalidateQueries({
        queryKey: ['categories']
      });

      setShowCreateInbox(false);
      setNewInboxName('');
    } catch (e) {
      toast({
        title: "Create failed",
        description: "Unexpected error creating inbox."
      });
    }
  };

  const handleUpdateSignature = async () => {
    try {
      const { error } = await supabase.functions.invoke("gmail-actions", {
        body: {
          action: "update-signature",
          signature: newSignature
        }
      });

      if (error) {
        toast({
          title: "Update failed",
          description: error.message
        });
        return;
      }

      setSignature(newSignature);
      setShowSignatureSettings(false);
      toast({
        title: "Signature updated",
        description: "Your email signature has been updated."
      });
    } catch (e) {
      toast({
        title: "Update failed",
        description: "Unexpected error updating signature."
      });
    }
  };

  const handleCreateFilterFromEmail = (email: Email) => {
    setCreateFilterEmail(email);
    setShowCreateFilter(true);
  };

  const processEmailWithFilters = async (emailId: string) => {
    try {
      await supabase.functions.invoke('email-filter', {
        body: {
          action: 'process-email',
          emailId
        }
      });
      
      // Refresh email data to show new tags
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    } catch (error) {
      console.error('Failed to process email with filters:', error);
    }
  };
  const switchMailbox = async (newMailbox: string) => {
    setMailbox(newMailbox);
    setCurrentPage(1);
    setSelectedId(undefined);
    // Cache will auto-update when mailbox changes
   };
   
   const SidebarContent = () => (
     <aside className="rounded-lg border bg-card">
       <nav className="p-2">
         <div className="mb-3">
           <div className="mb-1 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
             Mail ({totalUnreads} unread)
           </div>
         </div>
         <SidebarItem label="Inbox" active={mailbox === "inbox"} count={(emails || []).filter(e => e.labels.includes("inbox") && e.unread).length} onClick={() => {
           switchMailbox("inbox");
           if (isMobile) setMobileMenuOpen(false);
         }} />
         <SidebarItem label="Sent" active={mailbox === "sent"} onClick={() => {
           switchMailbox("sent");
           if (isMobile) setMobileMenuOpen(false);
         }} />
         <SidebarItem label="Starred" active={mailbox === "starred"} count={(emails || []).filter(e => e.starred && e.unread).length} onClick={() => {
           switchMailbox("starred");
           if (isMobile) setMobileMenuOpen(false);
         }} />
          <SidebarItem label="Archived" active={mailbox === "archived"} onClick={() => {
            switchMailbox("archived");
            if (isMobile) setMobileMenuOpen(false);
          }} />
          <SidebarItem label="Drafts" active={mailbox === "drafts"} onClick={() => {
            switchMailbox("drafts");
            if (isMobile) setMobileMenuOpen(false);
          }} />
         
           <div className="mt-4 mb-2 px-3 flex items-center justify-between">
             <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
               Categories
             </span>
             <Button 
               variant="ghost" 
               size="sm" 
               className="h-6 px-2 text-xs" 
               onClick={() => setShowCreateInbox(true)}
             >
               +
             </Button>
           </div>
           {(categories || []).map(category => <SidebarItem key={category} label={category} active={mailbox === category} count={(emails || []).filter(e => e.labels.includes(category.toLowerCase()) && e.unread).length} onClick={() => {
             switchMailbox(category);
             if (isMobile) setMobileMenuOpen(false);
           }} />)}

           {(filters || []).length > 0 && (
             <>
               <div className="mt-4 mb-2 px-3 flex items-center justify-between">
                 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                   Smart Filters
                 </span>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 px-2 text-xs" 
                   onClick={() => navigate('/filters')}
                 >
                   <Filter className="h-3 w-3" />
                 </Button>
               </div>
                {(filters || []).map(filter => (
                  <SidebarItem 
                    key={filter.id} 
                    label={filter.name} 
                    active={mailbox === `filter:${filter.id}`} 
                    count={(filterCategories || {})[filter.name] || 0}
                   onClick={() => {
                     switchMailbox(`filter:${filter.id}`);
                     if (isMobile) setMobileMenuOpen(false);
                   }} 
                 />
               ))}
             </>
           )}
       </nav>
        <div className="px-3 pb-3">
          <div className="rounded-md border p-3 text-sm text-muted-foreground space-y-2">
            <div>
              Shortcuts: C compose, E archive, J/K navigate, Cmd/Ctrl+K commands.
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => {
                  setNewSignature(signature);
                  setShowSignatureSettings(true);
                }}
              >
                Email Signature
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => navigate('/filters')}
              >
                Filters
              </Button>
            </div>
          </div>
        </div>
     </aside>
   );
   
   return <div className="min-h-screen bg-background">
      <header onMouseMove={onPointerMove} className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div ref={glowRef} className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{
          background: "radial-gradient(600px circle at var(--x) var(--y), hsl(var(--primary)/0.12), transparent 60%)"
        }} />
          <div className="container flex items-center gap-3 py-3">
            <Mail className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight">Not Gmail</h1>
            <div className="ml-auto flex items-center gap-2">
               <div className="hidden md:block w-72">
                <Input aria-label="Search mail" placeholder="Search (Cmd/Ctrl+K)" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter' && query.trim()) {
                  navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                }
              }} />
              </div>
              {mailbox === 'inbox' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      toast({ title: 'Login required', description: 'Please log in to process emails.' });
                      return;
                    }
                    setProcessingFilters(true);
                    setProcessingProgress(0);
                    setProcessingSummary(null);
                    const interval = setInterval(() => {
                      setProcessingProgress(prev => Math.min(prev + 5, 90));
                    }, 400);
                    try {
                      const { data, error } = await supabase.functions.invoke('process-filters', {
                        headers: { Authorization: `Bearer ${session.access_token}` }
                      });
                      if (error) throw error;
                      setProcessingProgress(100);
                      setProcessingSummary(data?.message || `Processed ${data?.processedCount || 0} emails`);
                      queryClient.invalidateQueries({ queryKey: ['emails'] });
                      queryClient.invalidateQueries({ queryKey: ['categories'] });
                      refetchEmails();
                    } catch (error: any) {
                      console.error('Error processing filters:', error);
                      setProcessingSummary(error?.message || 'Failed to process emails with filters');
                    } finally {
                      clearInterval(interval);
                      setTimeout(() => setProcessingFilters(false), 1200);
                      setTimeout(() => setProcessingSummary(null), 5000);
                    }
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Process Recent Emails
                </Button>
              )}
              {!initialImportCompleted && (
                <Button variant="secondary" onClick={async () => {
                const {
                  data: {
                    session
                  }
                } = await supabase.auth.getSession();
                if (!session) {
                  toast({
                    title: "Login required",
                    description: "Please log in to connect Gmail."
                  });
                  return;
                }
                const {
                  data,
                  error
                } = await supabase.functions.invoke("gmail-oauth", {
                  body: {
                    redirect_url: window.location.origin
                  }
                });
                if (error || !data?.authUrl) {
                  toast({
                    title: "Error",
                    description: error?.message || "Could not start Google OAuth."
                  });
                  return;
                }
                window.location.href = data.authUrl;
              }}>Connect Gmail</Button>
              )}
              <Button onClick={() => setFooterReplyOpen(true)}>Send Email </Button>
            </div>
          </div>
        </div>
      </header>
      {processingFilters && (
        <div className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container py-2">
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-sm">Applying filters to recent emails...</div>
                <Progress value={processingProgress} className="h-1 mt-2" />
              </div>
            </div>
          </div>
        </div>
      )}
      {processingSummary && !processingFilters && (
        <div className="border-b bg-muted/30">
          <div className="container py-2 text-sm">
            {processingSummary}
          </div>
        </div>
      )}

       <main className={`container py-4 ${
         isMobile 
           ? 'space-y-4' 
           : 'grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4'
       }`}>
          {/* Background Sync Monitor */}
          <div className={isMobile ? '' : 'col-span-full'}>
            <BackgroundSyncMonitor 
              userId={currentUser} 
              accountId={currentAccount} 
              onSyncComplete={() => {
                // Refresh emails and categories after sync
                queryClient.invalidateQueries({ queryKey: ['emails'] });
                queryClient.invalidateQueries({ queryKey: ['categories'] });
              }}
            />
          </div>
         {/* Desktop Sidebar */}
         {!isMobile && <SidebarContent />}

         {/* Email List */}
         <section className={`rounded-lg border bg-card overflow-hidden ${
           isMobile && selected ? 'hidden' : 'block'
         }`}>
           <ScrollArea className={`${
             isMobile ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-9.5rem)]'
           }`}>
            {isLoading || isImportingSent ? <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    {isImportingSent ? 'Importing sent emails...' : 'Loading emails...'}
                  </p>
                </div>
              </div> : filtered.length === 0 ? <div className="p-6 text-sm text-muted-foreground">
                {initialImportCompleted ? 'No messages found.' : 'No messages yet. Click "Connect Gmail" to load your inbox.'}
              </div> : <div className="divide-y">
                {filtered.map(m => <div key={m.id}>
                      <button className={`w-full text-left px-3 py-2 md:py-1.5 h-20 md:h-16 focus:outline-none transition-colors overflow-hidden ${selected?.id === m.id ? "bg-accent" : "hover:bg-accent"}`} onClick={() => {
                 setSelectedId(m.id);
                 markAsRead(m);
               }} aria-current={selected?.id === m.id}>
                       <div className="flex items-center gap-2 h-full">
                          <div className="shrink-0 text-xs p-1" onClick={e => {
                    e.stopPropagation();
                    toggleStar(m);
                  }}>
                            {m.starred ? <Star className="h-3 w-3 text-primary fill-primary" /> : <StarOff className="h-3 w-3 text-muted-foreground" />}
                          </div>
                           <div className="flex min-w-0 flex-col flex-1 justify-center overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                 <p className={`flex-1 min-w-0 truncate text-sm md:text-sm leading-none ${m.unread ? "font-semibold" : "font-normal"}`}>
                                   {m.subject.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '(no subject)'}
                                 </p>
                                 {m.filterResults && m.filterResults.length > 0 && (
                                   <div className="flex gap-1">
                                     {m.filterResults.slice(0, 2).map((result) => (
                                       <Badge key={result.filterId} variant="secondary" className="text-xs px-1 py-0 h-4">
                                         {result.filterName}
                                       </Badge>
                                     ))}
                                     {m.filterResults.length > 2 && (
                                       <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                                         +{m.filterResults.length - 2}
                                       </Badge>
                                     )}
                                   </div>
                                 )}
                                 {m.unread && <div className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                               </div>
                               <div className="flex items-center gap-2 min-w-0 mt-1">
                                 <p className="flex-1 min-w-0 truncate text-xs leading-none text-muted-foreground overflow-hidden">
                                   {m.from.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()} — {m.snippet.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()}
                                 </p>
                                 {m.tags && m.tags.length > 0 && (
                                   <div className="flex gap-1">
                                     {m.tags.slice(0, 3).map((tag) => (
                                       <Badge key={tag} variant="outline" className="text-xs px-1 py-0 h-4">
                                         {tag}
                                       </Badge>
                                     ))}
                                   </div>
                                 )}
                               </div>
                           </div>
                          <div className="ml-auto shrink-0 flex flex-col items-end gap-1">
                            <span className="w-16 md:w-20 text-right tabular-nums text-xs text-muted-foreground">
                              {isMobile ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : new Date(m.date).toLocaleDateString()}
                            </span>
                          </div>
                       </div>
                     </button>
                  </div>)}
              </div>}
          </ScrollArea>
          {totalEmails > PAGE_SIZE && <div className="border-t p-3">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => {
                  if (currentPage > 1) {
                    const newPage = currentPage - 1;
                    setCurrentPage(newPage);
                    // Page change will trigger cache update
                  }
                }} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                  </PaginationItem>
                  
                  {Array.from({
                length: Math.min(5, Math.ceil(totalEmails / PAGE_SIZE))
              }, (_, i) => {
                const page = i + 1;
                return <PaginationItem key={page}>
                        <PaginationLink onClick={() => {
                    setCurrentPage(page);
                    // Page change will trigger cache update
                  }} isActive={currentPage === page} className="cursor-pointer">
                          {page}
                        </PaginationLink>
                      </PaginationItem>;
              })}
                  
                  {Math.ceil(totalEmails / PAGE_SIZE) > 5 && <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>}
                  
                  <PaginationItem>
                    <PaginationNext onClick={() => {
                  if (currentPage < Math.ceil(totalEmails / PAGE_SIZE)) {
                    const newPage = currentPage + 1;
                    setCurrentPage(newPage);
                    // Page change will trigger cache update
                  }
                }} className={currentPage >= Math.ceil(totalEmails / PAGE_SIZE) ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>}
        </section>

         {/* Email Detail */}
         <article className={`rounded-lg border bg-card overflow-hidden ${
           isMobile && !selected ? 'hidden' : 'block'
         } ${isMobile ? 'col-span-full' : ''}`}>
           {isMobile && selected && (
             <div className="flex items-center gap-2 p-2 border-b">
               <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                 ← Back
               </Button>
               <span className="text-sm font-medium truncate">{selected.subject}</span>
             </div>
           )}
           {selected ? <div className="flex h-full flex-col">
              <div className="border-b">
                <div className="px-4 pt-4 pb-2">
                  <h2 className="text-xl font-normal leading-tight">{selected.subject}</h2>
                </div>
                <div className="px-4 pb-3 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    From: {selected.from}
                  </div>
                   <div className="flex items-center gap-1">
                     <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={async () => {
                   if (selected) await toggleReadFor(selected);
                 }}>
                       {selected?.unread ? 'Mark as read' : 'Mark as unread'}
                     </Button>
                     <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => selected && handleCreateFilterFromEmail(selected)}>
                       <Plus className="mr-1 h-3 w-3" /> Filter
                     </Button>
                     <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => selected && openReplyFooter(selected)}>
                       <Reply className="mr-1 h-3 w-3" /> Reply
                     </Button>
                     <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={archiveSelected}>
                       <Archive className="mr-1 h-3 w-3" /> Archive
                     </Button>
                   </div>
                </div>
              </div>
               <ScrollArea className="flex-1">
                 <div className="space-y-2 p-4">
                   {selected.filterResults && selected.filterResults.length > 0 && (
                     <div className="bg-muted/30 rounded-lg p-3 mb-4">
                       <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                         <Filter className="h-4 w-4" />
                         Filter Results
                       </h4>
                       <div className="space-y-2">
                         {selected.filterResults.map((result) => (
                           <div key={result.filterId} className="flex items-center gap-2 text-sm">
                             <Badge variant="secondary">{result.filterName}</Badge>
                             <span className="text-muted-foreground">applied tags:</span>
                             <div className="flex gap-1">
                               {result.tags.map((tag) => (
                                 <Badge key={tag} variant="outline" className="text-xs">
                                   {tag}
                                 </Badge>
                               ))}
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                   <EmailContent email={selected} />
                 </div>
               </ScrollArea>
            </div> : <div className="grid h-full place-items-center p-6 text-muted-foreground">
              Select a conversation to view
            </div>}
        </article>
      </main>


      {/* Mobile Sheet Navigation */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Navigation</h2>
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => switchMailbox("inbox")}>
              Inbox
              <CommandShortcut>I</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => switchMailbox("sent")}>
              Sent
            </CommandItem>
            <CommandItem onSelect={() => switchMailbox("starred")}>
              Starred
            </CommandItem>
            <CommandItem onSelect={() => switchMailbox("archived")}>
              Archived
            </CommandItem>
            <CommandItem onSelect={() => switchMailbox("drafts")}>
              Drafts
            </CommandItem>
            {categories.map(category => <CommandItem key={category} onSelect={() => switchMailbox(category)}>
                {category}
              </CommandItem>)}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => setFooterReplyOpen(true)}>
              New email
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => navigate('/filters')}>
              Email Filters
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Signature Settings Dialog */}
      <Dialog open={showSignatureSettings} onOpenChange={setShowSignatureSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Signature</label>
              <textarea
                placeholder="Your email signature..."
                value={newSignature}
                onChange={(e) => setNewSignature(e.target.value)}
                className="w-full p-3 text-sm border rounded-md resize-none h-32"
              />
              <p className="text-xs text-muted-foreground">
                This signature will be automatically added to all outgoing emails.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSignature}>
              Update Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Inbox Dialog */}
      <Dialog open={showCreateInbox} onOpenChange={setShowCreateInbox}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Inbox</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Inbox name"
              value={newInboxName}
              onChange={(e) => setNewInboxName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateInbox();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInbox(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInbox}>
              Create Inbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer Email Compose - Mobile Responsive */}
      {footerReplyOpen && <div className={`fixed bottom-0 right-4 ${
        isMobile ? 'left-4 w-auto' : 'w-[576px]'
      } bg-card border rounded-t-lg shadow-lg z-50`}>
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">New Email</h3>
            <Button variant="ghost" size="sm" onClick={() => setFooterReplyOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3 space-y-3">
            <EmailAutocomplete 
              placeholder="To" 
              value={footerTo} 
              onChange={setFooterTo} 
              className="text-sm" 
            />
            <Input placeholder="Subject" value={footerSubject} onChange={e => setFooterSubject(e.target.value)} className="text-sm" />
            <textarea 
              placeholder="Type your message..." 
              value={footerBody} 
              onChange={e => setFooterBody(e.target.value)} 
              className={`w-full p-3 text-sm border rounded-md resize-none ${
                isMobile ? 'h-48' : 'h-72'
              }`} 
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFooterReplyOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={sendFooterReply}>
                <Send className="mr-1 h-3 w-3" /> Send
              </Button>
            </div>
          </div>
        </div>}

        {/* Create Filter Dialog */}
        <CreateFilterDialog 
          open={showCreateFilter} 
          onOpenChange={setShowCreateFilter}
          templateEmail={createFilterEmail}
        />
    </div>;
};
function SidebarItem({
  label,
  count,
  active,
  onClick
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return <button onClick={onClick} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-accent" : "hover:bg-accent"}`}>
      <span className="font-medium">{label}</span>
      {typeof count === "number" && count > 0 && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{count}</span>}
    </button>;
}
// ... keep existing code (ComposeDialog moved to separate component)
export default Index;