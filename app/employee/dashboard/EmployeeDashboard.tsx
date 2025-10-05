"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    serverTimestamp,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

export default function EmployeeDashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const empId = searchParams.get("empId");

    const [employeeName, setEmployeeName] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [status, setStatus] = useState<"in" | "out" | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [time, setTime] = useState(new Date());

    // 🕒 Live clock
    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!empId) {
            router.push("/login");
            return;
        }

        const fetchEmployee = async () => {
            const q = query(collection(db, "employees"), where("employeeId", "==", empId));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                router.push("/login");
                return;
            }

            const employeeDoc = snapshot.docs[0].data();
            setEmployeeName(employeeDoc.name);
            setRole(employeeDoc.role);
            await fetchLastStatus(empId);
        };

        fetchEmployee();
    }, [empId, router]);

    const fetchLastStatus = async (empId: string) => {
        const q = query(
            collection(db, "logs"),
            where("employeeId", "==", empId),
            orderBy("time", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const lastLog = snapshot.docs[0].data();
            setStatus(lastLog.type);
        } else {
            setStatus(null);
        }
    };

    const handleAction = async (type: "in" | "out") => {
        if (!empId) return;

        await addDoc(collection(db, "logs"), {
            employeeId: empId,
            employeeName,
            role,
            type,
            time: serverTimestamp(),
        });

        const actionTime = new Date().toLocaleTimeString();
        setStatus(type);
        setMessage(`You clocked ${type === "in" ? "in" : "out"} at ${actionTime}`);

        // Return to login screen after 4 seconds
        setTimeout(() => {
            router.push("/login");
        }, 4000);
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB] text-center px-4">
            {/* 🕒 Live Time Display */}
            <div className="mb-8">
                <h1 className="text-5xl font-bold text-[#1E3A8A]">
                    {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </h1>
                <p className="text-gray-600 text-lg">
                    {time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
            </div>

            {/* 💼 Main Card */}
            <div className="bg-white shadow-xl rounded-xl p-12 w-full max-w-2xl border border-gray-200">
                <h2 className="text-3xl font-bold text-[#1E3A8A] mb-2">
                    Welcome, {employeeName || "Employee"}
                </h2>
                {role && <p className="text-gray-600 mb-6 text-lg">{role}</p>}

                <div className="flex justify-center gap-6 mt-4">
                    <button
                        onClick={() => handleAction("in")}
                        disabled={status === "in"}
                        className={`px-10 py-5 rounded-lg text-xl font-semibold transition-all duration-200 ${status === "in"
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-[#2563EB] text-white hover:bg-[#1E40AF]"
                            }`}
                    >
                        Clock In
                    </button>
                    <button
                        onClick={() => handleAction("out")}
                        disabled={status === "out" || status === null}
                        className={`px-10 py-5 rounded-lg text-xl font-semibold transition-all duration-200 ${status === "out" || status === null
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-[#374151] text-white hover:bg-[#1F2937]"
                            }`}
                    >
                        Clock Out
                    </button>
                </div>

                {/* ✅ Confirmation message */}
                {message && (
                    <p className="mt-8 text-green-600 font-medium text-lg">{message}</p>
                )}
            </div>
        </main>
    );
}
