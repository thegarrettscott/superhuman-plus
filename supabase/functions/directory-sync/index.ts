import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  userId: string;
  accountId: string;
  accessToken: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { userId, accountId, accessToken }: SyncRequest = await req.json();
    console.log(`Starting directory sync for user: ${userId}, account: ${accountId}`);

    // Initialize sync status records
    const syncTypes = ['labels', 'contacts', 'messages'];
    for (const syncType of syncTypes) {
      await supabase.from('sync_status').insert({
        user_id: userId,
        account_id: accountId,
        sync_type: syncType,
        status: 'pending'
      });
    }

    // Start background sync process
    EdgeRuntime.waitUntil(performDirectorySync(supabase, userId, accountId, accessToken));

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Directory sync initiated' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in directory-sync:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performDirectorySync(
  supabase: any, 
  userId: string, 
  accountId: string, 
  accessToken: string
) {
  try {
    console.log('Starting background directory sync...');

    // 1. Sync Gmail Labels
    await syncGmailLabels(supabase, userId, accountId, accessToken);
    
    // 2. Sync Google Contacts  
    await syncGoogleContacts(supabase, userId, accountId, accessToken);
    
    // 3. Sync Recent Email Messages
    await syncRecentEmails(supabase, userId, accountId, accessToken);

    console.log('Directory sync completed successfully');

  } catch (error) {
    console.error('Error in background sync:', error);
  }
}

async function syncGmailLabels(
  supabase: any,
  userId: string, 
  accountId: string,
  accessToken: string
) {
  try {
    console.log('Syncing Gmail labels...');
    
    // Update sync status
    await supabase.from('sync_status')
      .update({ 
        status: 'in_progress', 
        started_at: new Date().toISOString() 
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'labels');

    // Fetch labels from Gmail API
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!labelsResponse.ok) {
      throw new Error(`Gmail API error: ${labelsResponse.statusText}`);
    }

    const labelsData = await labelsResponse.json();
    const labels = labelsData.labels || [];

    console.log(`Found ${labels.length} labels to sync`);

    // Update total count
    await supabase.from('sync_status')
      .update({ total_items: labels.length })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'labels');

    // Insert labels into database
    const labelsToInsert = labels.map((label: any) => ({
      user_id: userId,
      account_id: accountId,
      gmail_label_id: label.id,
      name: label.name,
      type: label.type || 'user',
      color_background: label.color?.backgroundColor,
      color_text: label.color?.textColor,
      messages_total: label.messagesTotal || 0,
      messages_unread: label.messagesUnread || 0,
      threads_total: label.threadsTotal || 0,
      threads_unread: label.threadsUnread || 0,
      is_visible: label.labelListVisibility !== 'labelHide'
    }));

    if (labelsToInsert.length > 0) {
      const { error } = await supabase
        .from('gmail_labels')
        .upsert(labelsToInsert, { 
          onConflict: 'user_id,account_id,gmail_label_id' 
        });

      if (error) {
        console.error('Error inserting labels:', error);
        throw error;
      }
    }

    // Mark labels sync as complete
    await supabase.from('sync_status')
      .update({ 
        status: 'completed',
        synced_items: labels.length,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'labels');

    console.log('Gmail labels sync completed');

  } catch (error) {
    console.error('Error syncing Gmail labels:', error);
    await supabase.from('sync_status')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'labels');
  }
}

async function syncGoogleContacts(
  supabase: any,
  userId: string,
  accountId: string, 
  accessToken: string
) {
  try {
    console.log('Syncing Google contacts...');
    
    // Update sync status
    await supabase.from('sync_status')
      .update({ 
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'contacts');

    // Fetch contacts from Google People API
    const contactsResponse = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos,organizations&pageSize=1000',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!contactsResponse.ok) {
      throw new Error(`Google People API error: ${contactsResponse.statusText}`);
    }

    const contactsData = await contactsResponse.json();
    const contacts = contactsData.connections || [];

    console.log(`Found ${contacts.length} contacts to sync`);

    // Update total count
    await supabase.from('sync_status')
      .update({ total_items: contacts.length })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'contacts');

    // Process and insert contacts
    const contactsToInsert = contacts
      .filter((contact: any) => contact.emailAddresses?.length > 0)
      .map((contact: any) => ({
        user_id: userId,
        account_id: accountId,
        gmail_contact_id: contact.resourceName,
        display_name: contact.names?.[0]?.displayName || '',
        email_addresses: JSON.stringify(contact.emailAddresses || []),
        phone_numbers: JSON.stringify(contact.phoneNumbers || []),
        photo_url: contact.photos?.[0]?.url,
        organization: contact.organizations?.[0]?.name,
        job_title: contact.organizations?.[0]?.title
      }));

    if (contactsToInsert.length > 0) {
      const { error } = await supabase
        .from('gmail_contacts')
        .upsert(contactsToInsert, { 
          onConflict: 'user_id,account_id,gmail_contact_id' 
        });

      if (error) {
        console.error('Error inserting contacts:', error);
        throw error;
      }
    }

    // Mark contacts sync as complete
    await supabase.from('sync_status')
      .update({ 
        status: 'completed',
        synced_items: contactsToInsert.length,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'contacts');

    console.log('Google contacts sync completed');

  } catch (error) {
    console.error('Error syncing Google contacts:', error);
    await supabase.from('sync_status')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'contacts');
  }
}

async function syncRecentEmails(
  supabase: any,
  userId: string,
  accountId: string,
  accessToken: string
) {
  try {
    console.log('Syncing recent emails...');
    
    // Update sync status
    await supabase.from('sync_status')
      .update({ 
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'messages');

    // Calculate date for last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const query = `after:${Math.floor(threeMonthsAgo.getTime() / 1000)}`;

    // Fetch recent message IDs
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!messagesResponse.ok) {
      throw new Error(`Gmail API error: ${messagesResponse.statusText}`);
    }

    const messagesData = await messagesResponse.json();
    const messageIds = messagesData.messages || [];

    console.log(`Found ${messageIds.length} recent emails to sync`);

    // Update total count
    await supabase.from('sync_status')
      .update({ total_items: messageIds.length })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'messages');

    // Batch process messages (process in chunks of 50)
    const chunkSize = 50;
    let syncedCount = 0;

    for (let i = 0; i < messageIds.length; i += chunkSize) {
      const chunk = messageIds.slice(i, i + chunkSize);
      
      // Fetch message details for this chunk
      const messagePromises = chunk.map(async (msg: any) => {
        try {
          const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Subject`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error(`Error fetching message ${msg.id}:`, error);
          return null;
        }
      });

      const messages = (await Promise.all(messagePromises)).filter(Boolean);

      // Insert messages into database
      const messagesToInsert = messages.map((msg: any) => {
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

        return {
          user_id: userId,
          account_id: accountId,
          gmail_message_id: msg.id,
          thread_id: msg.threadId,
          subject: getHeader('Subject'),
          from_address: getHeader('From'),
          to_addresses: getHeader('To') ? [getHeader('To')] : [],
          cc_addresses: getHeader('Cc') ? [getHeader('Cc')] : [],
          bcc_addresses: getHeader('Bcc') ? [getHeader('Bcc')] : [],
          snippet: msg.snippet || '',
          label_ids: msg.labelIds || [],
          size_estimate: msg.sizeEstimate || 0,
          internal_date: new Date(parseInt(msg.internalDate)).toISOString(),
          is_read: !msg.labelIds?.includes('UNREAD')
        };
      });

      if (messagesToInsert.length > 0) {
        const { error } = await supabase
          .from('email_messages')
          .upsert(messagesToInsert, { 
            onConflict: 'user_id,account_id,gmail_message_id' 
          });

        if (error) {
          console.error('Error inserting messages chunk:', error);
        } else {
          syncedCount += messagesToInsert.length;
        }
      }

      // Update progress
      await supabase.from('sync_status')
        .update({ synced_items: syncedCount })
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('sync_type', 'messages');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Mark messages sync as complete
    await supabase.from('sync_status')
      .update({ 
        status: 'completed',
        synced_items: syncedCount,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'messages');

    console.log('Recent emails sync completed');

  } catch (error) {
    console.error('Error syncing recent emails:', error);
    await supabase.from('sync_status')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('sync_type', 'messages');
  }
}