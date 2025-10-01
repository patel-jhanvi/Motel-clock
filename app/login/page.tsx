"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function EmployeeLogin() {
    const router = useRouter();
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            // 🔎 Check if employee exists
            const q = query(collection(db, "employees"), where("employeeId", "==", employeeId));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setError("No employee found with that ID.");
                return;
            }

            let userDoc: any = null;
            snapshot.forEach((doc) => (userDoc = doc.data()));

            if (!userDoc) {
                setError("Invalid employee data.");
                return;
            }

            // 🔑 Check password
            if (userDoc.password !== password) {
                setError("Incorrect password.");
                return;
            }

            // ✅ Success → send employeeId to dashboard
            router.push(`/employee/dashboard?empId=${userDoc.employeeId}`);
        } catch (err: any) {
            console.error(err);
            setError("Login failed. Try again.");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-4">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Employee Login
                </h1>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Employee ID"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
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

                    {error && (
                        <p className="text-red-500 text-sm text-center">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                    >
                        Login
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-600">
                    Don’t have an account?{" "}
                    <span
                        onClick={() => router.push("/signup")}
                        className="text-[#2563EB] cursor-pointer hover:underline"
                    >
                        Create one
                    </span>
                </p>
            </div>
        </main>
    );
}
