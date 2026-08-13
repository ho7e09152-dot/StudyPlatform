import type { Metadata } from "next";
import { OAuthCallbackPage } from "@/components/auth/OAuthCallbackPage";

export const metadata: Metadata = {
  title: "로그인 처리 중",
};

export default function OAuthCallbackRoute() {
  return <OAuthCallbackPage />;
}
