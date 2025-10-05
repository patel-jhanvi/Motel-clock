"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function EmployeeSignup() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [role, setRole] = useState("Front Desk");
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [error, setError] = useState("");

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            // Generate unique Employee ID
            const id = "EMP" + Date.now().toString().slice(-6);

            await addDoc(collection(db, "employees"), {
                name,
                role,
                employeeId: id,
                createdAt: new Date(),
            });

            setEmployeeId(id);
            setName("");
            setRole("Front Desk");
        } catch (err) {
            console.error(err);
            setError("Signup failed. Try again.");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-4">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Employee Signup
                </h1>

                {employeeId ? (
                    <div className="text-center">
                        <p className="text-lg font-semibold text-gray-700">
                            Account created successfully!
                        </p>
                        <p className="mt-4 text-xl font-bold text-[#2563EB]">
                            Your Employee ID: {employeeId}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                            Please copy and save this ID. You’ll use it to Clock In/Out.
                        </p>
                        <button
                            onClick={() => router.push("/login")}
                            className="mt-6 w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                        >
                            Go to Login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSignup} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800"
                        />

                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800"
                        >
                            <option value="Front Desk">Front Desk</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Laundry">Laundry</option>
                            <option value="Other">Other</option>
                        </select>

                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                        >
                            Sign Up
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
