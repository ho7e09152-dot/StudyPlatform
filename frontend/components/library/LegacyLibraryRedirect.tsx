"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LegacyLibraryRedirect({ destination }: { destination: string }) {
  const router = useRouter();
  useEffect(() => { const timer = window.setTimeout(() => router.replace(destination), 0); return () => window.clearTimeout(timer); }, [destination, router]);
  return <div className="library-route-state"><strong>학습 라이브러리로 이동하고 있어요.</strong><Link href={destination} className="button button--secondary">바로 이동</Link></div>;
}
