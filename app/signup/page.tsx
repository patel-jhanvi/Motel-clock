"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase"
import { collection, addDoc } from "firebase/firestore";

export default function Signup() {
    const [name, setName] = useState("");
    const [role, setRole] = useState("Housekeeping");
    const [password, setPassword] = useState("");
    const [employeeId, setEmployeeId] = useState<string | null>(null);

    // ✅ add copied state
    const [copied, setCopied] = useState(false);

    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        const newId = "EMP" + Math.floor(1000 + Math.random() * 9000); // EMP####

        try {
            await addDoc(collection(db, "employees"), {
                id: newId,
                name,
                role,
                password, // ⚠️ plain text for MVP (later hash it!)
            });

            setEmployeeId(newId);

            // ⏳ give them 8 seconds before redirect
            setTimeout(() => {
                router.push("/login");
            }, 8000);
        } catch (error) {
            console.error("Error adding employee:", error);
        }
    };

    // ✅ add copy function
    const handleCopy = () => {
        if (employeeId) {
            navigator.clipboard.writeText(employeeId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
            <div className="w-full max-w-md bg-gray-50 rounded-xl shadow-lg p-8">
                <h1 className="text-2xl font-bold text-[#002B5C] mb-6 text-center">
                    Create Your Employee Account
                </h1>

                {employeeId ? (
                    <div className="text-center">
                        <p className="text-lg font-semibold text-[#002B5C] mb-4">
                            Account Created
                        </p>

                        <div className="flex items-center justify-center gap-3 mb-4">
                            <span className="font-bold text-[#002B5C] bg-gray-100 px-3 py-2 rounded-md">
                                {employeeId}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="px-3 py-2 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080] transition"
                            >
                                {copied ? "Copied!" : "Copy"}
                            </button>
                        </div>

                        <p className="mt-2 text-sm text-gray-600">
                            Save this ID to log in. Redirecting to login...
                        </p>
                        <button
                            onClick={() => router.push("/login")}
                            className="px-6 py-2 bg-[#002B5C] text-white rounded-lg font-medium hover:bg-[#004080] transition"
                        >
                            Go to Login Now
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSignup} className="flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="border rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-[#002B5C]"
                        />

                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="border rounded-lg px-4 py-2 text-gray-900 bg-white 
                         focus:outline-none focus:ring-2 focus:ring-[#002B5C]"
                        >
                            <option>Housekeeping</option>
                            <option>Front Desk</option>
                            <option>Maintenance</option>
                            <option>Other</option>
                        </select>

                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="border rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-[#002B5C]"
                        />

                        <button
                            type="submit"
                            className="bg-[#002B5C] text-white py-2 rounded-lg font-semibold hover:bg-[#004080] transition"
                        >
                            Create Account
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
