import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "스터디의 계획부터 기록까지",
  description: "오늘의 학습, 일정, 제출과 리뷰, 학습 기록을 하나의 Study-ing Workspace에서 이어가세요.",
  openGraph: {
    title: "Study-ing · 스터디의 계획부터 기록까지",
    description: "GitLab 또는 GitHub 저장소를 연결해 팀 학습의 계획부터 기록까지 한 흐름으로 관리하세요.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Study-ing · 스터디의 계획부터 기록까지",
    description: "오늘의 학습, 일정, 제출과 리뷰, 학습 기록을 하나의 흐름으로 이어가세요.",
  },
};

export default function HomePage() {
  return <LandingPage />;
}
