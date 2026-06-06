"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

export default function BrandRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/marketing/brand-hub");
  }, [router]);
  return <Loader fullScreen message="Taking you to the Brand Hub…" />;
}