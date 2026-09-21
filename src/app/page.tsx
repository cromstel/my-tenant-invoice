import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage(): Promise<never> {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  redirect("/login");
}
