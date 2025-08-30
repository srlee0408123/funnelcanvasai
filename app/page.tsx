import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Landing from "@/components/Landing";

export default async function HomePage() {
  const { userId } = await auth();
  
  if (userId) {
    redirect("/dashboard");
  }
  
  return <Landing />;
}