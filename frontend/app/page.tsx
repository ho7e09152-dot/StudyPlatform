import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "GitLab로 이어지는 스터디 Workspace",
};

export default function HomePage() {
  return <LandingPage />;
}
