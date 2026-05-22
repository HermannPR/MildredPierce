import { NextRequest, NextResponse } from "next/server";
import { MOCK_PET } from "../leaderboard/route";

const PI_API = process.env.NEXT_PUBLIC_TAMAGOTCHI_API ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const alias = String(body.alias ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const count = Math.min(Math.max(1, parseInt(body.count ?? "1", 10)), 50);
  if (!alias) return NextResponse.json({ error: "invalid alias" }, { status: 400 });

  if (PI_API) {
    try {
      const res = await fetch(`${PI_API}/api/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, count }),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, piOnline: true });
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ alias, clicks: count, rank: null, pet: MOCK_PET, piOnline: false });
}
