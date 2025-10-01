"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

export default function EmployeeDashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const empId = searchParams.get("empId"); // ✅ comes from login redirect

    const [employeeName, setEmployeeName] = useState<string | null>(null);
    const [status, setStatus] = useState<"in" | "out" | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

            await fetchLogs(empId);
            await fetchLastStatus(empId);

            setLoading(false);
        };

        fetchEmployee();
    }, [empId, router]);

    const fetchLogs = async (empId: string) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const q = query(
            collection(db, "logs"),
            where("employeeId", "==", empId),
            orderBy("time", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        const fetched: any[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.time) {
                const logTime = data.time.toDate ? data.time.toDate() : new Date(data.time);
                if (logTime >= sevenDaysAgo) {
                    fetched.push({ id: doc.id, ...data, time: logTime });
                }
            }
        });

        setLogs(fetched.sort((a, b) => b.time - a.time));
    };

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
            employeeName: employeeName,
            type,
            time: serverTimestamp(),
        });

        setStatus(type);
        fetchLogs(empId);
    };

    const handleLogout = () => {
        setEmployeeName(null);
        setStatus(null);
        setLogs([]);
        router.push("/login");
    };

    if (loading) {
        return (
            <main className="flex items-center justify-center min-h-screen">
                <p className="text-gray-600">Loading...</p>
            </main>
        );
    }

    return (
        <main className="flex flex-col items-center justify-start min-h-screen bg-[#F9FAFB] px-4 py-10">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-lg">
                <h1 className="text-2xl font-bold text-[#1E3A8A] text-center">
                    Welcome, {employeeName}
                </h1>

                {/* Buttons */}
                <div className="flex gap-4 justify-center mt-6">
                    <button
                        onClick={() => handleAction("in")}
                        disabled={status === "in"}
                        className={`px-6 py-3 rounded-md font-semibold ${status === "in"
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-[#2563EB] text-white hover:bg-[#1E40AF]"
                            }`}
                    >
                        Clock In
                    </button>
                    <button
                        onClick={() => handleAction("out")}
                        disabled={status === "out" || status === null}
                        className={`px-6 py-3 rounded-md font-semibold ${status === "out" || status === null
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-[#374151] text-white hover:bg-[#1F2937]"
                            }`}
                    >
                        Clock Out
                    </button>
                </div>

                {/* History */}
                <h2 className="text-xl font-semibold mt-8 mb-4 text-[#1E3A8A]">
                    Your Recent Activity
                </h2>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                    {logs.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-left">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-t">
                                        <td className="px-4 py-2 capitalize">{log.type}</td>
                                        <td className="px-4 py-2">{log.time.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-gray-600 p-4">No logs in last 7 days.</p>
                    )}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="mt-6 w-full py-2 bg-gray-700 text-white rounded-md font-semibold hover:bg-gray-900"
                >
                    Logout
                </button>
            </div>
        </main>
    );
}
