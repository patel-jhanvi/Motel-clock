import "./globals.css";
import Image from "next/image";
import Clock from "@/components/Clock";  // ✅ import from components

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-[#002B5C] antialiased">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-300">
          <Image
            src="/logos/logo.png"
            alt="Microtel by Wyndham"
            width={180}
            height={60}
            priority
          />
          <Clock />
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
