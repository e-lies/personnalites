import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel Processor",
  description: "Upload and process Excel files to remove duplicate rows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
