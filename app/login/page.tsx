"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function EmployeeKiosk() {
    const router = useRouter();
    const [employeeId, setEmployeeId] = useState("");
    const [error, setError] = useState("");
    const [time, setTime] = useState(new Date());
    const [isClient, setIsClient] = useState(false); // 👈 add this

    useEffect(() => {
        setIsClient(true); // ✅ ensures we render clock only on client
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            const q = query(collection(db, "employees"), where("employeeId", "==", employeeId.trim()));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                setError("Invalid Employee ID");
                return;
            }
            router.push(`/employee/dashboard?empId=${employeeId}`);
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Try again.");
        }
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB] text-center px-4">
            {/* 🕒 Digital Clock */}
            {isClient && (
                <div className="mb-10">
                    <h1 className="text-5xl font-bold text-[#1E3A8A]">
                        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </h1>
                    <p className="text-gray-600 mt-2 text-lg">
                        {time.toLocaleDateString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </p>
                </div>
            )}

            {/* 🧭 Kiosk Box */}
            <div className="bg-white shadow-xl rounded-lg p-10 w-full max-w-md border border-gray-200">
                <h2 className="text-2xl font-bold text-[#1E3A8A] mb-6">Employee Clock In / Out</h2>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Enter Employee ID"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800 text-lg"
                    />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold text-lg hover:bg-[#1E40AF] transition"
                    >
                        Continue
                    </button>
                </form>

                <p className="mt-6 text-sm text-gray-600">
                    Don’t have an Employee ID?{" "}
                    <span
                        onClick={() => router.push("/signup")}
                        className="text-[#2563EB] cursor-pointer hover:underline font-medium"
                    >
                        Create one
                    </span>
                </p>
            </div>
        </main>
    );
}
