"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    orderBy,
    query,
    where,
    doc,
    updateDoc,
    Timestamp,
} from "firebase/firestore";

interface Log {
    id: string;
    employeeId: string;
    employeeName: string;
    type: "in" | "out";
    time: any;
    autoClockOut?: boolean;
    managerNote?: string;
}

interface DailyLog {
    date: string;
    clockIn: Date | null;
    clockOut: Date | null;
    hours: number;
    hasWarning: boolean;
    logId: string;
    note?: string;
}

export default function EmployeeDetail() {
    const params = useParams();
    const router = useRouter();
    const employeeId = useMemo(() => {
        const idParam = params?.employeeID || params?.employeeId;
        return Array.isArray(idParam) ? idParam[0] : (idParam as string);
    }, [params]);

    const [logs, setLogs] = useState<Log[]>([]);
    const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
    const [employeeName, setEmployeeName] = useState("Loading...");
    const [weeklyStats, setWeeklyStats] = useState({ reg: 0, ot: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editModal, setEditModal] = useState<{ show: boolean; log: DailyLog | null }>({
        show: false,
        log: null,
    });
    const [editTime, setEditTime] = useState("");
    const [editNote, setEditNote] = useState("");
    const [selectedDate, setSelectedDate] = useState<string>("");

    // Week selector
    const [selectedWeek, setSelectedWeek] = useState<"current" | "last" | "twoAgo">("current");
    const [weekRangeLabel, setWeekRangeLabel] = useState("");

    // Helper: get ISO week number
    const getWeekNumber = (date: Date) => {
        const temp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayNum = (temp.getDay() + 6) % 7;
        temp.setDate(temp.getDate() - dayNum + 3);
        const firstThursday = temp.getTime();
        temp.setMonth(0, 1);
        const janFirstThursday = temp.getTime();
        return 1 + Math.round((firstThursday - janFirstThursday) / (7 * 24 * 3600 * 1000));
    };

    // Compute start/end of week
    const getWeekRange = (offset = 0) => {
        const now = new Date();
        const first = now.getDate() - now.getDay() + 1 - offset * 7;
        const start = new Date(now.setDate(first));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start, end };
    };

    // Fetch logs
    useEffect(() => {
        const fetchLogs = async () => {
            if (!employeeId) {
                setError("No employee ID provided");
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                setError("");

                const q = query(
                    collection(db, "logs"),
                    where("employeeId", "==", employeeId),
                    orderBy("time", "desc")
                );
                const snapshot = await getDocs(q);
                const entries = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Log[];

                if (entries.length > 0 && entries[0].employeeName) {
                    setEmployeeName(entries[0].employeeName);
                }

                let filtered = entries;
                if (selectedDate) {
                    filtered = entries.filter((log) => {
                        const logDate = new Date(log.time.seconds * 1000)
                            .toISOString()
                            .split("T")[0];
                        return logDate === selectedDate;
                    });
                }

                setLogs(filtered);
                const dailyData = processDailyLogs(filtered);
                setDailyLogs(dailyData);
                setWeeklyStats(calculateWeeklyStats(dailyData));
                setLoading(false);
            } catch (err) {
                console.error("Error loading logs:", err);
                setError("Error loading employee data");
                setLoading(false);
            }
        };
        fetchLogs();
    }, [employeeId, selectedDate, selectedWeek]);

    // Process logs → daily
    const processDailyLogs = (logs: Log[]): DailyLog[] => {
        const dailyMap = new Map<string, DailyLog>();
        logs.forEach((log) => {
            const date = new Date(log.time.seconds * 1000).toLocaleDateString();
            const entry = dailyMap.get(date) || {
                date,
                clockIn: null,
                clockOut: null,
                hours: 0,
                hasWarning: false,
                logId: log.id,
                note: "",
            };
            if (log.type === "in") entry.clockIn = new Date(log.time.seconds * 1000);
            if (log.type === "out") {
                entry.clockOut = new Date(log.time.seconds * 1000);
                entry.hasWarning = log.autoClockOut || false;
                entry.note = log.managerNote || "";
            }
            if (entry.clockIn && entry.clockOut)
                entry.hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
            dailyMap.set(date, entry);
        });
        return Array.from(dailyMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    };

    // Filter by week + compute REG/OT
    const calculateWeeklyStats = (dailyLogs: DailyLog[]) => {
        const now = new Date();
        let offset = 0;
        if (selectedWeek === "last") offset = 1;
        if (selectedWeek === "twoAgo") offset = 2;

        const { start, end } = getWeekRange(offset);
        setWeekRangeLabel(
            `${start.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        );

        const weekly = dailyLogs.filter((log) => {
            const date = new Date(log.date);
            return date >= start && date <= end;
        });

        const total = weekly.reduce((sum, log) => sum + log.hours, 0);
        const reg = total > 40 ? 40 : total;
        const ot = total > 40 ? total - 40 : 0;
        return { reg, ot, total };
    };

    // Edit modal
    const openEditModal = (log: DailyLog) => {
        setEditModal({ show: true, log });
        setEditTime(log.clockOut ? log.clockOut.toTimeString().slice(0, 5) : "17:00");
        setEditNote(log.note || "");
    };
    const saveEdit = async () => {
        if (!editModal.log || !editModal.log.logId) return;
        try {
            const logRef = doc(db, "logs", editModal.log.logId);
            const [h, m] = editTime.split(":").map(Number);
            const newDate = new Date(editModal.log.date);
            newDate.setHours(h, m, 0);
            await updateDoc(logRef, {
                time: Timestamp.fromDate(newDate),
                edited: true,
                managerNote: editNote,
                autoClockOut: false,
            });
            alert("Time updated successfully!");
            window.location.reload();
        } catch (err) {
            alert("Failed to update log");
        }
    };
    const formatTime = (d: Date | null) =>
        d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";

    if (error && !loading) {
        return (
            <main className="min-h-screen bg-[#F3F4F6] flex justify-center items-center p-6">
                <div className="bg-white shadow-lg rounded-lg p-8 max-w-md text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
                    <p className="text-gray-700 mb-6">{error}</p>
                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="bg-[#2563EB] text-white px-6 py-2 rounded-md font-semibold hover:bg-[#1E40AF]"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#F3F4F6] p-6">
            <div className="max-w-[1800px] mx-auto">
                <div className="bg-white shadow-lg rounded-lg p-8 border border-gray-300">
                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="text-[#2563EB] font-semibold mb-6 hover:underline flex items-center gap-2 text-lg"
                    >
                        ← Back to Dashboard
                    </button>

                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-8 border-b pb-6 gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-[#1F2937] mb-2">
                                {employeeName}'s Timecard
                            </h1>
                            <p className="text-lg text-gray-600">
                                Employee ID:{" "}
                                <span className="font-semibold text-[#2563EB]">{employeeId}</span>
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col items-center lg:items-end gap-4">
                            <div className="flex items-center gap-3">
                                <label className="text-gray-700 font-semibold">Select Date:</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={new Date().toISOString().split("T")[0]}
                                    className="border border-gray-300 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                                {selectedDate && (
                                    <button
                                        onClick={() => setSelectedDate("")}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="text-gray-700 font-semibold">Select Week:</label>
                                <select
                                    value={selectedWeek}
                                    onChange={(e) => setSelectedWeek(e.target.value as any)}
                                    className="border border-gray-300 px-3 py-2 rounded-md focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="current">This Week</option>
                                    <option value="last">Last Week</option>
                                    <option value="twoAgo">Two Weeks Ago</option>
                                </select>
                                <span className="text-gray-600 text-sm">({weekRangeLabel})</span>
                            </div>

                            <button
                                onClick={() => setSelectedDate("")}
                                className="text-sm text-gray-700 font-semibold underline hover:text-blue-600"
                            >
                                Show All Dates
                            </button>

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-6 lg:min-w-[400px]">
                                <div className="text-center bg-green-50 p-4 rounded-lg border-2 border-green-200">
                                    <p className="text-sm text-gray-700 font-semibold mb-1">REG</p>
                                    <p className="text-3xl font-bold text-[#059669]">
                                        {weeklyStats.reg.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-center bg-red-50 p-4 rounded-lg border-2 border-red-200">
                                    <p className="text-sm text-gray-700 font-semibold mb-1">OT</p>
                                    <p
                                        className={`text-3xl font-bold ${weeklyStats.ot > 0 ? "text-red-600" : "text-gray-400"
                                            }`}
                                    >
                                        {weeklyStats.ot.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-center bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                                    <p className="text-sm text-gray-700 font-semibold mb-1">TOTAL</p>
                                    <p className="text-3xl font-bold text-[#2563EB]">
                                        {weeklyStats.total.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border-2 border-gray-300 rounded-lg">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#1F2937] text-white">
                                    <th className="px-6 py-4 text-left text-lg font-semibold">Date</th>
                                    <th className="px-6 py-4 text-left text-lg font-semibold">In</th>
                                    <th className="px-6 py-4 text-left text-lg font-semibold">Out</th>
                                    <th className="px-6 py-4 text-left text-lg font-semibold">Total</th>
                                    <th className="px-6 py-4 text-center text-lg font-semibold">Type</th>
                                    <th className="px-6 py-4 text-center text-lg font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-xl text-gray-500">
                                            Loading timecard data...
                                        </td>
                                    </tr>
                                ) : dailyLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-xl text-gray-500">
                                            No records found for this selection.
                                        </td>
                                    </tr>
                                ) : (
                                    dailyLogs.map((log, idx) => {
                                        const isOT = log.hours > 40;
                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-t-2 hover:bg-gray-100 transition ${log.hasWarning ? "bg-red-50" : ""
                                                    }`}
                                            >
                                                <td className="px-6 py-4">{log.date}</td>
                                                <td className="px-6 py-4">{formatTime(log.clockIn)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span>{formatTime(log.clockOut)}</span>
                                                        {log.hasWarning && (
                                                            <span className="text-red-600 text-sm font-bold px-2 py-1 bg-red-100 rounded">
                                                                ⚠️ AUTO CLOCK-OUT
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold">{log.hours.toFixed(2)} hrs</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span
                                                        className={`px-4 py-2 rounded-md text-sm font-bold ${isOT
                                                            ? "bg-red-100 text-red-700 border-2 border-red-300"
                                                            : "bg-green-100 text-green-700 border-2 border-green-300"
                                                            }`}
                                                    >
                                                        {isOT ? "OT" : "REG"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => openEditModal(log)}
                                                        className="text-sm bg-[#2563EB] text-white px-4 py-2 rounded-md hover:bg-[#1E40AF] font-semibold"
                                                    >
                                                        View Notes
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editModal.show && editModal.log && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-8 w-full max-w-lg shadow-2xl">
                        <h3 className="text-2xl font-bold text-[#1F2937] mb-4">Edit Clock Out Time</h3>
                        <p className="text-base text-gray-600 mb-6">
                            Date: <strong className="text-[#2563EB]">{editModal.log.date}</strong>
                        </p>
                        <label className="block mb-6">
                            <span className="font-semibold text-gray-700 mb-2 block">
                                Clock Out Time
                            </span>
                            <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="block w-full px-4 py-3 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                        <label className="block mb-6">
                            <span className="font-semibold text-gray-700 mb-2 block">
                                Manager Note
                            </span>
                            <textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                rows={4}
                                placeholder="Add reason for adjustment..."
                                className="block w-full px-4 py-3 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                        <div className="flex gap-4">
                            <button
                                onClick={saveEdit}
                                className="flex-1 bg-[#059669] text-white px-6 py-3 rounded-md text-lg font-semibold hover:bg-[#047857]"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setEditModal({ show: false, log: null })}
                                className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-md text-lg font-semibold hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
