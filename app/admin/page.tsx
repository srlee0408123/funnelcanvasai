import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminClient from "./client";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }
  
  // TODO: Add admin role check
  
  return <AdminClient />;
}