"use client";

import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
    return (
        <header className="flex items-center justify-between px-8 py-3 bg-[#F9FAFB] border-b-4 border-[#2563EB] shadow-sm">
            {/* Logo */}
            <Link href="/" className="flex items-center cursor-pointer">
                <Image
                    src="/logos/logo.png"
                    alt="ShiftTrack Logo"
                    width={160}
                    height={100}
                    priority
                />
            </Link>

            {/* Right Side Links */}
            <nav className="flex gap-6 text-sm font-semibold text-[#1E3A8A]">
                <Link href="/login" className="hover:text-[#2563EB]">
                    Employee
                </Link>
                <Link href="/admin/login" className="hover:text-[#2563EB]">
                    Manager
                </Link>
            </nav>
        </header>
    );
}
