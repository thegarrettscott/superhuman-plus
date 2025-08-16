import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function processEmailWithFilters(emailData: any, userId: string) {
  console.log('Processing email with filters for user:', userId);
  
  // Get active filters for the user
  const { data: filters, error: filtersError } = await admin
    .from('email_filters')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (filtersError) {
    console.error('Error fetching filters:', filtersError);
    return;
  }

  if (!filters || filters.length === 0) {
    console.log('No active filters found for user');
    return;
  }

  // Get existing tags for the user
  const { data: existingTags } = await admin
    .from('email_tags')
    .select('*')
    .eq('user_id', userId);

  const tagsMap = new Map(existingTags?.map(tag => [tag.name.toLowerCase(), tag]) || []);

  // Build system prompt with filters
  const systemPrompt = buildSystemPrompt(filters, Array.from(tagsMap.keys()));

  // Prepare email content for analysis
  const emailContent = {
    subject: emailData.subject || '',
    from: emailData.from_address || '',
    to: emailData.to_addresses || [],
    cc: emailData.cc_addresses || [],
    body: emailData.body_text || emailData.snippet || '',
    snippet: emailData.snippet || ''
  };

  console.log('Sending to OpenAI with system prompt length:', systemPrompt.length);

  try {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this email:\n\n${JSON.stringify(emailContent, null, 2)}` }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return;
    }

    const aiResult = await response.json();
    const aiResponse = aiResult.choices[0]?.message?.content;

    if (!aiResponse) {
      console.error('No response from OpenAI');
      return;
    }

    console.log('OpenAI response:', aiResponse);

    // Parse AI response
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiResponse);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      return;
    }

    // Apply tags if suggested
    if (analysisResult.tags && Array.isArray(analysisResult.tags)) {
      await applyTagsToEmail(analysisResult.tags, emailData.id, userId, tagsMap);
    }

    // Apply labels if suggested
    if (analysisResult.labels && Array.isArray(analysisResult.labels)) {
      await applyLabelsToEmail(analysisResult.labels, emailData.gmail_message_id, userId);
    }

    console.log('Email filtering completed successfully');

  } catch (error) {
    console.error('Error in OpenAI processing:', error);
  }
}

function buildSystemPrompt(filters: any[], existingTags: string[]): string {
  const prompt = `You are an intelligent email classifier. Analyze the provided email and suggest appropriate tags and Gmail labels based on the user's filters.

Available tags: ${existingTags.join(', ')}

User's Filters:
${filters.map(filter => `
Filter: ${filter.name}
Description: ${filter.description || 'No description'}
Conditions: ${JSON.stringify(filter.conditions)}
Actions: ${JSON.stringify(filter.actions)}
`).join('\n')}

Instructions:
1. Analyze the email content, subject, sender, and recipients
2. Match against the user's filter conditions
3. Suggest appropriate tags from the existing tags list
4. Suggest Gmail labels if filters specify label actions
5. Return a JSON response with this exact structure:

{
  "tags": ["tag1", "tag2"],
  "labels": ["LABEL_1", "LABEL_2"],
  "reasoning": "Brief explanation of why these tags/labels were chosen"
}

Rules:
- Only suggest tags that exist in the available tags list
- Be conservative - only apply tags/labels when there's a clear match
- Consider the email's context, sender domain, keywords, and content
- Return valid JSON only, no additional text`;

  return prompt;
}

async function applyTagsToEmail(suggestedTags: string[], messageId: string, userId: string, tagsMap: Map<string, any>) {
  console.log('Applying tags:', suggestedTags);
  
  for (const tagName of suggestedTags) {
    const tag = tagsMap.get(tagName.toLowerCase());
    if (tag) {
      // Check if tag is already applied
      const { data: existingTag } = await admin
        .from('email_message_tags')
        .select('id')
        .eq('message_id', messageId)
        .eq('tag_id', tag.id)
        .maybeSingle();

      if (!existingTag) {
        await admin
          .from('email_message_tags')
          .insert({
            user_id: userId,
            message_id: messageId,
            tag_id: tag.id
          });
      }
    }
  }
}

async function applyLabelsToEmail(suggestedLabels: string[], gmailMessageId: string, userId: string) {
  console.log('Applying labels:', suggestedLabels);
  
  // This would integrate with the gmail-actions function to apply labels
  // For now, we'll log the suggestion
  try {
    await admin.functions.invoke('gmail-actions', {
      body: {
        action: 'modify',
        id: gmailMessageId,
        addLabels: suggestedLabels
      }
    });
  } catch (error) {
    console.error('Error applying Gmail labels:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'process-email') {
      const { emailData } = body;
      if (!emailData) {
        throw new Error('Email data is required');
      }

      await processEmailWithFilters(emailData, user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Email processed successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'generate-filter') {
      const { prompt } = body;
      if (!prompt) {
        throw new Error('Prompt is required for filter generation');
      }

      // Get existing tags to include in the generation
      const { data: existingTags } = await admin
        .from('email_tags')
        .select('name')
        .eq('user_id', user.id);

      const availableTags = existingTags?.map(tag => tag.name) || [];

      const systemPrompt = `You are an AI assistant that helps create email filters. 
Given a user's description of how they want to filter emails, generate a structured filter configuration.

Available tags for this user: ${availableTags.join(', ')}

Return a JSON object with the following structure:
{
  "name": "Brief descriptive name for the filter",
  "description": "What this filter does",
  "conditions": {
    // Conditions for matching emails. Available fields:
    // "sender_email": "exact email address",
    // "sender_domain": "domain.com",
    // "subject_contains": "text to search for",
    // "body_contains": "text to search for in body",
    // "keywords": ["array", "of", "keywords"],
    // "has_attachments": true/false
  },
  "actions": {
    // Actions to take when conditions match. Available actions:
    // "add_tags": ["tag1", "tag2"] (only use existing tags from the available list),
    // "add_labels": ["LABEL_1", "LABEL_2"],
    // "mark_as_read": true/false,
    // "mark_as_important": true/false
  }
}

Common Gmail labels include: INBOX, SENT, DRAFT, SPAM, TRASH, IMPORTANT, STARRED, UNREAD, CATEGORY_PERSONAL, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, CATEGORY_UPDATES, CATEGORY_FORUMS

Only return the JSON object, no other text.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${await response.text()}`);
      }

      const aiResult = await response.json();
      const aiResponse = aiResult.choices[0]?.message?.content;

      let generatedFilter;
      try {
        generatedFilter = JSON.parse(aiResponse);
      } catch (e) {
        throw new Error('Failed to parse AI response as valid JSON');
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          generatedFilter,
          usage: aiResult.usage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'test-filters') {
      const { emailData, filters } = body;
      if (!emailData || !filters) {
        throw new Error('Email data and filters are required for testing');
      }

      // Get existing tags for building the prompt
      const { data: existingTags } = await admin
        .from('email_tags')
        .select('*')
        .eq('user_id', user.id);

      const tagsMap = new Map(existingTags?.map(tag => [tag.name.toLowerCase(), tag]) || []);
      const systemPrompt = buildSystemPrompt(filters, Array.from(tagsMap.keys()));

      const emailContent = {
        subject: emailData.subject || '',
        from: emailData.from_address || emailData.from || '',
        to: emailData.to_addresses || emailData.to || [],
        cc: emailData.cc_addresses || emailData.cc || [],
        body: emailData.body_text || emailData.body || emailData.snippet || '',
        snippet: emailData.snippet || ''
      };

      // Call OpenAI API for testing
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this email:\n\n${JSON.stringify(emailContent, null, 2)}` }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${await response.text()}`);
      }

      const aiResult = await response.json();
      const aiResponse = aiResult.choices[0]?.message?.content;

      return new Response(
        JSON.stringify({ 
          success: true, 
          systemPrompt,
          aiResponse,
          usage: aiResult.usage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Unknown action');
    }

  } catch (error) {
    console.error('Error in email-filter function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});