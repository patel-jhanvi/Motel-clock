"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        // TEMP login bypass — later check Firebase
        if (employeeId && password) {
            router.push("/employee/dashboard");
        } else {
            alert("Invalid login");
        }
    };

    return (
        <main className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-[#F9FAFB]">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Employee Login
                </h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Employee ID"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full border px-4 py-2 rounded-md"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border px-4 py-2 rounded-md"
                        required
                    />
                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                    >
                        Login
                    </button>
                </form>
            </div>
        </main>
    );
}
