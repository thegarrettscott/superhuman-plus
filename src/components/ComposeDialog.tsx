import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmailAutocomplete } from '@/components/EmailAutocomplete';
import { Send, X, Plus, Minus, Paperclip, FileX } from 'lucide-react';
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setAttachments([]);
    }
  }, [open, initialTo, initialSubject, initialBody]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check file size (max 25MB per file)
    const oversizedFiles = files.filter(file => file.size > 25 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: 'File too large',
        description: 'Attachments must be under 25MB each.'
      });
      return;
    }

    setAttachments(prev => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (attachments.length === 0) return [];

    setUploading(true);
    const uploadedPaths: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('email-attachments')
          .upload(fileName, file);

        if (error) throw error;
        uploadedPaths.push(data.path);
      }

      return uploadedPaths;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };

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
    
    try {
      // Upload attachments first
      const attachmentPaths = await uploadAttachments();

      const { data, error } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'send',
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          bcc: bccList.length > 0 ? bccList : undefined,
          subject,
          text: body,
          attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined
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
        description: 'Message delivered.'
      });
      onOpenChange(false);
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setAttachments([]);
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    const toList = to.split(',').map(s => s.trim()).filter(Boolean);
    const ccList = cc.split(',').map(s => s.trim()).filter(Boolean);
    const bccList = bcc.split(',').map(s => s.trim()).filter(Boolean);
    
    if (toList.length === 0) {
      toast({
        title: 'Add recipient',
        description: 'Please add at least one email address to save draft.'
      });
      return;
    }

    setSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('gmail-actions', {
        body: {
          action: 'draft',
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          bcc: bccList.length > 0 ? bccList : undefined,
          subject,
          text: body
        }
      });

      if (error) {
        toast({
          title: 'Save failed',
          description: error.message
        });
        return;
      }

      toast({
        title: 'Draft saved',
        description: 'Draft saved to Gmail.'
      });
      onOpenChange(false);
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setBody("");
      setAttachments([]);
    } catch (error) {
      console.error('Draft save error:', error);
    } finally {
      setSending(false);
    }
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

          {/* Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading}
                className="flex items-center gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Attach files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="*/*"
              />
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted/50 rounded p-2 text-sm">
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground text-xs mr-2">
                      {(file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      disabled={sending || uploading}
                      className="h-6 w-6 p-0"
                    >
                      <FileX className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || uploading}>
            <Send className="mr-2 h-4 w-4" /> 
            {uploading ? 'Uploading…' : sending ? 'Sending…' : 'Send'}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={sending || uploading}>
            {sending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending || uploading}>
            <X className="mr-2 h-4 w-4" /> Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}