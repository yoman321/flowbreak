import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "System Design Sandbox",
  description: "Learn system design by breaking it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
