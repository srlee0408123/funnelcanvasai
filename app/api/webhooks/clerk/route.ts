import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the event type
  const eventType = evt.type;
  
  // Handle the webhook
  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;
    
    if (!email) {
      return new Response("No email found", { status: 400 });
    }

    // Save user to Supabase
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: id,
        email: email,
        name: `${first_name || ''} ${last_name || ''}`.trim() || null,
        avatar_url: image_url || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error("Error saving user to Supabase:", error);
      return new Response("Error saving user", { status: 500 });
    }

    // If this is a new user, create a default workspace
    if (eventType === "user.created") {
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: `${first_name || email.split('@')[0]}'s Workspace`,
          owner_id: id,
        })
        .select()
        .single();

      if (!workspaceError && workspace) {
        // Add user as member of the workspace
        await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: id,
            role: 'owner',
          });
      }
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    
    // Delete user from Supabase (cascades will handle related data)
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting user from Supabase:", error);
      return new Response("Error deleting user", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}