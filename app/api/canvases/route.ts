import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  
  // First get user's workspaces
  const { data: wsListData, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId);
  
  if (wsError) {
    return NextResponse.json({ error: wsError.message }, { status: 500 });
  }
  
  const wsList = (wsListData || []) as { id: string }[];

  if (!wsList?.length) {
    return NextResponse.json([]);
  }
  
  // Then get canvases from those workspaces
  const { data, error } = await supabase
    .from('canvases')
    .select('*')
    .in('workspace_id', wsList.map(w => w.id))
    .order('updated_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, workspace_id } = body;
    
    console.log("Creating canvas:", { title, workspace_id, userId });
    
    if (!title || !workspace_id) {
      return NextResponse.json({ 
        error: "Missing required fields", 
        details: { title: !title ? "Title is required" : null, workspace_id: !workspace_id ? "Workspace ID is required" : null }
      }, { status: 400 });
    }
    
    const supabase = createServiceClient();
    
    // Verify user has access to workspace (check if owner or member)
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .eq('owner_id', userId);
    
    if (wsError) {
      console.error("Error verifying workspace access:", wsError);
      return NextResponse.json({ 
        error: "Failed to verify workspace access", 
        details: wsError.message 
      }, { status: 500 });
    }
    
    // If not owner, check if member
    let hasAccess = workspaces && workspaces.length > 0;
    
    if (!hasAccess) {
      const { data: memberCheck } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', userId);
      
      hasAccess = (memberCheck && memberCheck.length > 0) || false;
    }
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: "Workspace not found or access denied",
        workspace_id,
        userId 
      }, { status: 403 });
    }
    
    // Create canvas
    const { data, error } = await (supabase as any)
      .from('canvases')
      .insert({
        title,
        workspace_id,
        created_by: userId,
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating canvas:", error);
      return NextResponse.json({ 
        error: error.message,
        details: error 
      }, { status: 500 });
    }
    
    console.log("Canvas created successfully:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error in POST /api/canvases:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
