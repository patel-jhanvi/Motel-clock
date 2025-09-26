import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] bg-[#F9FAFB] px-4">
      <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
        Welcome to Employee Clock System
      </h1>

      <div className="flex space-x-4">
        {/* Signup */}
        <Link href="/signup">
          <button className="px-6 py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF]">
            Signup
          </button>
        </Link>

        {/* Login */}
        <Link href="/login">
          <button className="px-6 py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF]">
            Login
          </button>
        </Link>

        {/* Manager - FIX HERE */}
        <Link href="/admin/login">
          <button className="px-6 py-3 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-700">
            Manager
          </button>
        </Link>
      </div>
    </main>
  );
}
