import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Monitor, Moon, Sun, Palette, Type, Layout } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "@/hooks/use-toast";

export default function InterfaceSettings() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState("comfortable");
  const [fontSize, setFontSize] = useState("medium");
  const [animations, setAnimations] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    // Load settings from localStorage
    const savedDensity = localStorage.getItem("email-density") || "comfortable";
    const savedFontSize = localStorage.getItem("email-fontSize") || "medium";
    const savedAnimations = localStorage.getItem("email-animations") !== "false";
    const savedCompactMode = localStorage.getItem("email-compactMode") === "true";
    const savedShowPreview = localStorage.getItem("email-showPreview") !== "false";

    setDensity(savedDensity);
    setFontSize(savedFontSize);
    setAnimations(savedAnimations);
    setCompactMode(savedCompactMode);
    setShowPreview(savedShowPreview);
  }, []);

  const updateSetting = (key: string, value: any) => {
    localStorage.setItem(`email-${key}`, value.toString());
    toast({
      title: "Setting updated",
      description: "Your interface preference has been saved"
    });
  };

  const handleDensityChange = (value: string) => {
    setDensity(value);
    updateSetting("density", value);
    
    // Apply density class to body
    document.body.classList.remove("density-compact", "density-comfortable", "density-spacious");
    document.body.classList.add(`density-${value}`);
  };

  const handleFontSizeChange = (value: string) => {
    setFontSize(value);
    updateSetting("fontSize", value);
    
    // Apply font size class to body
    document.body.classList.remove("text-small", "text-medium", "text-large");
    document.body.classList.add(`text-${value}`);
  };

  const handleAnimationsChange = (checked: boolean) => {
    setAnimations(checked);
    updateSetting("animations", checked);
    
    // Apply animations preference
    if (checked) {
      document.body.classList.remove("reduce-motion");
    } else {
      document.body.classList.add("reduce-motion");
    }
  };

  const handleCompactModeChange = (checked: boolean) => {
    setCompactMode(checked);
    updateSetting("compactMode", checked);
  };

  const handleShowPreviewChange = (checked: boolean) => {
    setShowPreview(checked);
    updateSetting("showPreview", checked);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Interface & Display</h2>
        <p className="text-muted-foreground">
          Customize the appearance and behavior of your email interface
        </p>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose your preferred color theme and visual style
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className="h-20 flex-col gap-2"
              >
                <Sun className="h-5 w-5" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className="h-20 flex-col gap-2"
              >
                <Moon className="h-5 w-5" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
                className="h-20 flex-col gap-2"
              >
                <Monitor className="h-5 w-5" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Layout & Density
          </CardTitle>
          <CardDescription>
            Configure how content is displayed and spaced
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="density">Display Density</Label>
            <Select value={density} onValueChange={handleDensityChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact - More emails per screen</SelectItem>
                <SelectItem value="comfortable">Comfortable - Balanced spacing</SelectItem>
                <SelectItem value="spacious">Spacious - Extra breathing room</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Compact Sidebar</Label>
              <p className="text-sm text-muted-foreground">
                Show only icons in the navigation sidebar
              </p>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={handleCompactModeChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Preview</Label>
              <p className="text-sm text-muted-foreground">
                Show email content preview in the message list
              </p>
            </div>
            <Switch
              checked={showPreview}
              onCheckedChange={handleShowPreviewChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Typography Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </CardTitle>
          <CardDescription>
            Adjust text size and readability options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fontSize">Font Size</Label>
            <Select value={fontSize} onValueChange={handleFontSizeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small - Compact text</SelectItem>
                <SelectItem value="medium">Medium - Standard size</SelectItem>
                <SelectItem value="large">Large - Enhanced readability</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Smooth Animations</Label>
              <p className="text-sm text-muted-foreground">
                Enable transitions and motion effects
              </p>
            </div>
            <Switch
              checked={animations}
              onCheckedChange={handleAnimationsChange}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}