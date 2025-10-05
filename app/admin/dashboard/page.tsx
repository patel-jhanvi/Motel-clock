"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    orderBy,
    query,
    where,
    Timestamp,
} from "firebase/firestore";

export default function ManagerDashboard() {
    const [logs, setLogs] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<"today" | "week" | "biweekly" | "month">("week");
    const [totalHours, setTotalHours] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            const now = new Date();
            let startDate = new Date();

            if (timeRange === "today") startDate.setHours(0, 0, 0, 0);
            else if (timeRange === "week") startDate.setDate(now.getDate() - 7);
            else if (timeRange === "biweekly") startDate.setDate(now.getDate() - 14);
            else if (timeRange === "month") startDate.setMonth(now.getMonth() - 1);

            const q = query(
                collection(db, "logs"),
                where("time", ">=", Timestamp.fromDate(startDate)),
                orderBy("time", "desc")
            );

            const snapshot = await getDocs(q);
            const fetchedLogs = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            setLogs(fetchedLogs);
            setTotalHours(calculateTotalHours(fetchedLogs));
            setLoading(false);
        };

        fetchLogs();
    }, [timeRange]);

    const calculateTotalHours = (logs: any[]) => {
        const map = new Map<string, { totalMs: number; lastIn?: Date }>();

        logs
            .sort((a, b) => a.time.toDate() - b.time.toDate())
            .forEach((log) => {
                const name = log.employeeName || log.employeeId || "Unknown";
                const current = map.get(name) || { totalMs: 0 };

                if (log.type === "in") {
                    current.lastIn = log.time.toDate();
                } else if (log.type === "out" && current.lastIn) {
                    const outTime = log.time.toDate();
                    const diff = outTime.getTime() - current.lastIn.getTime();
                    current.totalMs += diff;
                    current.lastIn = undefined;
                }

                map.set(name, current);
            });

        return Array.from(map.entries()).map(([name, data]) => {
            const totalMinutes = Math.floor(data.totalMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return { name, hours: `${hours}h ${minutes}m` };
        });
    };

    const handleDownloadCSV = () => {
        if (!logs.length) return;

        const sortedLogs = logs.sort((a, b) => a.time.toDate() - b.time.toDate());
        const csvLines: string[] = [
            "Employee Name,Date,Day,Clock In,Clock Out,Duration (hrs:min)",
        ];

        const paired = new Map();

        sortedLogs.forEach((log) => {
            const name = log.employeeName || "Unknown";
            const time = log.time.toDate();

            if (log.type === "in") {
                paired.set(name, { in: time });
            } else if (log.type === "out" && paired.has(name)) {
                const { in: inTime } = paired.get(name);
                const diff = time.getTime() - inTime.getTime();
                const hrs = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                csvLines.push(
                    `${name},${time.toLocaleDateString()},${time.toLocaleDateString("en-US", {
                        weekday: "short",
                    })},${inTime.toLocaleTimeString()},${time.toLocaleTimeString()},${hrs}h ${mins}m`
                );
                paired.delete(name);
            }
        });

        const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ShiftTrack_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <main className="min-h-screen bg-[#F9FAFB] flex justify-center items-start px-10 py-16">
            <div className="bg-white shadow-2xl rounded-2xl p-12 w-[96%] max-w-[1800px] border border-gray-200">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                    <h1 className="text-3xl font-bold text-[#1E3A8A] mb-4 md:mb-0">
                        Manager Dashboard
                    </h1>

                    <div className="flex gap-2 flex-wrap">
                        {["today", "week", "biweekly", "month"].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range as any)}
                                className={`px-5 py-2 rounded-md font-semibold capitalize ${timeRange === range
                                    ? "bg-[#2563EB] text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                            >
                                {range}
                            </button>
                        ))}

                        <button
                            onClick={handleDownloadCSV}
                            className="bg-[#1E3A8A] text-white px-5 py-2 rounded-md font-semibold hover:bg-[#172554] transition"
                        >
                            Download CSV
                        </button>

                        <button
                            onClick={() => window.location.replace("/login")}
                            className="bg-[#374151] text-white px-5 py-2 rounded-md font-semibold hover:bg-[#111827] transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[#2563EB] text-white text-left">
                                <th className="px-5 py-3">Employee</th>
                                <th className="px-5 py-3">Type</th>
                                <th className="px-5 py-3">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-5 text-gray-500">
                                        Loading...
                                    </td>
                                </tr>
                            ) : logs.length > 0 ? (
                                logs.map((log) => (
                                    <tr key={log.id} className="border-t hover:bg-gray-50">
                                        <td className="px-5 py-2">{log.employeeName}</td>
                                        <td className="px-5 py-2 capitalize">{log.type}</td>
                                        <td className="px-5 py-2">
                                            {log.time?.toDate().toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="text-center py-5 text-gray-500">
                                        No logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div className="mt-10">
                    <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">
                        Total Hours by Employee
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {totalHours.map((emp, i) => (
                            <div
                                key={i}
                                className="p-5 border border-gray-200 rounded-lg shadow-sm bg-gray-50 hover:bg-gray-100 transition"
                            >
                                <p className="font-medium text-gray-800">{emp.name}</p>
                                <p className="text-gray-600">{emp.hours}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
