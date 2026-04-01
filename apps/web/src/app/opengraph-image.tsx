import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Colophony — Open-source editorial workflow for literary magazines";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const playfairBold = await readFile(
    join(process.cwd(), "public/fonts/PlayfairDisplay-Bold.ttf"),
  );

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#191c2b",
      }}
    >
      {/* Calligraphic four-pointed star */}
      <svg
        width="80"
        height="80"
        viewBox="-20 -20 40 40"
        style={{ marginBottom: 20 }}
      >
        <path
          d="M 0,-18 C 1,-13 3,-6 4.5,-4.5 C 6,-3 13,-1 18,0 C 13,1 6,3 4.5,4.5 C 3,6 1,13 0,18 C -1,13 -3,6 -4.5,4.5 C -6,3 -13,1 -18,0 C -13,-1 -6,-3 -4.5,-4.5 C -3,-6 -1,-13 0,-18 Z"
          fill="#c87941"
        />
      </svg>

      {/* Wordmark */}
      <div
        style={{
          fontSize: 72,
          fontFamily: "Playfair Display",
          fontWeight: 700,
          color: "#f0e8d5",
          letterSpacing: "-0.5px",
        }}
      >
        Colophony
      </div>

      {/* Tagline */}
      <div
        style={{
          display: "flex",
          fontSize: 24,
          marginTop: 16,
        }}
      >
        <span style={{ color: "#d8cfc2" }}>Submissions,&nbsp;</span>
        <span style={{ color: "#c87941", fontStyle: "italic" }}>managed.</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Playfair Display",
          data: playfairBold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
