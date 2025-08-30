import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userWorkspaces = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, session.user.id));

    return NextResponse.json(userWorkspaces);
  } catch (error) {
    console.error("Failed to fetch workspaces:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = createWorkspaceSchema.parse(body);

    // Create workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name,
        ownerId: session.user.id,
      })
      .returning();

    // Add owner as member
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      role: "owner",
    });

    return NextResponse.json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Failed to create workspace:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}