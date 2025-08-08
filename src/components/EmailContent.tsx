import { useEffect, useRef } from 'react';

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
}

export const EmailContent = ({ email }: EmailContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

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


  if (email.bodyHtml) {
    return (
      <div 
        ref={containerRef}
        className="email-content-container"
        style={{
          contain: 'layout style',
          maxWidth: '100%',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          lineHeight: '1.6',
          fontSize: '14px',
          color: 'hsl(var(--foreground))',
        }}
      />
    );
  }

  return (
    <div className="leading-7 whitespace-pre-wrap text-foreground">
      {email.body}
    </div>
  );
};