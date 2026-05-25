import type { Metadata } from "next";
import { EyeTVPage } from "./EyeTVPage";

export const metadata: Metadata = {
  title: "EYETV — Mildred Pierce",
  description: "Click the eye. Add hype for the next release.",
};

export default function GamePage() {
  return <EyeTVPage />;
}
