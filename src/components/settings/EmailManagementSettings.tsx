import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Plus, Trash2, Edit, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AutoFilteringSettings } from "@/components/AutoFilteringSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface EmailManagementSettingsProps {
  user: any;
  account: any;
}

export default function EmailManagementSettings({ user, account }: EmailManagementSettingsProps) {
  const [signature, setSignature] = useState("");
  const [newSignature, setNewSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);

  useEffect(() => {
    loadSignature();
  }, [account]);

  const loadSignature = async () => {
    if (!account) return;
    
    setSignature(account.signature_text || "");
    setNewSignature(account.signature_text || "");
  };

  const saveSignature = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({ 
          signature_text: newSignature,
          signature_html: newSignature // For now, keep them the same
        })
        .eq('id', account.id);

      if (error) throw error;

      setSignature(newSignature);
      setShowSignatureDialog(false);
      toast({
        title: "Success",
        description: "Email signature updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initiateGmailOAuth = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-oauth', {
        method: 'POST'
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate Gmail connection",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Management</h2>
        <p className="text-muted-foreground">
          Manage connected accounts, signatures, and email automation
        </p>
      </div>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Connected Email Accounts
          </CardTitle>
          <CardDescription>
            Manage your connected email providers and OAuth integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account ? (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h4 className="font-medium">{account.email_address}</h4>
                  <p className="text-sm text-muted-foreground">
                    Gmail • Connected {new Date(account.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">Active</Badge>
                <Button variant="outline" size="sm" disabled>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Email Accounts Connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your Gmail account to get started with email management
              </p>
              <Button onClick={initiateGmailOAuth}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Gmail Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Signature */}
      <Card>
        <CardHeader>
          <CardTitle>Email Signature</CardTitle>
          <CardDescription>
            Customize the signature that appears in your outgoing emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Current Signature</h4>
              <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                {signature ? (
                  <pre className="whitespace-pre-wrap font-sans">{signature}</pre>
                ) : (
                  <span className="text-muted-foreground italic">No signature set</span>
                )}
              </div>
            </div>
          </div>
          
          <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Signature
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Email Signature</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signature">Signature Text</Label>
                  <Textarea
                    id="signature"
                    value={newSignature}
                    onChange={(e) => setNewSignature(e.target.value)}
                    placeholder="Best regards,&#10;Your Name&#10;Your Title&#10;Company Name"
                    rows={6}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowSignatureDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveSignature}
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Signature"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Auto-filtering Settings */}
      {account && (
        <AutoFilteringSettings accountId={account.id} />
      )}
    </div>
  );
}