import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowbreak",
  description: "Learn system design by breaking the flow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
