"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
    const [pin, setPin] = useState("");
    const router = useRouter();

    const handleLogin = () => {
        if (pin === "1234") {  // 🔑 Replace with your secure PIN
            router.push("/admin/dashboard");
        } else {
            alert("Invalid PIN");
        }
    };

    return (
        <main className="p-8 bg-white text-[#002B5C] min-h-screen">

            <div className="p-8 bg-white rounded-lg shadow-md w-96 text-center">
                <h1 className="text-2xl font-bold text-[#002B5C] mb-6">Manager Login</h1>
                <input
                    type="password"
                    placeholder="Enter Manager PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full mb-4 p-2 border border-gray-300 rounded"
                />
                <button
                    onClick={handleLogin}
                    className="w-full bg-[#002B5C] text-white py-2 rounded hover:bg-[#004080]"
                >
                    Login
                </button>
            </div>
        </main>
    );
}
