"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function ManagerSignup() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            await addDoc(collection(db, "managers"), {
                email,
                password,
                createdAt: new Date(),
            });

            alert("✅ Manager account created. Please log in.");
            router.push("/admin/login");
        } catch (err: any) {
            setError("Signup failed. Try again.");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-4">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Manager Signup
                </h1>

                <form onSubmit={handleSignup} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800"
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800"
                    />

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                    >
                        Create Account
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-600">
                    Already have an account?{" "}
                    <span
                        onClick={() => router.push("/admin/login")}
                        className="text-[#2563EB] cursor-pointer hover:underline"
                    >
                        Login
                    </span>
                </p>
            </div>
        </main>
    );
}
