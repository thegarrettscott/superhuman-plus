import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { setSeo } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Import settings sections
import AccountSettings from "@/components/settings/AccountSettings";
import EmailManagementSettings from "@/components/settings/EmailManagementSettings";
import FilterSettings from "@/components/settings/FilterSettings";
import InterfaceSettings from "@/components/settings/InterfaceSettings";
import NotificationSettings from "@/components/settings/NotificationSettings";
import KeyboardSettings from "@/components/settings/KeyboardSettings";
import PrivacySettings from "@/components/settings/PrivacySettings";
import AdvancedSettings from "@/components/settings/AdvancedSettings";

type SettingsSection = {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
};

const settingsSections: SettingsSection[] = [
  {
    id: "account",
    title: "Account & Profile",
    description: "Manage your account, profile information, and authentication"
  },
  {
    id: "email",
    title: "Email Management",
    description: "Connected accounts, signatures, and auto-filtering settings"
  },
  {
    id: "filters",
    title: "Filters & Rules",
    description: "Email filtering rules, tags, and automation"
  },
  {
    id: "interface",
    title: "Interface & Display",
    description: "Theme, layout, typography, and visual preferences"
  },
  {
    id: "notifications",
    title: "Notifications & Alerts",
    description: "Sound, desktop notifications, and alert preferences"
  },
  {
    id: "keyboard",
    title: "Keyboard & Shortcuts",
    description: "Customize keyboard shortcuts and hotkeys"
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    description: "Data privacy, security settings, and permissions"
  },
  {
    id: "advanced",
    title: "Advanced Settings",
    description: "Performance, sync, import/export, and developer options"
  }
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState("account");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setSeo("Settings - Velocity Mail", "Configure your email client settings, filters, and preferences");
    
    // Load current user and account
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      
      setCurrentUser(user);
      
      // Load user's email account
      const { data: accountData } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (accountData) {
        setCurrentAccount(accountData);
      }
    };
    
    loadUserData();
  }, [navigate]);

  // Filter sections based on search
  const filteredSections = settingsSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderSettingsContent = () => {
    if (!currentUser) return null;
    
    switch (activeSection) {
      case "account":
        return <AccountSettings user={currentUser} />;
      case "email":
        return <EmailManagementSettings user={currentUser} account={currentAccount} />;
      case "filters":
        return <FilterSettings user={currentUser} />;
      case "interface":
        return <InterfaceSettings />;
      case "notifications":
        return <NotificationSettings user={currentUser} />;
      case "keyboard":
        return <KeyboardSettings />;
      case "privacy":
        return <PrivacySettings user={currentUser} />;
      case "advanced":
        return <AdvancedSettings user={currentUser} account={currentAccount} />;
      default:
        return <AccountSettings user={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center gap-3 py-3">
          <Button variant="ghost" onClick={() => navigate('/mail')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Mail
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <div className="container py-6">
        <div className="flex gap-6">
          {/* Settings Navigation Sidebar */}
          <aside className="w-80 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Settings Categories */}
            <div className="space-y-2">
              {filteredSections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => setActiveSection(section.id)}
                >
                  <div>
                    <div className="font-medium">{section.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {section.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </aside>

          <Separator orientation="vertical" className="h-[80vh]" />

          {/* Settings Content */}
          <main className="flex-1 space-y-6">
            {renderSettingsContent()}
          </main>
        </div>
      </div>
    </div>
  );
}