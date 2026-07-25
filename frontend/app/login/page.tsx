import type { Metadata } from "next";
import { LoginPage } from "@/components/marketing/LoginPage";

export const metadata: Metadata = {
  title: "로그인",
};

export default function LoginRoute() {
  return <LoginPage />;
}
