import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Reply, Send, X } from 'lucide-react';

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

interface EmailContentProps {
  email: Email;
  onSendReply?: (to: string, subject: string, body: string) => void;
}

export const EmailContent = ({ email, onSendReply }: EmailContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyTo, setReplyTo] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');

  useEffect(() => {
    if (email.bodyHtml && containerRef.current) {
      // Reset all potential style interference
      const container = containerRef.current;
      
      // Clear existing content
      container.innerHTML = '';
      
      // Create an isolated container for the email content
      const emailContainer = document.createElement('div');
      emailContainer.innerHTML = email.bodyHtml;
      
      // Remove any script tags for security
      const scripts = emailContainer.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      // Remove any style tags that could interfere with our app
      const styles = emailContainer.querySelectorAll('style');
      styles.forEach(style => style.remove());
      
      // Remove any link tags that could load external stylesheets
      const links = emailContainer.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => link.remove());
      
      // Reset font properties that commonly cause issues
      const allElements = emailContainer.querySelectorAll('*');
      allElements.forEach((element) => {
        const el = element as HTMLElement;
        // Remove any inline styles that could affect layout
        if (el.style) {
          el.style.position = '';
          el.style.zIndex = '';
          el.style.margin = '';
          el.style.padding = '';
        }
      });
      
      container.appendChild(emailContainer);
    }
  }, [email.bodyHtml]);

  const handleStartReply = () => {
    // Extract sender email from the "from" field
    const emailMatch = email.from.match(/<(.+?)>/) || email.from.match(/([^\s<>]+@[^\s<>]+)/);
    const senderEmail = emailMatch ? emailMatch[1] || emailMatch[0] : email.from;
    
    // Prepare reply subject (add "Re: " if not already present)
    const replySubject = email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`;
    
    setReplyTo(senderEmail);
    setReplySubject(replySubject);
    setReplyBody('');
    setShowReply(true);
  };

  const handleSendReply = () => {
    if (onSendReply) {
      onSendReply(replyTo, replySubject, replyBody);
    }
    setShowReply(false);
    setReplyBody('');
  };

  const handleCancelReply = () => {
    setShowReply(false);
    setReplyBody('');
  };

  if (email.bodyHtml) {
    return (
      <div 
        ref={containerRef}
        className="email-content-container"
        style={{
          // CSS containment to prevent style leakage
          contain: 'layout style',
          // Ensure email content doesn't break our layout
          maxWidth: '100%',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          // Reset any potential inherited styles
          lineHeight: '1.6',
          fontSize: '14px',
          color: 'hsl(var(--foreground))',
        }}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="border-b pb-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">{email.subject}</h2>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>From: {email.from}</span>
          <span>{email.date}</span>
        </div>
      </div>
      <div className="leading-7 whitespace-pre-wrap text-foreground mb-6">
        {email.body}
      </div>
      
      {!showReply && (
        <div className="flex gap-2 pt-4 border-t">
          <Button 
            onClick={handleStartReply} 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <Reply className="h-4 w-4" />
            Reply
          </Button>
        </div>
      )}

      {showReply && (
        <div className="mt-6 border-t pt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reply</h3>
              <Button variant="ghost" size="sm" onClick={handleCancelReply}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">To:</label>
                <Input 
                  value={replyTo} 
                  onChange={(e) => setReplyTo(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Subject:</label>
                <Input 
                  value={replySubject} 
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Message:</label>
                <Textarea 
                  value={replyBody} 
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type your reply..."
                  className="mt-1 min-h-[120px]"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSendReply} className="gap-2">
                <Send className="h-4 w-4" />
                Send
              </Button>
              <Button variant="outline" onClick={handleCancelReply}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};