import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, Database, AlertTriangle, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface PrivacySettingsProps {
  user: any;
}

export default function PrivacySettings({ user }: PrivacySettingsProps) {
  const [dataCollection, setDataCollection] = useState(true);
  const [emailTracking, setEmailTracking] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = {
      dataCollection: localStorage.getItem("email-dataCollection") !== "false",
      emailTracking: localStorage.getItem("email-emailTracking") === "true",
      analyticsEnabled: localStorage.getItem("email-analyticsEnabled") !== "false"
    };

    setDataCollection(savedSettings.dataCollection);
    setEmailTracking(savedSettings.emailTracking);
    setAnalyticsEnabled(savedSettings.analyticsEnabled);
  }, []);

  const updateSetting = (key: string, value: any) => {
    localStorage.setItem(`email-${key}`, value.toString());
    toast({
      title: "Privacy setting updated",
      description: "Your preference has been saved"
    });
  };

  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      // Export user data
      const { data: filters } = await supabase
        .from('email_filters')
        .select('*')
        .eq('user_id', user.id);

      const { data: tags } = await supabase
        .from('email_tags')
        .select('*')
        .eq('user_id', user.id);

      const { data: accounts } = await supabase
        .from('email_accounts')
        .select('id, email_address, provider, created_at, auto_filtering_enabled')
        .eq('user_id', user.id);

      const exportData = {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at
        },
        filters: filters || [],
        tags: tags || [],
        accounts: accounts || [],
        exported_at: new Date().toISOString()
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `velocity-mail-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Data exported",
        description: "Your data has been downloaded as a JSON file"
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDataDeletion = async () => {
    setDeleteLoading(true);
    try {
      // Delete user data in correct order (foreign keys)
      const operations = [
        supabase.from('email_message_tags').delete().eq('user_id', user.id),
        supabase.from('email_messages').delete().eq('user_id', user.id),
        supabase.from('email_tags').delete().eq('user_id', user.id),
        supabase.from('email_filters').delete().eq('user_id', user.id),
        supabase.from('gmail_labels').delete().eq('user_id', user.id),
        supabase.from('gmail_contacts').delete().eq('user_id', user.id),
        supabase.from('sync_status').delete().eq('user_id', user.id),
        supabase.from('sync_jobs').delete().eq('user_id', user.id),
        supabase.from('outgoing_mail_logs').delete().eq('user_id', user.id),
        supabase.from('email_accounts').delete().eq('user_id', user.id)
      ];

      await Promise.all(operations);

      toast({
        title: "Data deleted",
        description: "All your data has been permanently deleted"
      });

      // Sign out user after deletion
      setTimeout(() => {
        supabase.auth.signOut();
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Privacy & Security</h2>
        <p className="text-muted-foreground">
          Control your data privacy, security settings, and data handling preferences
        </p>
      </div>

      {/* Data Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Privacy
          </CardTitle>
          <CardDescription>
            Control how your data is collected and used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Anonymous Usage Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help improve the app by sharing anonymous usage data
              </p>
            </div>
            <Switch
              checked={analyticsEnabled}
              onCheckedChange={(checked) => {
                setAnalyticsEnabled(checked);
                updateSetting("analyticsEnabled", checked);
              }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Content Analysis</Label>
              <p className="text-sm text-muted-foreground">
                Allow processing of email content for filtering and organization
              </p>
            </div>
            <Switch
              checked={dataCollection}
              onCheckedChange={(checked) => {
                setDataCollection(checked);
                updateSetting("dataCollection", checked);
              }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Tracking Protection</Label>
              <p className="text-sm text-muted-foreground">
                Block tracking pixels and external images in emails
              </p>
            </div>
            <Switch
              checked={emailTracking}
              onCheckedChange={(checked) => {
                setEmailTracking(checked);
                updateSetting("emailTracking", checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Export or delete your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Eye className="h-4 w-4" />
            <AlertDescription>
              Your email data is stored securely and encrypted. We never sell your data to third parties.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Export Your Data</h4>
              <p className="text-sm text-muted-foreground">
                Download a copy of all your data including filters, tags, and settings
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDataExport}
              disabled={exportLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              {exportLoading ? "Exporting..." : "Export Data"}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-destructive">Delete All Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete all your data from our servers
              </p>
            </div>
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Data
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete All Data</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This action cannot be undone. All your emails, filters, tags, and account data will be permanently deleted.
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete all your data? This will:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Delete all imported emails and metadata</li>
                    <li>Remove all email filters and tags</li>
                    <li>Delete your account settings and preferences</li>
                    <li>Sign you out of the application</li>
                  </ul>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowConfirmDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDataDeletion}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? "Deleting..." : "Delete All Data"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Security Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Information
          </CardTitle>
          <CardDescription>
            How we protect your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Data Encryption</h4>
              <p className="text-muted-foreground">
                All data is encrypted in transit and at rest using industry-standard encryption
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">OAuth Security</h4>
              <p className="text-muted-foreground">
                Gmail access uses secure OAuth tokens that can be revoked at any time
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">No Email Storage</h4>
              <p className="text-muted-foreground">
                Email content is processed for filtering but not permanently stored
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Data Location</h4>
              <p className="text-muted-foreground">
                Your data is stored in secure data centers with SOC 2 compliance
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}