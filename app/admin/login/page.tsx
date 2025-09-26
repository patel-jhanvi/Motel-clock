"use client";

import { useState, useEffect } from "react";

export default function EmployeeLogin() {
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);

    useEffect(() => {
        const savedId = localStorage.getItem("employeeId");
        if (savedId) setEmployeeId(savedId);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (remember) {
            localStorage.setItem("employeeId", employeeId);
        } else {
            localStorage.removeItem("employeeId");
        }
        // Firebase login logic here
        console.log("Login", { employeeId, password });
    };

    return (
        <main className="flex min-h-[calc(100vh-100px)] items-center justify-center bg-[#F9FAFB] px-4">
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                        type="password"
                        placeholder="Password / PIN"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                    />

                    {/* Remember Me */}
                    <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                        />
                        <span>Remember Me</span>
                    </label>

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF]"
                    >
                        Login
                    </button>
                </form>
            </div>
        </main>
    );
}
