import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
interface BackgroundSyncMonitorProps {
  userId?: string;
  accountId?: string;
  onSyncComplete?: () => void;
}
interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  metadata: any; // Use any for Json type from Supabase
}
export default function BackgroundSyncMonitor({
  userId,
  accountId,
  onSyncComplete
}: BackgroundSyncMonitorProps) {
  const [activeSyncs, setActiveSyncs] = useState<SyncJob[]>([]);
  const [isInitialImportStarted, setIsInitialImportStarted] = useState(false);
  useEffect(() => {
    if (!userId || !accountId) return;

    // Load initial active syncs
    const loadActiveSyncs = async () => {
      const {
        data
      } = await supabase.from('sync_jobs').select('*').eq('user_id', userId).eq('account_id', accountId).in('status', ['pending', 'running']).order('created_at', {
        ascending: false
      });
      if (data) {
        setActiveSyncs(data);
        // If there are already active syncs, don't start new ones
        if (data.length > 0) {
          setIsInitialImportStarted(true);
        }
      }
    };
    loadActiveSyncs();

    // Subscribe to sync job changes
    const channel = supabase.channel('sync-jobs-monitor').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sync_jobs',
      filter: `user_id=eq.${userId}`
    }, payload => {
      const job = payload.new as SyncJob;
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setActiveSyncs(prev => {
          const filtered = prev.filter(s => s.id !== job.id);
          if (job.status === 'pending' || job.status === 'running') {
            return [...filtered, job];
          }
          return filtered;
        });

        // Only show completion notifications on component mount (not background syncs)
        if (payload.eventType === 'UPDATE') {
          if (job.status === 'completed') {
            onSyncComplete?.();
          }
        }
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, accountId, onSyncComplete]);
  const startInitialImport = async () => {
    if (!userId || !accountId || isInitialImportStarted) return;
    setIsInitialImportStarted(true);
    
    try {
      // Only start inbox import initially to avoid multiple sync jobs
      const { error: inboxError } = await supabase.functions.invoke('gmail-actions', {
        body: { action: 'import', mailbox: 'inbox', max: 100 }
      });
      if (inboxError) {
        throw inboxError;
      }
      
    } catch (error) {
      console.error('Failed to start import:', error);
      setIsInitialImportStarted(false);
    }
  };
  // Auto-start initial import when component mounts
  useEffect(() => {
    if (userId && accountId && !isInitialImportStarted) {
      startInitialImport();
    }
  }, [userId, accountId]);

  if (activeSyncs.length === 0) {
    return null;
  }
  return <div className="space-y-2">
      {activeSyncs.map(sync => {
      const mailbox = sync.metadata?.mailbox || 'emails';
      return <div key={sync.id} className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Syncing {mailbox}...</span>
            <span className="text-xs opacity-75">
              {sync.status === 'running' ? 'In progress' : 'Starting'}
            </span>
          </div>;
    })}
    </div>;
}