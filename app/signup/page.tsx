"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState("");
    const [password, setPassword] = useState("");
    const [pin, setPin] = useState<string | null>(null);
    const router = useRouter();

    const handleSignup = (e: React.FormEvent) => {
        e.preventDefault();

        // Generate random 4-digit PIN
        const newPin = Math.floor(1000 + Math.random() * 9000).toString();
        setPin(newPin);

        console.log("Signup", { fullName, role, password, pin: newPin });

        // TODO: Save to Firebase later
    };

    return (
        <main className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-[#F9FAFB] px-4">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Create Your Employee Account
                </h1>

                <form onSubmit={handleSignup} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />

                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                        <option value="">Select Role</option>
                        <option value="Front Desk">Front Desk</option>
                        <option value="Housekeeping">Housekeeping</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Other">Other</option>
                    </select>

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                    >
                        Create Account
                    </button>
                </form>

                {pin && (
                    <div className="mt-6 text-center">
                        <p className="text-gray-600">Your generated PIN: {pin}</p>
                        <button
                            onClick={() => router.push("/login")}
                            className="mt-3 bg-[#2563EB] text-white px-4 py-2 rounded-md hover:bg-[#1E40AF] transition"
                        >
                            Go to Login
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
