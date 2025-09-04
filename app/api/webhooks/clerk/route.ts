import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  console.log("Webhook endpoint hit");
  
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing svix headers");
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);
  
  console.log("Webhook payload type:", payload.type);

  // Create a new Svix instance with your secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }
  
  const wh = new Webhook(webhookSecret);

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
  console.log("Webhook event type:", eventType);
  
  // Handle the webhook
  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;
    
    console.log("Processing user:", { id, email, first_name, last_name });
    
    if (!email) {
      console.error("No email found for user:", id);
      return new Response("No email found", { status: 400 });
    }

    // Save user to Supabase using service role client (bypasses RLS)
    const supabase = createServiceClient();
    
    const { data, error } = await (supabase as any)
      .from('profiles')
      .upsert({
        id: id,
        email: email,
        name: `${first_name || ''} ${last_name || ''}`.trim() || null,
        avatar_url: image_url || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select();

    if (error) {
      console.error("Error saving user to Supabase:", error);
      return new Response("Error saving user", { status: 500 });
    }
    
    console.log("User saved to Supabase:", data);

    // Don't create any default workspace for new users
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    
    // Delete user from Supabase using service role client (bypasses RLS)
    const supabase = createServiceClient();
    
    const { error } = await (supabase as any)
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
