import type { Metadata } from "next";
import { headers } from "next/headers";
import { RootShell } from "@/components/shell/RootShell";
import "./globals.css";
import "./design-system.css";
import "./settings.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const isLoopback =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
  const protocol = forwardedProto ?? (isLoopback ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Study-ing",
      template: "%s · Study-ing",
    },
    description:
      "GitLab 저장소를 원본으로 사용하는 팀 학습 일정·제출·기록 관리 Workspace",
    icons: {
      icon: "/study-ing-icon.png?v=20260813",
      shortcut: "/study-ing-icon.png?v=20260813",
      apple: "/study-ing-icon-white.jpg?v=20260813",
    },
    openGraph: {
      title: "Study-ing",
      description: "GitLab 기반 팀 학습 관리",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Study-ing",
      description: "GitLab 기반 팀 학습 관리",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body><RootShell>{children}</RootShell></body>
    </html>
  );
}
