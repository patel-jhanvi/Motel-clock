"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("Front Desk");
    const [employeeId, setEmployeeId] = useState("");
    const [showPopup, setShowPopup] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Generate unique Employee ID
            const empId = "EMP" + Math.floor(1000 + Math.random() * 9000);
            setEmployeeId(empId);

            // Save employee in Firestore
            await addDoc(collection(db, "employees"), {
                name,
                password,
                role,
                employeeId: empId,
                createdAt: new Date().toISOString(),
            });

            // Show popup
            setShowPopup(true);
            setTimeLeft(60);
        } catch (error: any) {
            alert(error.message);
        }
    };

    // Auto-redirect countdown
    useEffect(() => {
        if (showPopup && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (showPopup && timeLeft === 0) {
            router.push("/login");
        }
    }, [showPopup, timeLeft, router]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(employeeId);
        alert("Copied Employee ID: " + employeeId);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-4">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6 text-center">
                    Employee Signup
                </h1>

                <form onSubmit={handleSignup} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
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

                    {/* Role Dropdown */}
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2563EB] text-gray-800"
                    >
                        <option>Front Desk</option>
                        <option>Maintenance</option>
                        <option>Other</option>
                    </select>

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF] transition"
                    >
                        Sign Up
                    </button>
                </form>

                {/* Success Popup */}
                {showPopup && (
                    <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                        <h3 className="text-lg font-semibold text-[#1E3A8A]">Account Created</h3>
                        <p>Your Employee ID:</p>
                        <p className="font-mono text-xl text-[#2563EB]">{employeeId}</p>

                        <button
                            onClick={copyToClipboard}
                            className="bg-gray-700 text-white px-3 py-1 rounded mt-2 hover:bg-gray-900"
                        >
                            Copy ID
                        </button>

                        <p className="text-gray-600 text-sm mt-2">
                            Redirecting to login in <b>{timeLeft}s</b>
                        </p>

                        <div className="flex gap-2 justify-center mt-3">
                            <button
                                onClick={() => setTimeLeft(timeLeft + 60)}
                                className="bg-gray-300 text-black px-3 py-1 rounded font-medium hover:bg-gray-400"
                            >
                                More Time (+60s)
                            </button>
                            <button
                                onClick={() => router.push("/login")}
                                className="bg-[#2563EB] text-white px-3 py-1 rounded font-medium hover:bg-[#1E40AF]"
                            >
                                Login Now
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
