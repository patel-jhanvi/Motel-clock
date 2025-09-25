"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ✅ Firestore imports
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function Dashboard() {
    const [employeeId, setEmployeeId] = useState("");
    const [employeeName, setEmployeeName] = useState("");
    const [status, setStatus] = useState("");
    const router = useRouter();

    useEffect(() => {
        const id = sessionStorage.getItem("employeeId");
        const name = sessionStorage.getItem("employeeName");

        if (!id) {
            router.push("/login");
        } else {
            setEmployeeId(id);
            setEmployeeName(name || "");
        }
    }, [router]);

    const handleClock = async (type: "in" | "out") => {
        const time = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        // ✅ update local status UI
        setStatus(type === "in" ? `Clocked IN at ${time}` : `Clocked OUT at ${time}`);

        try {
            // ✅ save to Firestore
            await addDoc(collection(db, "attendance"), {
                employeeId,
                employeeName,
                action: type.toUpperCase(),
                timestamp: serverTimestamp(),
            });
            console.log("Attendance saved ✅");
        } catch (err) {
            console.error("Error saving attendance:", err);
        }
    };

    const handleLogout = () => {
        sessionStorage.clear();
        router.push("/login");
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
                {/* Logo */}
                <div className="mb-6 flex justify-center">
                    <Image
                        src="/logos/logo.png"
                        alt="Microtel by Wyndham"
                        width={200}
                        height={80}
                    />
                </div>

                {/* Welcome */}
                <h2 className="text-xl font-semibold text-[#002B5C] mb-2">
                    Welcome, {employeeName}
                </h2>
                <p className="text-sm text-gray-600 mb-6">Employee ID: {employeeId}</p>

                {/* Clock Buttons */}
                <div className="flex gap-6 justify-center mb-6">
                    <button
                        onClick={() => handleClock("in")}
                        className="px-6 py-3 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080] transition"
                    >
                        Clock In
                    </button>
                    <button
                        onClick={() => handleClock("out")}
                        className="px-6 py-3 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080] transition"
                    >
                        Clock Out
                    </button>
                </div>

                {/* Status */}
                {status && (
                    <p className="mb-6 text-lg font-medium text-[#002B5C]">{status}</p>
                )}

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full px-6 py-3 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080] transition"
                >
                    Logout
                </button>
            </div>
        </main>
    );
}
