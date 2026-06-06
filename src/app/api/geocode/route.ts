import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    if (!lat || !lng) return NextResponse.json({ ok: false, message: "lat and lng required" }, { status: 400 });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: true, address: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` });
    }

    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const res = await fetch(geoUrl);
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({ ok: true, address: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` });
    }

    return NextResponse.json({ ok: true, address: data.results[0].formatted_address });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}