import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type Email = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
};

interface CreateFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateEmail: Email | null;
}

export function CreateFilterDialog({ open, onOpenChange, templateEmail }: CreateFilterDialogProps) {
  const [filterName, setFilterName] = useState("");
  const [description, setDescription] = useState("");
  const [fromCondition, setFromCondition] = useState("");
  const [subjectCondition, setSubjectCondition] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [generatingFilter, setGeneratingFilter] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");

  // Reset form when dialog opens/closes or template changes
  useEffect(() => {
    if (open && templateEmail) {
      setFilterName("");
      setFromCondition("");
      setSubjectCondition("");
      setTags([]);
      setDescription("");
      setAiAnalysis("");
      
      // Generate intelligent AI prompt based on email analysis
      const intelligentPrompt = generateIntelligentPrompt(templateEmail);
      
      // Auto-generate filter with AI immediately
      generateFilterWithPrompt(intelligentPrompt);
    } else if (!open) {
      // Reset form when dialog closes
      setFilterName("");
      setDescription("");
      setFromCondition("");
      setSubjectCondition("");
      setTags([]);
      setNewTag("");
      setAiAnalysis("");
    }
  }, [open, templateEmail]);

  const generateIntelligentPrompt = (email: Email): string => {
    const fromDomain = email.from.split('@')[1] || '';
    const subject = email.subject.toLowerCase();
    const snippet = email.snippet.toLowerCase();
    
    // Detect email patterns for intelligent filtering
    if (snippet.includes('unsubscribe') || snippet.includes('newsletter') || 
        snippet.includes('marketing') || subject.includes('newsletter')) {
      return `This appears to be a newsletter or marketing email from ${fromDomain}. Create a filter that catches all newsletters and marketing emails from this domain, not just this specific sender. Tag them as "newsletter" or "marketing" and consider moving them to a promotions category.`;
    }
    
    if (snippet.includes('order') || snippet.includes('receipt') || 
        snippet.includes('purchase') || snippet.includes('invoice')) {
      return `This appears to be a transactional/order email from ${fromDomain}. Create a filter for order confirmations, receipts, and transactional emails from this company. Tag them as "orders" or "receipts" and mark as important.`;
    }
    
    if (fromDomain.includes('linkedin') || fromDomain.includes('twitter') || 
        fromDomain.includes('facebook') || fromDomain.includes('instagram')) {
      return `This is a social media notification from ${fromDomain}. Create a filter for social media notifications from this platform. Tag them as "social" and consider moving to social category.`;
    }
    
    if (snippet.includes('support') || snippet.includes('ticket') || 
        snippet.includes('help') || subject.includes('support')) {
      return `This appears to be a support or service email from ${fromDomain}. Create a filter for customer support and service emails from this company. Tag them as "support" and mark as important.`;
    }
    
    if (snippet.includes('security') || snippet.includes('login') || 
        snippet.includes('password') || snippet.includes('verification')) {
      return `This appears to be a security or verification email from ${fromDomain}. Create a filter for security notifications from this service. Tag them as "security" and mark as very important.`;
    }
    
    // Default intelligent prompt
    return `Analyze this email from ${fromDomain} and create an intelligent filter. Instead of filtering just this specific sender, identify the category or type of email this represents and create a broader filter that would catch similar emails. Consider the sender domain, email content patterns, and purpose.`;
  };

  const generateFilterWithPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;

    setGeneratingFilter(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-filter', {
        body: {
          action: 'generate-filter',
          prompt: prompt
        }
      });

      if (error) throw error;

      // Fix response handling - use generatedFilter instead of filter
      if (data?.generatedFilter) {
        const filter = data.generatedFilter;
        setFilterName(filter.name || "");
        setDescription(filter.description || "");
        
        // Handle new condition structure
        const conditions = filter.conditions || {};
        setFromCondition(conditions.sender_email || conditions.sender_domain || "");
        setSubjectCondition(conditions.subject_contains || "");
        
        // Handle new actions structure
        const actions = filter.actions || {};
        setTags(actions.add_tags || []);
        
        // Store the AI's reasoning for display
        setAiAnalysis(filter.description || "AI has analyzed this email and created an appropriate filter.");

        toast({
          title: "Filter analyzed",
          description: "Review the generated filter and make any adjustments needed."
        });
      }
    } catch (error: any) {
      console.error('Filter generation error:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate filter"
      });
    } finally {
      setGeneratingFilter(false);
    }
  };

  const generateFilter = async () => {
    // This function is no longer needed as we auto-generate
    // Keeping for potential future use
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const saveFilter = async () => {
    if (!filterName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the filter."
      });
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "You must be logged in to create filters."
        });
        return;
      }

      const { error } = await supabase
        .from('email_filters')
        .insert({
          user_id: user.id,
          name: filterName,
          description: description || null,
          conditions: {
            sender_email: fromCondition?.includes('@') ? fromCondition : null,
            sender_domain: fromCondition && !fromCondition.includes('@') ? fromCondition : null,
            subject_contains: subjectCondition || null
          },
          actions: {
            add_tags: tags.length > 0 ? tags : null,
            mark_as_read: true
          },
          is_active: true,
          priority: 1
        });

      if (error) throw error;

      toast({
        title: "Filter created",
        description: `Filter "${filterName}" has been created successfully.`
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Save filter error:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save filter"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Filter from Email</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Template Email Display */}
          {templateEmail && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">{templateEmail.subject}</p>
              <p className="text-xs text-muted-foreground">From: {templateEmail.from}</p>
            </div>
          )}

          {/* AI Analysis Display */}
          {aiAnalysis && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/10">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm font-medium text-foreground">AI Filter Analysis</p>
                  <p className="text-sm text-muted-foreground mt-1">{aiAnalysis}</p>
                </div>
              </div>
            </div>
          )}

          {generatingFilter && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/10">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-muted-foreground">Analyzing email and generating filter...</p>
              </div>
            </div>
          )}

          {/* Manual Filter Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filterName">Filter Name</Label>
              <Input
                id="filterName"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Enter filter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this filter does"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromCondition">From Email/Domain (optional)</Label>
              <Input
                id="fromCondition"
                value={fromCondition}
                onChange={(e) => setFromCondition(e.target.value)}
                placeholder="sender@example.com or domain.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjectCondition">Subject Contains (optional)</Label>
              <Input
                id="subjectCondition"
                value={subjectCondition}
                onChange={(e) => setSubjectCondition(e.target.value)}
                placeholder="Keywords in subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Tags to Apply</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button type="button" onClick={addTag}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={saveFilter} disabled={!filterName.trim()}>
              Create Filter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}