"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function ManagerDashboard() {
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [filter, setFilter] = useState("today");
    const [loading, setLoading] = useState(false);

    const getDateRange = () => {
        const now = new Date();
        let start: Date;

        if (filter === "today") {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filter === "week") {
            const first = now.getDate() - now.getDay();
            start = new Date(now.setDate(first));
            start.setHours(0, 0, 0, 0);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        return { start, end: new Date() };
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const { start, end } = getDateRange();

            const q = query(collection(db, "logs"));
            const snapshot = await getDocs(q);

            const filtered: any[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                const logTime = data.time?.toDate ? data.time.toDate() : new Date(data.time);
                if (logTime >= start && logTime <= end) {
                    filtered.push({ id: doc.id, ...data, time: logTime });
                }
            });

            setLogs(filtered);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching logs:", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        const currentManager = sessionStorage.getItem("currentManagerEmail");
        if (!currentManager) {
            router.push("/admin/login");
            return;
        }

        fetchLogs();
    }, [filter, router]);

    const handleExportCSV = () => {
        if (!logs.length) return alert("No logs to export.");

        const header = ["Employee", "Type", "Time"];
        const rows = logs.map((log) => [
            log.employeeName,
            log.type,
            log.time.toLocaleString(),
        ]);

        const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `logs-${filter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 🔹 Logout → clears session + redirect to main homepage
    const handleLogout = () => {
        sessionStorage.removeItem("currentManagerEmail");
        router.push("/"); // main page (where employee + manager login live)
    };

    return (
        <main className="p-8 bg-[#F9FAFB] min-h-screen">
            <div className="bg-white p-6 rounded shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-[#1E3A8A]">
                        Manager Dashboard
                    </h1>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-gray-700 text-white rounded-md font-semibold hover:bg-gray-900"
                    >
                        Logout
                    </button>
                </div>

                {/* Filter + Export */}
                <div className="flex flex-wrap gap-4 mb-6">
                    {["today", "week", "month"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md font-semibold ${filter === f
                                ? "bg-[#2563EB] text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}

                    <button
                        onClick={handleExportCSV}
                        className="ml-auto px-4 py-2 bg-[#2563EB] text-white rounded-md font-semibold hover:bg-[#1E40AF]"
                    >
                        Download CSV
                    </button>
                </div>

                {/* Logs Table */}
                {loading ? (
                    <p className="text-gray-600">Loading logs...</p>
                ) : logs.length > 0 ? (
                    <table className="w-full border-collapse border border-gray-200">
                        <thead>
                            <tr className="bg-[#2563EB] text-white">
                                <th className="px-4 py-2">Employee</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={i} className="text-center border-t">
                                    <td className="px-4 py-2">{log.employeeName}</td>
                                    <td className="px-4 py-2 capitalize">{log.type}</td>
                                    <td className="px-4 py-2">{log.time.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-600">No logs for this {filter}.</p>
                )}
            </div>
        </main>
    );
}
