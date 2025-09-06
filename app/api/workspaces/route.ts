import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserWorkspaces, createWorkspace } from "@/services/workspace-service";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await getUserWorkspaces(userId);
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('Failed to fetch user workspaces:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
    const created = await createWorkspace(userId, name);
    if (!created) {
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }
    return NextResponse.json(created);
  } catch (error) {
    console.error("Unexpected error in POST /api/workspaces:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
