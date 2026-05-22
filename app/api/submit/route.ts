import { NextRequest, NextResponse } from "next/server";

const PI_API = process.env.NEXT_PUBLIC_TAMAGOTCHI_API ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nick  = String(body.nick ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const score = parseInt(body.score ?? "0", 10);

  if (!nick || score < 1) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  if (PI_API) {
    try {
      const res = await fetch(`${PI_API}/api/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: nick, count: score }),
      });
      if (res.ok) return NextResponse.json({ ok: true });
    } catch {
      // fall through
    }
  }

  return NextResponse.json({ ok: true });
}
