import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_REPO  = process.env.GITHUB_REPO  ?? "HermannPR/MildredPierce";
const RELEASE_TAG  = "recordings";

const GH_HEADERS = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

async function getOrCreateRelease(): Promise<{ id: number }> {
  const check = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`,
    { headers: GH_HEADERS }
  );
  if (check.ok) return check.json();

  const create = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases`,
    {
      method: "POST",
      headers: { ...GH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: RELEASE_TAG,
        name: "Gameplay Recordings",
        body: "Auto-recorded gameplay sessions from Mildred Pierce.",
        draft: false,
        prerelease: true,
      }),
    }
  );
  return create.json();
}

export async function POST(req: NextRequest) {
  if (!GITHUB_TOKEN)
    return NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 503 });

  const form = await req.formData();
  const video = form.get("video") as File | null;
  if (!video) return NextResponse.json({ error: "no video" }, { status: 400 });

  const channel   = String(form.get("channel")   ?? "ch");
  const timestamp = String(form.get("timestamp")  ?? Date.now());
  const filename  = `${channel}_${timestamp}.webm`;

  const release = await getOrCreateRelease();
  const buffer  = Buffer.from(await video.arrayBuffer());

  const upload = await fetch(
    `https://uploads.github.com/repos/${GITHUB_REPO}/releases/${release.id}/assets?name=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "video/webm",
      },
      body: buffer,
    }
  );

  const asset = await upload.json();
  return NextResponse.json({
    url:  asset.browser_download_url ?? null,
    name: filename,
  });
}
