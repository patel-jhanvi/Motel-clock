import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ShiftTrack",
  description: "Motel employee tracking system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F9FAFB] text-gray-900">
        <Navbar />
        <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4">
          {children}
        </main>
      </body>
    </html>
  );
}
