import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sandbox 2.0 | American Electorate Laboratory",
  description:
    "Change an electoral assumption and trace its consequences from reporting units to the Electoral College.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
