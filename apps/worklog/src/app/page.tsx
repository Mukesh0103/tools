import { redirect } from "next/navigation";
import { hasLiveSession } from "@/lib/auth";

export default async function Home() {
  redirect((await hasLiveSession()) ? "/today" : "/login");
}
