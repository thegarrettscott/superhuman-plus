import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Tag, Plus, Edit, Trash2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CreateFilterDialog } from "@/components/CreateFilterDialog";

interface FilterSettingsProps {
  user: any;
}

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

export default function FilterSettings({ user }: FilterSettingsProps) {
  const [filters, setFilters] = useState<EmailFilter[]>([]);
  const [tags, setTags] = useState<EmailTag[]>([]);
  const [showCreateFilter, setShowCreateFilter] = useState(false);
  const [editingFilter, setEditingFilter] = useState<EmailFilter | null>(null);
  const [loading, setLoading] = useState(false);

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

  const toggleFilterStatus = async (filter: EmailFilter) => {
    try {
      const { error } = await supabase
        .from('email_filters')
        .update({ is_active: !filter.is_active })
        .eq('id', filter.id);
      
      if (error) throw error;
      toast({ 
        title: `Filter ${!filter.is_active ? 'enabled' : 'disabled'}`,
        description: `${filter.name} is now ${!filter.is_active ? 'active' : 'inactive'}`
      });
      loadFilters();
    } catch (error: any) {
      toast({ title: "Error updating filter", description: error.message, variant: "destructive" });
    }
  };

  const processFilters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-filters', {
        body: { action: 'process-all' }
      });

      if (error) throw error;

      toast({
        title: "Filter processing started",
        description: "Your emails are being processed with the active filters"
      });
    } catch (error: any) {
      toast({
        title: "Error processing filters",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Filters & Rules</h2>
          <p className="text-muted-foreground">
            Manage email filtering rules, tags, and automation
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={processFilters} disabled={loading} variant="outline">
            <Play className="h-4 w-4 mr-2" />
            {loading ? "Processing..." : "Run All Filters"}
          </Button>
          <Button onClick={() => setShowCreateFilter(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Filter
          </Button>
        </div>
      </div>

      <Tabs defaultValue="filters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="filters">Email Filters</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="filters" className="space-y-4">
          {filters.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Filters Created</h3>
                <p className="text-muted-foreground mb-4">
                  Create email filters to automatically organize and tag your messages
                </p>
                <Button onClick={() => setShowCreateFilter(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Filter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filters.map((filter) => (
                <Card key={filter.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {filter.name}
                          <Badge variant={filter.is_active ? "default" : "secondary"}>
                            {filter.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{filter.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFilterStatus(filter)}
                        >
                          {filter.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingFilter(filter);
                            setShowCreateFilter(true);
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
                      <div className="text-sm">
                        <span className="font-medium">Priority:</span> {filter.priority}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Created:</span>{" "}
                        {new Date(filter.created_at).toLocaleDateString()}
                      </div>
                      {filter.actions?.add_tags && (
                        <div className="flex flex-wrap gap-1">
                          {filter.actions.add_tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          {tags.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Tags Created</h3>
                <p className="text-muted-foreground mb-4">
                  Create tags to categorize and organize your emails
                </p>
                <Button disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tag (Coming Soon)
                </Button>
              </CardContent>
            </Card>
          ) : (
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
                      <Button variant="ghost" size="sm" disabled>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" disabled>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showCreateFilter && (
        <CreateFilterDialog
          open={showCreateFilter}
          onOpenChange={(open) => {
            setShowCreateFilter(open);
            if (!open) {
              setEditingFilter(null);
              loadFilters();
            }
          }}
          templateEmail={null}
        />
      )}
    </div>
  );
}