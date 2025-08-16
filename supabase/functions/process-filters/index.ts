import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    console.log('Processing filters for user:', user.id);

    // Get the most recent 100 emails for this user
    const { data: emails, error: emailsError } = await supabase
      .from('email_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('internal_date', { ascending: false })
      .limit(100);

    if (emailsError) {
      throw emailsError;
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No emails found to process',
        processedCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${emails.length} emails to process`);

    // Get active filters for this user
    const { data: filters, error: filtersError } = await supabase
      .from('email_filters')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (filtersError) {
      throw filtersError;
    }

    if (!filters || filters.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active filters found',
        processedCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${filters.length} active filters`);

    let processedCount = 0;
    let tagsApplied = 0;

    // Process each email through the filters
    for (const email of emails) {
      let emailProcessed = false;

      for (const filter of filters) {
        const conditions = filter.conditions as any;
        const actions = filter.actions as any;

        // Check if email matches filter conditions
        let matches = true;

        // Check sender email condition
        if (conditions.sender_email && email.from_address) {
          if (!email.from_address.toLowerCase().includes(conditions.sender_email.toLowerCase())) {
            matches = false;
          }
        }

        // Check sender domain condition
        if (conditions.sender_domain && email.from_address) {
          const domain = email.from_address.split('@')[1];
          if (!domain || !domain.toLowerCase().includes(conditions.sender_domain.toLowerCase())) {
            matches = false;
          }
        }

        // Check subject contains condition
        if (conditions.subject_contains && email.subject) {
          if (!email.subject.toLowerCase().includes(conditions.subject_contains.toLowerCase())) {
            matches = false;
          }
        }

        // If email matches filter, apply actions
        if (matches && actions.add_tags && Array.isArray(actions.add_tags)) {
          console.log(`Email ${email.id} matches filter ${filter.name}`);
          emailProcessed = true;

          // Apply tags
          for (const tagName of actions.add_tags) {
            // Find or create the tag
            let { data: tag, error: tagSelectError } = await supabase
              .from('email_tags')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', tagName)
              .single();

            if (tagSelectError && tagSelectError.code === 'PGRST116') {
              // Tag doesn't exist, create it
              const { data: newTag, error: tagCreateError } = await supabase
                .from('email_tags')
                .insert({
                  user_id: user.id,
                  name: tagName,
                  color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
                })
                .select('id')
                .single();

              if (tagCreateError) {
                console.error('Error creating tag:', tagCreateError);
                continue;
              }
              tag = newTag;
            } else if (tagSelectError) {
              console.error('Error finding tag:', tagSelectError);
              continue;
            }

            if (tag) {
              // Check if tag is already applied to this email
              const { data: existingTag } = await supabase
                .from('email_message_tags')
                .select('id')
                .eq('user_id', user.id)
                .eq('message_id', email.id)
                .eq('tag_id', tag.id)
                .single();

              if (!existingTag) {
                // Apply the tag to the email
                const { error: tagApplyError } = await supabase
                  .from('email_message_tags')
                  .insert({
                    user_id: user.id,
                    message_id: email.id,
                    tag_id: tag.id
                  });

                if (tagApplyError) {
                  console.error('Error applying tag:', tagApplyError);
                } else {
                  tagsApplied++;
                  console.log(`Applied tag "${tagName}" to email ${email.id}`);
                }
              }
            }
          }
        }
      }

      if (emailProcessed) {
        processedCount++;
      }
    }

    console.log(`Processing complete: ${processedCount} emails processed, ${tagsApplied} tags applied`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processedCount} emails with filters`,
      processedCount,
      tagsApplied,
      totalEmails: emails.length,
      totalFilters: filters.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error processing filters:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to process filters'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});