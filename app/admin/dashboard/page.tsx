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
import { useRouter } from "next/navigation";

export default function ManagerDashboard() {
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [showEmployeeList, setShowEmployeeList] = useState(false);
    const [timeRange, setTimeRange] = useState<
        "today" | "week" | "biweekly" | "month"
    >("week");
    const [loading, setLoading] = useState(true);

    // 🔹 Fetch employees from logs (get unique employees who have clocked in/out)
    useEffect(() => {
        const fetchEmployees = async () => {
            const logsSnapshot = await getDocs(collection(db, "logs"));
            const uniqueEmployees = new Map();

            logsSnapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.employeeId && data.employeeName) {
                    uniqueEmployees.set(data.employeeId, {
                        employeeId: data.employeeId,
                        name: data.employeeName,
                        role: data.role || "Employee"
                    });
                }
            });

            setEmployees(Array.from(uniqueEmployees.values()));
        };
        fetchEmployees();
    }, []);

    // 🔹 Fetch logs based on time range
    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            const now = new Date();
            let startDate = new Date();

            if (timeRange === "today") startDate.setHours(0, 0, 0, 0);
            else if (timeRange === "week") startDate.setDate(now.getDate() - 7);
            else if (timeRange === "biweekly")
                startDate.setDate(now.getDate() - 14);
            else if (timeRange === "month")
                startDate.setMonth(now.getMonth() - 1);

            const q = query(
                collection(db, "logs"),
                where("time", ">=", Timestamp.fromDate(startDate)),
                orderBy("time", "desc")
            );
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));
            setLogs(fetched);
            setLoading(false);
        };
        fetchLogs();
    }, [timeRange]);

    return (
        <main className="min-h-screen bg-[#F3F4F6] flex justify-center items-start px-6 py-10">
            <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-[1600px] border border-gray-300">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-[#1F2937]">
                        Manager Dashboard
                    </h1>

                    <div className="flex gap-2 flex-wrap">
                        {["today", "week", "biweekly", "month"].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range as any)}
                                className={`px-4 py-2 rounded-md font-semibold capitalize transition ${timeRange === range
                                    ? "bg-[#2563EB] text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                            >
                                {range}
                            </button>
                        ))}

                        <button
                            onClick={() => setShowEmployeeList(!showEmployeeList)}
                            className="bg-[#2563EB] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#1E40AF] transition"
                        >
                            {showEmployeeList ? "Hide" : "Employees"}
                        </button>

                        <button
                            onClick={() => window.location.replace("/login")}
                            className="bg-[#374151] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#1F2937] transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* 👇 Employee List Panel */}
                {showEmployeeList && (
                    <div className="border border-gray-300 rounded-lg p-6 mb-6 bg-gray-50">
                        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                            Select an Employee ({employees.length} total)
                        </h2>
                        {employees.length === 0 ? (
                            <p className="text-gray-500">No employees found. Employees will appear after they clock in/out.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {employees.map((emp) => (
                                    <button
                                        key={emp.employeeId}
                                        onClick={() => {
                                            console.log("Navigating to:", emp.employeeId);
                                            router.push(`/admin/dashboard/${emp.employeeId}`);
                                        }}
                                        className="px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-400 text-gray-800 font-medium transition"
                                    >
                                        {emp.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Activity Table */}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="bg-[#1F2937] text-white px-6 py-3">
                        <h2 className="text-lg font-semibold">Recent Activity</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-700 text-left border-b">
                                    <th className="px-6 py-3 font-semibold">Employee</th>
                                    <th className="px-6 py-3 font-semibold">Type</th>
                                    <th className="px-6 py-3 font-semibold">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="text-center py-8 text-gray-500"
                                        >
                                            Loading...
                                        </td>
                                    </tr>
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="border-t hover:bg-gray-50 transition"
                                        >
                                            <td className="px-6 py-3">
                                                <button
                                                    onClick={() => {
                                                        if (log.employeeId) {
                                                            router.push(`/admin/dashboard/${log.employeeId}`);
                                                        }
                                                    }}
                                                    className="text-[#2563EB] font-semibold hover:underline"
                                                    disabled={!log.employeeId}
                                                >
                                                    {log.employeeName || "Unknown"}
                                                </button>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${log.type === "in"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                        }`}
                                                >
                                                    {log.type === "in"
                                                        ? "Clock In"
                                                        : "Clock Out"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-600">
                                                {log.time?.toDate().toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="text-center py-8 text-gray-500"
                                        >
                                            No logs found for this time period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}