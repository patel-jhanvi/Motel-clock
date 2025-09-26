"use client";

import { useState } from "react";

export default function EmployeeDashboard() {
    // Replace this with Firebase auth user later
    const employeeName = "Jhanvi";

    const [status, setStatus] = useState("");
    const [time, setTime] = useState("");

    const handleClockIn = () => {
        const now = new Date().toLocaleTimeString();
        setStatus("Clocked In");
        setTime(now);
    };

    const handleClockOut = () => {
        const now = new Date().toLocaleTimeString();
        setStatus("Clocked Out");
        setTime(now);
    };

    return (
        <main className="flex min-h-[calc(100vh-100px)] items-center justify-center bg-[#F9FAFB]">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md text-center border border-gray-200">
                <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6">
                    Welcome, {employeeName}
                </h1>

                <div className="flex gap-4 justify-center mb-4">
                    <button
                        onClick={handleClockIn}
                        className="px-6 py-3 bg-teal-400 text-white rounded-md font-semibold shadow hover:bg-teal-500 transition"
                    >
                        Clock In
                    </button>

                    <button
                        onClick={handleClockOut}
                        className="px-6 py-3 bg-rose-400 text-white rounded-md font-semibold shadow hover:bg-rose-500 transition"
                    >
                        Clock Out
                    </button>
                </div>

                {status && (
                    <p className="text-gray-600">
                        {status} at {time}
                    </p>
                )}
            </div>
        </main>
    );
}
