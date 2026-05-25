import { NextRequest, NextResponse } from "next/server";

const PI_API = process.env.NEXT_PUBLIC_TAMAGOTCHI_API ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const alias = String(body.alias ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!alias) return NextResponse.json({ error: "invalid alias" }, { status: 400 });

  if (PI_API) {
    try {
      const res = await fetch(`${PI_API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, piOnline: true });
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ alias, clicks: 0, rank: null, piOnline: false });
}
