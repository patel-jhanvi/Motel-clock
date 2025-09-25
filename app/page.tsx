"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/logos/logo.png"
          alt="Microtel by Wyndham"
          width={250}
          height={100}
          priority
        />
      </div>

      <h1 className="text-2xl font-bold text-[#002B5C] mb-8">
        Welcome to Employee Clock System
      </h1>

      <div className="flex gap-6">
        <Link
          href="/signup"
          className="px-6 py-3 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080]"
        >
          Signup
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080]"
        >
          Login
        </Link>
        <Link
          href="/admin/login"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-800"
        >
          Manager
        </Link>
      </div>
    </main>
  );
}
