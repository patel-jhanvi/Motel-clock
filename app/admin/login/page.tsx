"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function ManagerLogin() {
    const router = useRouter();
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            // 🔒 Read manager PIN from Firestore doc
            const pinDoc = await getDoc(doc(db, "config", "manager"));
            const validPin = pinDoc.exists() ? pinDoc.data().pin : null;

            if (pin === validPin) {
                sessionStorage.setItem("managerAuth", "true");
                router.push("/admin/dashboard");
            } else {
                setError("Invalid PIN. Access denied.");
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Try again.");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-4">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Manager Access
                </h1>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="password"
                        placeholder="Enter Manager PIN"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800 text-lg"
                    />

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold text-lg hover:bg-[#1E40AF] transition"
                    >
                        Access Dashboard
                    </button>
                </form>
            </div>
        </main>
    );
}
