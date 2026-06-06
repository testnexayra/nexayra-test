"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

export default function AssetsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/logistics/assets");
  }, [router]);
  return <Loader fullScreen message="Taking you to the Assets module…" />;
}