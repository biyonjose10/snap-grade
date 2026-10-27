import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Caveat, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const body = Atkinson_Hyperlegible({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"] });
const pen = Caveat({ variable: "--font-pen", subsets: ["latin"], weight: ["600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Second Reader — first-pass marking for handwritten scripts",
  description:
    "Photograph answer scripts; NVIDIA Nemotron Super VL reads them and Nemotron Ultra proposes marks against your rubric on Nebius Token Factory. Code checks the arithmetic, and nothing is final until you approve it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${pen.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
