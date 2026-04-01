import { Literata, Playfair_Display, Lato } from "next/font/google";

export const literata = Literata({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-literata",
});

export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-playfair",
});

export const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
  variable: "--font-lato",
});
