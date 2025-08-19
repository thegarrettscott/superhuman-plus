import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface AutoFilteringSettingsProps {
  accountId: string;
}

export function AutoFilteringSettings({ accountId }: AutoFilteringSettingsProps) {
  const [autoFilteringEnabled, setAutoFilteringEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('auto_filtering_enabled')
        .eq('id', accountId)
        .single();

      if (data && !error) {
        setAutoFilteringEnabled(data.auto_filtering_enabled);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [accountId]);

  const handleToggle = async (enabled: boolean) => {
    setAutoFilteringEnabled(enabled);

    const { error } = await supabase
      .from('email_accounts')
      .update({ auto_filtering_enabled: enabled })
      .eq('id', accountId);

    if (error) {
      console.error('Failed to update auto-filtering setting:', error);
      setAutoFilteringEnabled(!enabled); // Revert on error
      toast.error("Failed to update auto-filtering setting");
    } else {
      toast.success(enabled ? "Auto-filtering enabled" : "Auto-filtering disabled");
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic Email Filtering</CardTitle>
        <CardDescription>
          Automatically apply filters and tags to new incoming emails using AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-filtering"
            checked={autoFilteringEnabled}
            onCheckedChange={handleToggle}
          />
          <Label htmlFor="auto-filtering">
            Enable automatic filtering for new emails
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}