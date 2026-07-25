import type { Metadata } from "next";
import { headers } from "next/headers";
import { RootShell } from "@/components/shell/RootShell";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Study Workspace",
      template: "%s · Study Workspace",
    },
    description:
      "GitLab 저장소를 원본으로 사용하는 팀 학습 일정·제출·기록 관리 Workspace",
    icons: {
      icon: "/ssafy_icon.png",
      shortcut: "/ssafy_icon.png",
      apple: "/ssafy_icon.png",
    },
    openGraph: {
      title: "Study Workspace",
      description: "GitLab 기반 팀 학습 관리",
      type: "website",
      images: [{ url: socialImage, width: 1728, height: 910 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Study Workspace",
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
