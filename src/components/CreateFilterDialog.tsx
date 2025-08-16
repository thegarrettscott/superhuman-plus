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
  const [aiPrompt, setAiPrompt] = useState("");

  // Reset form when dialog opens/closes or template changes
  useEffect(() => {
    if (open && templateEmail) {
      setFilterName(`Filter for ${templateEmail.from.split('@')[0] || 'emails'}`);
      setFromCondition(templateEmail.from);
      setSubjectCondition("");
      setTags([]);
      setDescription("");
      
      // Generate AI prompt based on template email
      const fromDomain = templateEmail.from.split('@')[1] || '';
      setAiPrompt(`Create a filter for emails from "${templateEmail.from}" with subject containing "${templateEmail.subject}". Tag these emails as "from-${fromDomain}" and mark as read.`);
    } else if (!open) {
      // Reset form when dialog closes
      setFilterName("");
      setDescription("");
      setFromCondition("");
      setSubjectCondition("");
      setTags([]);
      setNewTag("");
      setAiPrompt("");
    }
  }, [open, templateEmail]);

  const generateFilter = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a description of the filter you want to create."
      });
      return;
    }

    setGeneratingFilter(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-filter', {
        body: {
          action: 'generate-filter',
          prompt: aiPrompt
        }
      });

      if (error) throw error;

      if (data?.filter) {
        const filter = data.filter;
        setFilterName(filter.name || filterName);
        setDescription(filter.description || description);
        setFromCondition(filter.conditions?.from || fromCondition);
        setSubjectCondition(filter.conditions?.subject || subjectCondition);
        setTags(filter.actions?.tags || tags);

        toast({
          title: "Filter generated",
          description: "Review and adjust the filter settings below, then save."
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
            from: fromCondition || null,
            subject: subjectCondition || null
          },
          actions: {
            tags: tags.length > 0 ? tags : null,
            markAsRead: true
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

          {/* AI Generation Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <Label>AI Filter Generation</Label>
            <p className="text-sm text-muted-foreground">
              Describe how you want to filter emails like this one.
            </p>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
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
              <Label htmlFor="fromCondition">From Email (optional)</Label>
              <Input
                id="fromCondition"
                value={fromCondition}
                onChange={(e) => setFromCondition(e.target.value)}
                placeholder="sender@example.com"
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