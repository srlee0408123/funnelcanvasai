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
    
    console.log("Syncing user to Supabase:", {
      id: userId,
      email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    });
    
    // Save user to Supabase using service role client
    const supabase = createServiceClient();
    
    // First, upsert the user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || null,
        avatar_url: user.imageUrl || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();
    
    if (profileError) {
      console.error("Error saving user profile:", profileError);
      return NextResponse.json({ 
        error: "Failed to save user profile", 
        details: profileError 
      }, { status: 500 });
    }
    
    console.log("User profile saved:", profile);
    
    // Just sync the user profile, don't create any workspace
    
    return NextResponse.json({ 
      success: true, 
      profile,
      message: "User synced successfully" 
    });
    
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}