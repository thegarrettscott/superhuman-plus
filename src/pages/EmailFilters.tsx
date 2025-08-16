import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Play, ArrowLeft, ChevronDown, ChevronRight, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const setSeo = (title: string, description: string) => {
  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]') || (() => {
    const m = document.createElement('meta');
    m.setAttribute('name', 'description');
    document.head.appendChild(m);
    return m;
  })();
  metaDesc.setAttribute('content', description);
};

interface EmailFilter {
  id: string;
  name: string;
  description: string;
  conditions: any;
  actions: any;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface EmailTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

const emailTemplates = [
  {
    name: "Sales Inquiry",
    subject: "Interested in your premium package",
    from: "prospect@company.com",
    body: "Hi, I saw your website and I'm interested in learning more about your premium package. Could you send me pricing information and schedule a demo? We're looking to implement a solution for our team of 50 people."
  },
  {
    name: "Customer Support",
    subject: "Issue with login - urgent",
    from: "customer@gmail.com",
    body: "Hi support team, I'm unable to log into my account. I've tried resetting my password multiple times but the reset email isn't arriving. This is urgent as I need to access my data for a presentation tomorrow."
  },
  {
    name: "Internal Meeting",
    subject: "Weekly team standup - Tomorrow 10 AM",
    from: "manager@mycompany.com",
    body: "Team, reminder about our weekly standup tomorrow at 10 AM in conference room B. We'll review sprint progress, discuss blockers, and plan for next week. Please prepare your updates."
  },
  {
    name: "Newsletter Subscription",
    subject: "Your weekly tech digest is here!",
    from: "newsletter@techdigest.com",
    body: "This week in tech: AI breakthrough in healthcare, new programming framework released, cybersecurity trends, and startup funding news. Click here to read the full newsletter."
  },
  {
    name: "Vendor Invoice",
    subject: "Invoice #INV-2024-1234 - Payment Due",
    from: "billing@vendorcompany.com",
    body: "Dear valued customer, please find attached invoice #INV-2024-1234 for services rendered in January. Payment is due within 30 days. Contact us if you have any questions."
  },
  {
    name: "Recruitment Email",
    subject: "Exciting opportunity - Senior Developer Role",
    from: "recruiter@techstartup.com",
    body: "Hi! I came across your profile and think you'd be perfect for a Senior Developer role at our fast-growing startup. Competitive salary, equity, remote work options. Would you be interested in a quick chat?"
  },
  {
    name: "Security Alert",
    subject: "Security Alert: Unusual login detected",
    from: "security@platform.com",
    body: "We detected an unusual login to your account from a new device in San Francisco, CA. If this was you, no action needed. If not, please secure your account immediately by changing your password."
  },
  {
    name: "Event Invitation",
    subject: "You're invited: Annual Company Retreat 2024",
    from: "events@mycompany.com",
    body: "You're invited to our Annual Company Retreat from March 15-17 in Napa Valley! Three days of team building, workshops, and celebration. RSVP by February 1st. Accommodation and meals included."
  }
];

export default function EmailFilters() {
  const [filters, setFilters] = useState<EmailFilter[]>([]);
  const [tags, setTags] = useState<EmailTag[]>([]);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<EmailFilter | null>(null);
  const [editingTag, setEditingTag] = useState<EmailTag | null>(null);
  const [testEmail, setTestEmail] = useState({
    subject: "Meeting tomorrow at 3pm",
    from: "john.doe@company.com",
    to: ["me@example.com"],
    cc: [],
    body: "Hi there, just wanted to confirm our meeting tomorrow at 3pm in the conference room. Please let me know if you need to reschedule. Thanks!"
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadFilters();
    loadTags();
  }, []);

  const loadFilters = async () => {
    const { data, error } = await supabase
      .from('email_filters')
      .select('*')
      .order('priority', { ascending: false });
    
    if (error) {
      toast({ title: "Error loading filters", description: error.message, variant: "destructive" });
    } else {
      setFilters(data || []);
    }
  };

  const loadTags = async () => {
    const { data, error } = await supabase
      .from('email_tags')
      .select('*')
      .order('name');
    
    if (error) {
      toast({ title: "Error loading tags", description: error.message, variant: "destructive" });
    } else {
      setTags(data || []);
    }
  };

  const saveFilter = async (filterData: Partial<EmailFilter>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingFilter) {
        const { error } = await supabase
          .from('email_filters')
          .update(filterData)
          .eq('id', editingFilter.id);
        
        if (error) throw error;
        toast({ title: "Filter updated successfully" });
      } else {
        const { error } = await supabase
          .from('email_filters')
          .insert({ 
            name: filterData.name!,
            description: filterData.description,
            conditions: filterData.conditions,
            actions: filterData.actions,
            is_active: filterData.is_active ?? true,
            priority: filterData.priority ?? 0,
            user_id: user.id
          });
        
        if (error) throw error;
        toast({ title: "Filter created successfully" });
      }
      
      loadFilters();
      setShowFilterDialog(false);
      setEditingFilter(null);
    } catch (error: any) {
      toast({ title: "Error saving filter", description: error.message, variant: "destructive" });
    }
  };

  const saveTag = async (tagData: Partial<EmailTag>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingTag) {
        const { error } = await supabase
          .from('email_tags')
          .update(tagData)
          .eq('id', editingTag.id);
        
        if (error) throw error;
        toast({ title: "Tag updated successfully" });
      } else {
        const { error } = await supabase
          .from('email_tags')
          .insert({
            name: tagData.name!,
            color: tagData.color,
            user_id: user.id
          });
        
        if (error) throw error;
        toast({ title: "Tag created successfully" });
      }
      
      loadTags();
      setShowTagDialog(false);
      setEditingTag(null);
    } catch (error: any) {
      toast({ title: "Error saving tag", description: error.message, variant: "destructive" });
    }
  };

  const deleteFilter = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_filters')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Filter deleted successfully" });
      loadFilters();
    } catch (error: any) {
      toast({ title: "Error deleting filter", description: error.message, variant: "destructive" });
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_tags')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Tag deleted successfully" });
      loadTags();
    } catch (error: any) {
      toast({ title: "Error deleting tag", description: error.message, variant: "destructive" });
    }
  };

  const testFilters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-filter', {
        body: {
          action: 'test-filters',
          emailData: testEmail,
          filters: filters.filter(f => f.is_active)
        }
      });

      if (error) throw error;

      setTestResult(data);
      setSystemPrompt(data.systemPrompt);
      toast({ title: "Test completed successfully" });
    } catch (error: any) {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
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
          <h1 className="text-xl font-semibold">Email Filters - Test Page</h1>
        </div>
      </header>

      <main className="container py-6">
        <Tabs defaultValue="filters" className="space-y-6">
          <TabsList>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="test">Test Filtering</TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Email Filters</h2>
              <Button onClick={() => {
                setEditingFilter(null);
                setShowFilterDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </div>

            <div className="grid gap-4">
              {filters.map((filter) => (
                <Card key={filter.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {filter.name}
                          {filter.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{filter.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingFilter(filter);
                            setShowFilterDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFilter(filter.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">Conditions:</Label>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(filter.conditions, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Actions:</Label>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(filter.actions, null, 2)}
                        </pre>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Priority: {filter.priority}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tags" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Email Tags</h2>
              <Button onClick={() => {
                setEditingTag(null);
                setShowTagDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>

            <div className="grid gap-4">
              {tags.map((tag) => (
                <Card key={tag.id}>
                  <CardContent className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-3">
                      <Badge 
                        style={{ backgroundColor: tag.color || '#6b7280' }}
                        className="text-white"
                      >
                        {tag.name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Created {new Date(tag.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTag(tag);
                          setShowTagDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTag(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Email</CardTitle>
                <CardDescription>
                  Modify this sample email to test your filters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Email Templates</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Mail className="h-4 w-4 mr-2" />
                        Load Template
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 bg-background border shadow-lg z-50">
                      {emailTemplates.map((template) => (
                        <DropdownMenuItem
                          key={template.name}
                          onClick={() => setTestEmail({
                            subject: template.subject,
                            from: template.from,
                            to: ["me@example.com"],
                            cc: [],
                            body: template.body
                          })}
                          className="cursor-pointer hover:bg-muted"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{template.name}</span>
                            <span className="text-xs text-muted-foreground">{template.subject}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={testEmail.subject}
                      onChange={(e) => setTestEmail(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>From</Label>
                    <Input
                      value={testEmail.from}
                      onChange={(e) => setTestEmail(prev => ({ ...prev, from: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea
                    value={testEmail.body}
                    onChange={(e) => setTestEmail(prev => ({ ...prev, body: e.target.value }))}
                    rows={4}
                  />
                </div>
                <Button onClick={testFilters} disabled={loading} className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  {loading ? "Testing..." : "Test Filters"}
                </Button>
              </CardContent>
            </Card>

            {systemPrompt && (
              <Card>
                <CardHeader>
                  <CardTitle>System Prompt</CardTitle>
                  <CardDescription>
                    This is the prompt sent to OpenAI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={systemPrompt}
                    readOnly
                    rows={10}
                    className="font-mono text-xs"
                  />
                </CardContent>
              </Card>
            )}

            {testResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Test Result</CardTitle>
                  <CardDescription>
                    AI analysis result
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-4 rounded overflow-auto">
                    {testResult.aiResponse}
                  </pre>
                  {testResult.usage && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      Tokens used: {testResult.usage.total_tokens} 
                      (prompt: {testResult.usage.prompt_tokens}, completion: {testResult.usage.completion_tokens})
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Filter Dialog */}
      <FilterDialog
        open={showFilterDialog}
        onOpenChange={setShowFilterDialog}
        filter={editingFilter}
        onSave={saveFilter}
      />

      {/* Tag Dialog */}
      <TagDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        tag={editingTag}
        onSave={saveTag}
      />
    </div>
  );
}

function FilterDialog({
  open, 
  onOpenChange, 
  filter, 
  onSave 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: EmailFilter | null;
  onSave: (data: Partial<EmailFilter>) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    conditions: "{}",
    actions: "{}",
    is_active: true,
    priority: 0
  });
  const [prompt, setPrompt] = useState("");
  const [generatingFilter, setGeneratingFilter] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (filter) {
      setFormData({
        name: filter.name,
        description: filter.description || "",
        conditions: JSON.stringify(filter.conditions, null, 2),
        actions: JSON.stringify(filter.actions, null, 2),
        is_active: filter.is_active,
        priority: filter.priority
      });
      setPrompt("");
    } else {
      setFormData({
        name: "",
        description: "",
        conditions: "{}",
        actions: "{}",
        is_active: true,
        priority: 0
      });
      setPrompt("");
    }
  }, [filter, open]);

  const generateFilter = async () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a prompt", variant: "destructive" });
      return;
    }

    setGeneratingFilter(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-filter', {
        body: {
          action: 'generate-filter',
          prompt: prompt
        }
      });

      if (error) throw error;

      const generated = data.generatedFilter;
      setFormData({
        name: generated.name || formData.name,
        description: generated.description || formData.description,
        conditions: JSON.stringify(generated.conditions || {}, null, 2),
        actions: JSON.stringify(generated.actions || {}, null, 2),
        is_active: formData.is_active,
        priority: formData.priority
      });

      toast({ title: "Filter generated successfully! You can now edit it." });
    } catch (error: any) {
      toast({ title: "Error generating filter", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingFilter(false);
    }
  };

  const handleSave = () => {
    try {
      const data = {
        name: formData.name,
        description: formData.description,
        conditions: JSON.parse(formData.conditions),
        actions: JSON.parse(formData.actions),
        is_active: formData.is_active,
        priority: formData.priority
      };
      onSave(data);
    } catch (error) {
      toast({ title: "Invalid JSON in filter data", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{filter ? "Edit Filter" : "Create Filter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!filter && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
              <Label>AI Filter Generation</Label>
              <p className="text-sm text-muted-foreground">
                Describe what kind of emails you want to filter and how to handle them. 
                Example: "Tag emails from my manager as important and mark as read"
              </p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your filter requirements..."
                rows={3}
              />
              <Button 
                onClick={generateFilter} 
                disabled={generatingFilter}
                className="w-full"
              >
                {generatingFilter ? "Generating..." : "Generate Filter with AI"}
              </Button>
            </div>
          )}
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Work Email Filter"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What this filter does"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full justify-between p-0 font-normal hover:bg-transparent"
              >
                <Label className="cursor-pointer">Conditions (JSON)</Label>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              <Textarea
                value={formData.conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
                rows={6}
                className="font-mono text-xs"
                placeholder='{"sender_domain": "company.com", "keywords": ["urgent"], "subject_contains": "meeting"}'
              />
            </CollapsibleContent>
          </Collapsible>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full justify-between p-0 font-normal hover:bg-transparent"
              >
                <Label className="cursor-pointer">Actions (JSON)</Label>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              <Textarea
                value={formData.actions}
                onChange={(e) => setFormData(prev => ({ ...prev, actions: e.target.value }))}
                rows={4}
                className="font-mono text-xs"
                placeholder='{"add_tags": ["work"], "add_labels": ["CATEGORY_PERSONAL"]}'
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {filter ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagDialog({
  open,
  onOpenChange,
  tag,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: EmailTag | null;
  onSave: (data: Partial<EmailTag>) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    color: "#6b7280"
  });

  useEffect(() => {
    if (tag) {
      setFormData({
        name: tag.name,
        color: tag.color || "#6b7280"
      });
    } else {
      setFormData({
        name: "",
        color: "#6b7280"
      });
    }
  }, [tag, open]);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? "Edit Tag" : "Create Tag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., urgent, work, personal"
            />
          </div>
          <div>
            <Label>Color</Label>
            <Input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {tag ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
