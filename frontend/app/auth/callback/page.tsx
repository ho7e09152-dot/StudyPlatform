import type { Metadata } from "next";
import { OAuthCallbackPage } from "@/components/auth/OAuthCallbackPage";

export const metadata: Metadata = {
  title: "GitLab 로그인 연결 중",
};

export default function OAuthCallbackRoute() {
  return <OAuthCallbackPage />;
}
