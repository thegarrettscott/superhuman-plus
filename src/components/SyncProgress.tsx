import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, Mail, Users, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncProgressProps {
  userId?: string;
  accountId?: string;
  onSyncComplete?: () => void;
}

interface SyncStatus {
  id: string;
  sync_type: string;
  status: string;
  total_items: number;
  synced_items: number;
  error_message?: string;
}

const getSyncIcon = (syncType: string) => {
  switch (syncType) {
    case 'labels':
      return <FolderOpen className="h-5 w-5" />;
    case 'contacts':
      return <Users className="h-5 w-5" />;
    case 'messages':
      return <Mail className="h-5 w-5" />;
    default:
      return <Clock className="h-5 w-5" />;
  }
};

const getSyncTitle = (syncType: string) => {
  switch (syncType) {
    case 'labels':
      return 'Gmail Labels & Folders';
    case 'contacts':
      return 'Google Contacts';
    case 'messages':
      return 'Recent Email Messages';
    default:
      return syncType;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function SyncProgress({ userId, accountId, onSyncComplete }: SyncProgressProps) {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId || !accountId) return;

    // Subscribe to sync status changes
    const channel = supabase
      .channel('sync-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_status',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Sync status change:', payload);
          fetchSyncStatus();
        }
      )
      .subscribe();

    // Initial fetch
    fetchSyncStatus();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, accountId]);

  const fetchSyncStatus = async () => {
    if (!userId || !accountId) return;

    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sync status:', error);
        return;
      }

      if (data && data.length > 0) {
        setSyncStatuses(data);
        setIsVisible(true);

        // Check if all syncs are complete
        const allComplete = data.every(status => 
          status.status === 'completed' || status.status === 'failed'
        );

        if (allComplete) {
          const failedSyncs = data.filter(status => status.status === 'failed');
          
          onSyncComplete?.();

          // Hide progress after 3 seconds
          setTimeout(() => setIsVisible(false), 3000);
        }
      }
    } catch (error) {
      console.error('Error in fetchSyncStatus:', error);
    }
  };

  // Keep sync functionality but don't show modal
  return null;
}