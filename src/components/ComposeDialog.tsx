import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmailAutocomplete } from '@/components/EmailAutocomplete';
import { Send, X, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

export function ComposeDialog({
  open,
  onOpenChange,
  initialTo,
  initialSubject,
  initialBody
}: ComposeDialogProps) {
  const toRef = useRef<HTMLInputElement>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
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
      setCc("");
      setBcc("");
      setShowCc(false);
      setShowBcc(false);
    }
  }, [open, initialTo, initialSubject, initialBody]);

  const handleSend = async () => {
    const toList = to.split(',').map(s => s.trim()).filter(Boolean);
    const ccList = cc.split(',').map(s => s.trim()).filter(Boolean);
    const bccList = bcc.split(',').map(s => s.trim()).filter(Boolean);
    
    if (toList.length === 0) {
      toast({
        title: 'Add recipient',
        description: 'Please add at least one email address.'
      });
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke('gmail-actions', {
      body: {
        action: 'send',
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined,
        subject,
        text: body
      }
    });

    setSending(false);
    if (error) {
      toast({
        title: 'Send failed',
        description: error.message
      });
      return;
    }

    toast({
      title: 'Sent',
      description: 'Message delivered.'
    });
    onOpenChange(false);
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <span className="sr-only">Compose</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <EmailAutocomplete
              value={to}
              onChange={setTo}
              placeholder="To"
              className="flex-1"
            />
            <div className="flex gap-1">
              {!showCc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCc(true)}
                  className="text-xs px-2 py-1 h-auto"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBcc(true)}
                  className="text-xs px-2 py-1 h-auto"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Bcc
                </Button>
              )}
            </div>
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <EmailAutocomplete
                value={cc}
                onChange={setCc}
                placeholder="Cc"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCc(false);
                  setCc("");
                }}
                className="text-xs px-2 py-1 h-auto"
              >
                <Minus className="h-3 w-3" />
              </Button>
            </div>
          )}

          {showBcc && (
            <div className="flex items-center gap-2">
              <EmailAutocomplete
                value={bcc}
                onChange={setBcc}
                placeholder="Bcc"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowBcc(false);
                  setBcc("");
                }}
                className="text-xs px-2 py-1 h-auto"
              >
                <Minus className="h-3 w-3" />
              </Button>
            </div>
          )}

          <Input
            placeholder="Subject"
            aria-label="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <div>
            <textarea
              aria-label="Message body"
              className="min-h-[160px] w-full rounded-md border bg-background p-3 outline-none"
              placeholder="Say hello…"
              value={body}
              onChange={e => setBody(e.target.value)}
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