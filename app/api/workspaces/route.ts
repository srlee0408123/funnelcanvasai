import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId);
  
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

    const { name } = await req.json();
    
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }
    
    const supabase = createServiceClient();
    
    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        owner_id: userId,
      })
      .select()
      .single();
    
    if (workspaceError) {
      console.error("Error creating workspace:", workspaceError);
      return NextResponse.json({ error: workspaceError.message }, { status: 500 });
    }
    
    // Add user as member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
      });
    
    if (memberError) {
      console.error("Error adding workspace member:", memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    
    return NextResponse.json(workspace);
  } catch (error) {
    console.error("Unexpected error in POST /api/workspaces:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}