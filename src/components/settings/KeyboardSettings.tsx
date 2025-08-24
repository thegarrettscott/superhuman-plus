import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Keyboard, Edit, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface KeyboardShortcut {
  id: string;
  action: string;
  description: string;
  defaultKey: string;
  currentKey: string;
  category: string;
}

const defaultShortcuts: KeyboardShortcut[] = [
  // Navigation
  { id: "nav-inbox", action: "Go to Inbox", description: "Navigate to inbox", defaultKey: "g i", currentKey: "g i", category: "Navigation" },
  { id: "nav-starred", action: "Go to Starred", description: "Navigate to starred emails", defaultKey: "g s", currentKey: "g s", category: "Navigation" },
  { id: "nav-sent", action: "Go to Sent", description: "Navigate to sent emails", defaultKey: "g t", currentKey: "g t", category: "Navigation" },
  { id: "nav-drafts", action: "Go to Drafts", description: "Navigate to drafts", defaultKey: "g d", currentKey: "g d", category: "Navigation" },
  
  // Email Actions
  { id: "email-archive", action: "Archive", description: "Archive selected email", defaultKey: "e", currentKey: "e", category: "Email Actions" },
  { id: "email-star", action: "Star/Unstar", description: "Toggle star on email", defaultKey: "s", currentKey: "s", category: "Email Actions" },
  { id: "email-reply", action: "Reply", description: "Reply to email", defaultKey: "r", currentKey: "r", category: "Email Actions" },
  { id: "email-forward", action: "Forward", description: "Forward email", defaultKey: "f", currentKey: "f", category: "Email Actions" },
  { id: "email-delete", action: "Delete", description: "Delete email", defaultKey: "#", currentKey: "#", category: "Email Actions" },
  
  // Compose
  { id: "compose-new", action: "Compose", description: "Start new email", defaultKey: "c", currentKey: "c", category: "Compose" },
  { id: "compose-send", action: "Send", description: "Send current draft", defaultKey: "ctrl+enter", currentKey: "ctrl+enter", category: "Compose" },
  
  // Selection
  { id: "select-all", action: "Select All", description: "Select all emails", defaultKey: "* a", currentKey: "* a", category: "Selection" },
  { id: "select-none", action: "Select None", description: "Deselect all emails", defaultKey: "* n", currentKey: "* n", category: "Selection" },
  { id: "select-read", action: "Select Read", description: "Select all read emails", defaultKey: "* r", currentKey: "* r", category: "Selection" },
  { id: "select-unread", action: "Select Unread", description: "Select all unread emails", defaultKey: "* u", currentKey: "* u", category: "Selection" },
  
  // Application
  { id: "app-search", action: "Search", description: "Open search", defaultKey: "/", currentKey: "/", category: "Application" },
  { id: "app-command", action: "Command Palette", description: "Open command palette", defaultKey: "ctrl+k", currentKey: "ctrl+k", category: "Application" },
  { id: "app-settings", action: "Settings", description: "Open settings", defaultKey: "g ,", currentKey: "g ,", category: "Application" }
];

export default function KeyboardSettings() {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(defaultShortcuts);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [newKeyBinding, setNewKeyBinding] = useState("");
  const [recordingKeys, setRecordingKeys] = useState(false);

  useEffect(() => {
    // Load custom shortcuts from localStorage
    const savedShortcuts = localStorage.getItem("email-keyboard-shortcuts");
    if (savedShortcuts) {
      try {
        const parsed = JSON.parse(savedShortcuts);
        setShortcuts(parsed);
      } catch (error) {
        console.error("Failed to load keyboard shortcuts:", error);
      }
    }
  }, []);

  const saveShortcuts = (updatedShortcuts: KeyboardShortcut[]) => {
    setShortcuts(updatedShortcuts);
    localStorage.setItem("email-keyboard-shortcuts", JSON.stringify(updatedShortcuts));
    toast({
      title: "Shortcuts updated",
      description: "Your keyboard shortcuts have been saved"
    });
  };

  const handleEditShortcut = (shortcutId: string) => {
    const shortcut = shortcuts.find(s => s.id === shortcutId);
    if (shortcut) {
      setEditingShortcut(shortcutId);
      setNewKeyBinding(shortcut.currentKey);
    }
  };

  const handleSaveShortcut = () => {
    if (!editingShortcut || !newKeyBinding) return;

    const updatedShortcuts = shortcuts.map(shortcut => 
      shortcut.id === editingShortcut 
        ? { ...shortcut, currentKey: newKeyBinding }
        : shortcut
    );

    saveShortcuts(updatedShortcuts);
    setEditingShortcut(null);
    setNewKeyBinding("");
  };

  const handleResetShortcut = (shortcutId: string) => {
    const updatedShortcuts = shortcuts.map(shortcut => 
      shortcut.id === shortcutId 
        ? { ...shortcut, currentKey: shortcut.defaultKey }
        : shortcut
    );

    saveShortcuts(updatedShortcuts);
  };

  const handleResetAllShortcuts = () => {
    const resetShortcuts = shortcuts.map(shortcut => ({
      ...shortcut,
      currentKey: shortcut.defaultKey
    }));

    saveShortcuts(resetShortcuts);
    toast({
      title: "All shortcuts reset",
      description: "All keyboard shortcuts have been reset to defaults"
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recordingKeys) return;

    e.preventDefault();
    const keys = [];
    
    if (e.ctrlKey) keys.push('ctrl');
    if (e.shiftKey) keys.push('shift');
    if (e.altKey) keys.push('alt');
    if (e.metaKey) keys.push('meta');
    
    const key = e.key.toLowerCase();
    if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
      keys.push(key);
    }
    
    setNewKeyBinding(keys.join('+'));
  };

  const startRecording = () => {
    setRecordingKeys(true);
    setNewKeyBinding("");
  };

  const stopRecording = () => {
    setRecordingKeys(false);
  };

  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keyboard & Shortcuts</h2>
          <p className="text-muted-foreground">
            Customize keyboard shortcuts to navigate and manage emails efficiently
          </p>
        </div>
        <Button variant="outline" onClick={handleResetAllShortcuts}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset All
        </Button>
      </div>

      {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              {category}
            </CardTitle>
            <CardDescription>
              Keyboard shortcuts for {category.toLowerCase()} actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryShortcuts.map((shortcut) => (
                <div key={shortcut.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{shortcut.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {shortcut.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingShortcut === shortcut.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={newKeyBinding}
                                onChange={(e) => setNewKeyBinding(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={startRecording}
                                onBlur={stopRecording}
                                placeholder="Press keys..."
                                className="w-32 text-center"
                              />
                              <Button size="sm" onClick={handleSaveShortcut}>
                                Save
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEditingShortcut(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Badge variant="outline" className="font-mono">
                                {shortcut.currentKey}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditShortcut(shortcut.id)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {shortcut.currentKey !== shortcut.defaultKey && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleResetShortcut(shortcut.id)}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {shortcut !== categoryShortcuts[categoryShortcuts.length - 1] && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}