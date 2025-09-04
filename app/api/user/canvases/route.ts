import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all canvases user has access to
    const { data: userCanvases, error } = await supabase
      .from('canvases')
      .select(`
        id,
        title,
        workspace_id,
        user_id,
        is_public,
        created_at,
        updated_at
      `)
      .eq('user_id', userId);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json(userCanvases || []);
  } catch (error) {
    console.error("Failed to fetch user canvases:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
