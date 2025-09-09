import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get full user data from Clerk
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const email = user.emailAddresses[0]?.emailAddress;
    
    if (!email) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }
    
    
    // Save user to Supabase using service role client
    const supabase = createServiceClient();
    
    // First, upsert the user profile (no select to avoid returning PII)
    const { error: profileError } = await (supabase as any)
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
        avatar_url: user.imageUrl || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });
    
    if (profileError) {
      console.error("Error saving user profile:", profileError);
      return NextResponse.json({ 
        error: "Failed to save user profile", 
        details: profileError 
      }, { status: 500 });
    }
    
    
    // Just sync the user profile, don't create any workspace
    // Return no content to avoid exposing PII in network responses
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
