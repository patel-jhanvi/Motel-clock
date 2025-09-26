"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
    const [time, setTime] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "America/New_York",
            };
            setTime(now.toLocaleString("en-US", options));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <header className="flex items-center justify-between px-8 py-3 bg-[#F9FAFB] border-b-4 border-[#2563EB] shadow-sm">
            {/* Logo on the left */}
            <Link href="/">
                <Image
                    src="/logos/logo.png"
                    alt="ShiftTrack Logo"
                    width={160}
                    height={65}
                    priority
                    className="cursor-pointer"
                />
            </Link>

            {/* Clock on the right */}
            <div className="text-lg font-semibold text-[#111827]">{time}</div>
        </header>
    );
}
