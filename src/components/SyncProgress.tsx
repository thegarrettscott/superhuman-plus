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
          
          if (failedSyncs.length === 0) {
            toast({
              title: "Directory sync complete",
              description: "Your Gmail data has been successfully imported.",
            });
            onSyncComplete?.();
          } else {
            toast({
              title: "Sync completed with issues", 
              description: `${failedSyncs.length} sync operations failed. Some data may not be available.`,
              variant: "destructive",
            });
          }

          // Hide progress after 3 seconds
          setTimeout(() => setIsVisible(false), 3000);
        }
      }
    } catch (error) {
      console.error('Error in fetchSyncStatus:', error);
    }
  };

  if (!isVisible || syncStatuses.length === 0) {
    return null;
  }

  const overallProgress = syncStatuses.reduce((acc, status) => {
    if (status.total_items === 0) return acc;
    return acc + (status.synced_items / status.total_items);
  }, 0) / syncStatuses.length * 100;

  const hasInProgress = syncStatuses.some(status => status.status === 'in_progress');

  return (
    <Card className="mb-6 animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Setting up your Gmail workspace
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We're importing your Gmail data to get you started quickly.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        <div className="space-y-3">
          {syncStatuses.map((status) => {
            const progress = status.total_items > 0 
              ? (status.synced_items / status.total_items) * 100 
              : 0;

            return (
              <div key={status.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSyncIcon(status.sync_type)}
                    <span className="text-sm font-medium">
                      {getSyncTitle(status.sync_type)}
                    </span>
                    {getStatusIcon(status.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {status.status === 'completed' && `${status.synced_items} items`}
                    {status.status === 'in_progress' && `${status.synced_items}/${status.total_items}`}
                    {status.status === 'failed' && 'Failed'}
                    {status.status === 'pending' && 'Waiting...'}
                  </div>
                </div>
                
                {status.status === 'in_progress' && status.total_items > 0 && (
                  <Progress value={progress} className="h-1" />
                )}
                
                {status.error_message && (
                  <p className="text-xs text-red-600">{status.error_message}</p>
                )}
              </div>
            );
          })}
        </div>

        {hasInProgress && (
          <p className="text-xs text-muted-foreground">
            This may take a few moments. You can continue using the app while we finish importing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}