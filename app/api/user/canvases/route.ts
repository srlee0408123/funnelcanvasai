import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvases, workspaceMembers } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all canvases user has access to (owned or shared)
    const userCanvases = await db
      .select({
        id: canvases.id,
        title: canvases.title,
        workspaceId: canvases.workspaceId,
        createdBy: canvases.createdBy,
        isPublic: canvases.isPublic,
        createdAt: canvases.createdAt,
        updatedAt: canvases.updatedAt,
      })
      .from(canvases)
      .innerJoin(workspaceMembers, eq(canvases.workspaceId, workspaceMembers.workspaceId))
      .where(
        or(
          eq(workspaceMembers.userId, session.user.id),
          eq(canvases.createdBy, session.user.id)
        )
      );

    return NextResponse.json(userCanvases);
  } catch (error) {
    console.error("Failed to fetch user canvases:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}