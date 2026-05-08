import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(req: NextRequest) {
  const referer = req.headers.get("referer") ?? "";
  const host    = req.headers.get("host") ?? "";

  if (host && !referer.includes(host)) {
    return new NextResponse(null, { status: 403 });
  }

  const accept  = req.headers.get("accept") ?? "";
  const useOpus = accept.includes("webm") || accept.includes("opus");
  const ext     = useOpus ? "webm" : "mp3";
  const mime    = useOpus ? "audio/webm" : "audio/mpeg";

  try {
    const data = await readFile(join(process.cwd(), "public", "tv", `song.${ext}`));
    return new NextResponse(data, {
      headers: {
        "Content-Type":            mime,
        "Cache-Control":           "private, no-store",
        "X-Content-Type-Options":  "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
