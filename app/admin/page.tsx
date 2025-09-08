import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminClient from "./client";
import { getUserProfileRole } from "@/lib/auth/auth-service";

export default async function AdminPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // 관리자 권한 확인: admin만 접근 허용
  const role = await getUserProfileRole(userId)
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  return <AdminClient />;
}