import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-gray-50 px-4">
      {/* Logo */}
      <div className="mb-4">
        <Image
          src="/logos/icon.png"
          alt="ShiftTrack Logo"
          width={80}
          height={80}
          priority
        />
      </div>

      {/* Tagline */}
      <h1 className="text-2xl font-bold text-[#1E3A8A] mb-8 text-center">
        Welcome to Employee Clock System
      </h1>

      {/* Buttons */}
      <div className="flex flex-col space-y-4 w-full max-w-xs">
        {/* Employee Login */}
        <Link href="/login">
          <button className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF]">
            Employee Login
          </button>
        </Link>

        {/* Manager Login */}
        <Link href="/admin/login">
          <button className="w-full py-3 bg-gray-700 text-white rounded-md font-semibold hover:bg-gray-800">
            Manager Login
          </button>
        </Link>
      </div>
    </main>
  );
}
