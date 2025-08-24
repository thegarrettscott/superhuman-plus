import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bell, Volume2, Smartphone, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NotificationSettingsProps {
  user: any;
}

export default function NotificationSettings({ user }: NotificationSettingsProps) {
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState("medium");
  const [newEmailNotifications, setNewEmailNotifications] = useState(true);
  const [importantEmailOnly, setImportantEmailOnly] = useState(false);
  const [quietHours, setQuietHours] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = {
      desktopNotifications: localStorage.getItem("email-desktopNotifications") === "true",
      soundEnabled: localStorage.getItem("email-soundEnabled") !== "false",
      soundVolume: localStorage.getItem("email-soundVolume") || "medium",
      newEmailNotifications: localStorage.getItem("email-newEmailNotifications") !== "false",
      importantEmailOnly: localStorage.getItem("email-importantEmailOnly") === "true",
      quietHours: localStorage.getItem("email-quietHours") === "true",
      quietStart: localStorage.getItem("email-quietStart") || "22:00",
      quietEnd: localStorage.getItem("email-quietEnd") || "08:00"
    };

    setDesktopNotifications(savedSettings.desktopNotifications);
    setSoundEnabled(savedSettings.soundEnabled);
    setSoundVolume(savedSettings.soundVolume);
    setNewEmailNotifications(savedSettings.newEmailNotifications);
    setImportantEmailOnly(savedSettings.importantEmailOnly);
    setQuietHours(savedSettings.quietHours);
    setQuietStart(savedSettings.quietStart);
    setQuietEnd(savedSettings.quietEnd);

    // Check desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't auto-request, let user enable first
    }
  }, []);

  const updateSetting = (key: string, value: any) => {
    localStorage.setItem(`email-${key}`, value.toString());
    toast({
      title: "Notification setting updated",
      description: "Your preference has been saved"
    });
  };

  const handleDesktopNotificationsChange = async (checked: boolean) => {
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setDesktopNotifications(true);
        updateSetting("desktopNotifications", true);
        
        // Show test notification
        new Notification("Velocity Mail", {
          body: "Desktop notifications are now enabled!",
          icon: "/favicon.ico"
        });
      } else {
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive"
        });
        return;
      }
    } else {
      setDesktopNotifications(checked);
      updateSetting("desktopNotifications", checked);
    }
  };

  const handleSoundEnabledChange = (checked: boolean) => {
    setSoundEnabled(checked);
    updateSetting("soundEnabled", checked);
    
    if (checked) {
      // Play test sound
      playNotificationSound();
    }
  };

  const handleSoundVolumeChange = (value: string) => {
    setSoundVolume(value);
    updateSetting("soundVolume", value);
    playNotificationSound();
  };

  const playNotificationSound = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    const volumeLevel = soundVolume === 'low' ? 0.1 : soundVolume === 'medium' ? 0.3 : 0.5;
    gainNode.gain.value = volumeLevel;
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notifications & Alerts</h2>
        <p className="text-muted-foreground">
          Configure how and when you receive notifications about new emails
        </p>
      </div>

      {/* Desktop Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Desktop Notifications
          </CardTitle>
          <CardDescription>
            Receive native desktop notifications for new emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications even when the app is minimized
              </p>
            </div>
            <Switch
              checked={desktopNotifications}
              onCheckedChange={handleDesktopNotificationsChange}
            />
          </div>

          {desktopNotifications && (
            <>
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Important Emails Only</Label>
                  <p className="text-sm text-muted-foreground">
                    Only notify for starred or high-priority emails
                  </p>
                </div>
                <Switch
                  checked={importantEmailOnly}
                  onCheckedChange={(checked) => {
                    setImportantEmailOnly(checked);
                    updateSetting("importantEmailOnly", checked);
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sound Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Sound Notifications
          </CardTitle>
          <CardDescription>
            Configure audio alerts for new emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Sound Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Play a sound when new emails arrive
              </p>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={handleSoundEnabledChange}
            />
          </div>

          {soundEnabled && (
            <>
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="soundVolume">Sound Volume</Label>
                <Select value={soundVolume} onValueChange={handleSoundVolumeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Control when and how you're notified about emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications for all incoming emails
              </p>
            </div>
            <Switch
              checked={newEmailNotifications}
              onCheckedChange={(checked) => {
                setNewEmailNotifications(checked);
                updateSetting("newEmailNotifications", checked);
              }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Disable notifications during specified hours
              </p>
            </div>
            <Switch
              checked={quietHours}
              onCheckedChange={(checked) => {
                setQuietHours(checked);
                updateSetting("quietHours", checked);
              }}
            />
          </div>

          {quietHours && (
            <div className="grid grid-cols-2 gap-4 pl-4">
              <div className="space-y-2">
                <Label htmlFor="quietStart">Start Time</Label>
                <Select value={quietStart} onValueChange={(value) => {
                  setQuietStart(value);
                  updateSetting("quietStart", value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quietEnd">End Time</Label>
                <Select value={quietEnd} onValueChange={(value) => {
                  setQuietEnd(value);
                  updateSetting("quietEnd", value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}