"use client";

import { useState } from "react";

export default function AdminDashboard() {
    const [filter, setFilter] = useState("today");

    const [logs] = useState([
        { employee: "Jhanvi", date: "2025-09-25", clockIn: "09:00 AM", clockOut: "05:00 PM", hours: 8 },
        { employee: "Neil", date: "2025-09-24", clockIn: "10:00 AM", clockOut: "06:00 PM", hours: 8 },
    ]);

    // filter function (demo only)
    const filteredLogs = logs.filter((log) => {
        if (filter === "today") return log.date === "2025-09-25";
        if (filter === "week") return true; // keep all for demo
        if (filter === "month") return true;
        return true;
    });

    const handleExportCSV = () => {
        const csv = [
            ["Employee", "Date", "Clock In", "Clock Out", "Hours Worked"],
            ...filteredLogs.map((log) => [log.employee, log.date, log.clockIn, log.clockOut, log.hours]),
        ]
            .map((row) => row.join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `logs-${filter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        alert("PDF export coming soon 🚀");
    };

    return (
        <main className="p-8 bg-[#F9FAFB] min-h-screen">
            <h1 className="text-2xl font-bold text-[#1E3A8A] mb-6">Manager Dashboard</h1>

            {/* Filter + Export */}
            <div className="flex items-center justify-between mb-4">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="border rounded px-3 py-2"
                >
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                </select>

                <div className="space-x-2">
                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-[#2563EB] text-white rounded hover:bg-[#1E40AF]"
                    >
                        Export CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-900"
                    >
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-white shadow rounded-lg p-6">
                <table className="w-full border-collapse border border-gray-200">
                    <thead>
                        <tr className="bg-[#2563EB] text-white">
                            <th className="px-4 py-2">Employee</th>
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2">Clock In</th>
                            <th className="px-4 py-2">Clock Out</th>
                            <th className="px-4 py-2">Hours Worked</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log, i) => (
                            <tr key={i} className="text-center border-t">
                                <td className="px-4 py-2">{log.employee}</td>
                                <td className="px-4 py-2">{log.date}</td>
                                <td className="px-4 py-2">{log.clockIn}</td>
                                <td className="px-4 py-2">{log.clockOut}</td>
                                <td className="px-4 py-2">{log.hours}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
