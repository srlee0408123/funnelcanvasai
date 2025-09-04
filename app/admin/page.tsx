import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminClient from "./client";

export default async function AdminPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  // TODO: Add admin role check
  
  return <AdminClient />;
}