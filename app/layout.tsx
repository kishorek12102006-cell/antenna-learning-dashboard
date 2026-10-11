import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbital Antenna Lab",
  description: "Explore a 2.4 GHz microstrip patch antenna design.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

