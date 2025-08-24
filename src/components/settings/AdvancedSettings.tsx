import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Settings, Database, Upload, Download, RefreshCw, Zap, Code, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AdvancedSettingsProps {
  user: any;
  account: any;
}

export default function AdvancedSettings({ user, account }: AdvancedSettingsProps) {
  const [syncInterval, setSyncInterval] = useState("5");
  const [batchSize, setBatchSize] = useState("50");
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [prefetchEnabled, setPrefetchEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [storageUsage, setStorageUsage] = useState({
    emails: 0,
    attachments: 0,
    total: 0
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = {
      syncInterval: localStorage.getItem("email-syncInterval") || "5",
      batchSize: localStorage.getItem("email-batchSize") || "50",
      cacheEnabled: localStorage.getItem("email-cacheEnabled") !== "false",
      debugMode: localStorage.getItem("email-debugMode") === "true",
      prefetchEnabled: localStorage.getItem("email-prefetchEnabled") !== "false",
      compressionEnabled: localStorage.getItem("email-compressionEnabled") !== "false"
    };

    setSyncInterval(savedSettings.syncInterval);
    setBatchSize(savedSettings.batchSize);
    setCacheEnabled(savedSettings.cacheEnabled);
    setDebugMode(savedSettings.debugMode);
    setPrefetchEnabled(savedSettings.prefetchEnabled);
    setCompressionEnabled(savedSettings.compressionEnabled);

    loadStorageUsage();
  }, []);

  const updateSetting = (key: string, value: any) => {
    localStorage.setItem(`email-${key}`, value.toString());
    toast({
      title: "Advanced setting updated",
      description: "Your preference has been saved"
    });
  };

  const loadStorageUsage = async () => {
    if (!user) return;

    try {
      // Get email count and estimated size
      const { count: emailCount } = await supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Estimate storage usage (rough calculation)
      const estimatedEmailSize = (emailCount || 0) * 0.01; // ~10KB per email
      
      setStorageUsage({
        emails: estimatedEmailSize,
        attachments: 0, // Not tracking attachments yet
        total: estimatedEmailSize
      });
    } catch (error) {
      console.error('Failed to load storage usage:', error);
    }
  };

  const triggerManualSync = async () => {
    if (!account) {
      toast({
        title: "No account connected",
        description: "Please connect an email account first",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setSyncProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('directory-sync', {
        body: {
          accountId: account.id,
          forceRefresh: true
        }
      });

      if (error) throw error;

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Complete progress when done
      setTimeout(() => {
        setSyncProgress(100);
        setIsImporting(false);
        toast({
          title: "Sync completed",
          description: "Your emails have been synchronized"
        });
        loadStorageUsage();
      }, 5000);

    } catch (error: any) {
      setIsImporting(false);
      setSyncProgress(0);
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const clearCache = async () => {
    try {
      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Clear localStorage caches
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('email-cache-') || key.startsWith('query-cache-')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      toast({
        title: "Cache cleared",
        description: "Application cache has been cleared"
      });
    } catch (error: any) {
      toast({
        title: "Failed to clear cache",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetAllSettings = () => {
    // Reset all settings to defaults
    const settingsToReset = [
      'syncInterval', 'batchSize', 'cacheEnabled', 'debugMode', 
      'prefetchEnabled', 'compressionEnabled'
    ];
    
    settingsToReset.forEach(setting => {
      localStorage.removeItem(`email-${setting}`);
    });

    // Reset to defaults
    setSyncInterval("5");
    setBatchSize("50");
    setCacheEnabled(true);
    setDebugMode(false);
    setPrefetchEnabled(true);
    setCompressionEnabled(true);

    toast({
      title: "Settings reset",
      description: "All advanced settings have been reset to defaults"
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Advanced Settings</h2>
        <p className="text-muted-foreground">
          Performance optimization, sync settings, and developer options
        </p>
      </div>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance & Optimization
          </CardTitle>
          <CardDescription>
            Configure performance settings to optimize the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
              <Select value={syncInterval} onValueChange={(value) => {
                setSyncInterval(value);
                updateSetting("syncInterval", value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchSize">Email Batch Size</Label>
              <Select value={batchSize} onValueChange={(value) => {
                setBatchSize(value);
                updateSetting("batchSize", value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 emails</SelectItem>
                  <SelectItem value="50">50 emails</SelectItem>
                  <SelectItem value="100">100 emails</SelectItem>
                  <SelectItem value="200">200 emails</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache emails and metadata for faster loading
                </p>
              </div>
              <Switch
                checked={cacheEnabled}
                onCheckedChange={(checked) => {
                  setCacheEnabled(checked);
                  updateSetting("cacheEnabled", checked);
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Prefetch Next Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Pre-load next emails in the background
                </p>
              </div>
              <Switch
                checked={prefetchEnabled}
                onCheckedChange={(checked) => {
                  setPrefetchEnabled(checked);
                  updateSetting("prefetchEnabled", checked);
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Compression</Label>
                <p className="text-sm text-muted-foreground">
                  Compress data to reduce bandwidth usage
                </p>
              </div>
              <Switch
                checked={compressionEnabled}
                onCheckedChange={(checked) => {
                  setCompressionEnabled(checked);
                  updateSetting("compressionEnabled", checked);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync & Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sync & Data Management
          </CardTitle>
          <CardDescription>
            Manage email synchronization and data storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Manual Sync</h4>
              <p className="text-sm text-muted-foreground">
                Force synchronization with your email provider
              </p>
            </div>
            <Button 
              onClick={triggerManualSync} 
              disabled={isImporting}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isImporting ? 'animate-spin' : ''}`} />
              {isImporting ? "Syncing..." : "Sync Now"}
            </Button>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sync Progress</span>
                <span>{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} />
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage Usage
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Emails</p>
                <p className="font-medium">{formatFileSize(storageUsage.emails * 1024 * 1024)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Attachments</p>
                <p className="font-medium">{formatFileSize(storageUsage.attachments * 1024 * 1024)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{formatFileSize(storageUsage.total * 1024 * 1024)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={clearCache} size="sm">
              Clear Cache
            </Button>
            <Button variant="outline" onClick={loadStorageUsage} size="sm">
              Refresh Usage
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Developer Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Developer Options
          </CardTitle>
          <CardDescription>
            Advanced settings for debugging and development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Debug Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable detailed logging and error reporting
              </p>
            </div>
            <Switch
              checked={debugMode}
              onCheckedChange={(checked) => {
                setDebugMode(checked);
                updateSetting("debugMode", checked);
                
                // Enable/disable console logging
                if (checked) {
                  console.log("Debug mode enabled");
                } else {
                  console.log("Debug mode disabled");
                }
              }}
            />
          </div>

          {debugMode && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Debug Information</p>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p>User ID: {user?.id}</p>
                <p>Account ID: {account?.id || 'Not connected'}</p>
                <p>Cache Enabled: {cacheEnabled ? 'Yes' : 'No'}</p>
                <p>Sync Interval: {syncInterval} minutes</p>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-destructive">Reset All Settings</h4>
              <p className="text-sm text-muted-foreground">
                Reset all advanced settings to their default values
              </p>
            </div>
            <Button variant="destructive" onClick={resetAllSettings}>
              Reset Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}