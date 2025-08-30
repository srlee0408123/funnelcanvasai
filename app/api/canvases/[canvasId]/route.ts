import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvases, canvasStates, workspaceMembers } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

interface RouteParams {
  params: {
    canvasId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { canvasId } = params;

    // Get canvas with state
    const [canvas] = await db
      .select()
      .from(canvases)
      .where(eq(canvases.id, canvasId));

    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Check if canvas is public or user has access
    if (!canvas.isPublic) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if user has access through workspace membership
      const [member] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, canvas.workspaceId),
            eq(workspaceMembers.userId, session.user.id)
          )
        );

      if (!member && canvas.createdBy !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get the latest canvas state
    const [state] = await db
      .select()
      .from(canvasStates)
      .where(eq(canvasStates.canvasId, canvasId))
      .orderBy(canvasStates.createdAt);

    return NextResponse.json({
      ...canvas,
      state: state?.state || null,
    });
  } catch (error) {
    console.error("Failed to fetch canvas:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { canvasId } = params;
    const body = await request.json();

    // Check if user has access to update
    const [canvas] = await db
      .select()
      .from(canvases)
      .where(eq(canvases.id, canvasId));

    if (!canvas) {
      return NextResponse.json({ error: "Canvas not found" }, { status: 404 });
    }

    // Check workspace membership
    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, canvas.workspaceId),
          eq(workspaceMembers.userId, session.user.id)
        )
      );

    if (!member && canvas.createdBy !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update canvas
    const [updatedCanvas] = await db
      .update(canvases)
      .set({
        title: body.title || canvas.title,
        updatedAt: new Date(),
      })
      .where(eq(canvases.id, canvasId))
      .returning();

    // If state is provided, update it
    if (body.state) {
      await db.insert(canvasStates).values({
        canvasId,
        state: body.state,
        userId: session.user.id,
      });
    }

    return NextResponse.json(updatedCanvas);
  } catch (error) {
    console.error("Failed to update canvas:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}