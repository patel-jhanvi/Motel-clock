"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Login() {
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const q = query(collection(db, "employees"), where("id", "==", employeeId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError("Employee not found");
                return;
            }

            const employee = querySnapshot.docs[0].data();

            if (employee.password !== password) {
                setError("Invalid password");
                return;
            }

            // ✅ Save both name + ID in session
            sessionStorage.setItem("employeeId", employee.id);
            sessionStorage.setItem("employeeName", employee.name);

            setError("");
            router.push("/dashboard");
        } catch (err) {
            console.error("Login error:", err);
            setError("Something went wrong, please try again.");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
            <div className="w-full max-w-md bg-gray-50 rounded-xl shadow-lg p-8">
                <h1 className="text-2xl font-bold text-[#002B5C] mb-6 text-center">
                    Employee Login
                </h1>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Employee ID"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="border rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-[#002B5C]"
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 
                       focus:outline-none focus:ring-2 focus:ring-[#002B5C]"
                        required
                    />

                    <button
                        type="submit"
                        className="bg-[#002B5C] text-white py-2 rounded-lg font-semibold hover:bg-[#004080] transition"
                    >
                        Continue
                    </button>
                </form>

                {error && (
                    <p className="mt-4 text-red-600 text-sm text-center">{error}</p>
                )}
            </div>
        </main>
    );
}
