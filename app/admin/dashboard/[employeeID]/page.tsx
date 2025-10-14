"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
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
    edited?: boolean;
    managerNote?: string;
    originalTime?: any;
}

interface DailyLog {
    date: string;
    clockIn: Date | null;
    clockOut: Date | null;
    hours: number;
    runningTotal: number;
    hasWarning: boolean;
    logId: string;
    note?: string;
}

/* ===================== Pay Period Helpers (ADD-ON) ===================== */
const startOfWeekSun = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay(); // 0=Sun
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
};

const biweeklyFromWeekStart = (weekStart: Date) => {
    // CHANGE this if your biweekly anchor Sunday differs
    const anchor = startOfWeekSun(new Date("2024-01-07")); // a Sunday anchor
    const thisStart = startOfWeekSun(weekStart);

    const diffDays = Math.floor(
        (thisStart.getTime() - anchor.getTime()) / 86400000
    );
    const weekOffset = Math.floor(diffDays / 7);
    const inOddBlock = weekOffset % 2 !== 0;

    const periodStart = new Date(thisStart);
    if (inOddBlock) periodStart.setDate(periodStart.getDate() - 7);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 13);
    periodEnd.setHours(23, 59, 59, 999);

    return { periodStart, periodEnd };
};

const fmtPayRange = (a: Date, b: Date) => {
    const fmt = (d: Date) =>
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(a)} – ${fmt(b)}`;
};
/* ====================================================================== */

export default function EmployeeDetail() {
    const params = useParams();
    const router = useRouter();

    const employeeId = useMemo(() => {
        const idParam = params?.employeeID || params?.employeeId;
        if (!idParam) return "";
        if (Array.isArray(idParam)) return idParam[0];
        return idParam as string;
    }, [params]);

    const [logs, setLogs] = useState<Log[]>([]);
    const [allDailyLogs, setAllDailyLogs] = useState<DailyLog[]>([]);
    const [employeeName, setEmployeeName] = useState("Loading...");
    const [selectedDate, setSelectedDate] = useState("");
    const [weekOptions, setWeekOptions] = useState<
        Array<{ label: string; start: Date; end: Date }>
    >([]);
    const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
    const [showAllDates, setShowAllDates] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editModal, setEditModal] = useState<{
        show: boolean;
        log: DailyLog | null;
    }>({ show: false, log: null });
    const [editTime, setEditTime] = useState("");
    const [editNote, setEditNote] = useState("");

    // Generate last 30 weeks (Sunday to Saturday pay periods)
    useEffect(() => {
        const weeks: Array<{ label: string; start: Date; end: Date }> = [];
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            // Calculate week start (Sunday)
            const weekStart = new Date(today);
            const daysToSubtract = today.getDay() + i * 7;
            weekStart.setDate(today.getDate() - daysToSubtract);
            weekStart.setHours(0, 0, 0, 0);

            // Calculate week end (Saturday)
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const startStr = `${weekStart.getMonth() + 1}/${weekStart.getDate()}/${weekStart.getFullYear()}`;
            const endStr = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}/${weekEnd.getFullYear()}`;

            weeks.push({
                label:
                    i === 0
                        ? `This Week (${startStr} - ${endStr})`
                        : i === 1
                            ? `Last Week (${startStr} - ${endStr})`
                            : `${i} weeks ago (${startStr} - ${endStr})`,
                start: weekStart,
                end: weekEnd,
            });
        }

        setWeekOptions(weeks);
    }, []);

    useEffect(() => {
        const fetchLogs = async () => {
            if (!employeeId) return;
            try {
                setLoading(true);
                const q = query(collection(db, "logs"), where("employeeId", "==", employeeId));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setEmployeeName("Unknown Employee");
                    setError("No logs found for this employee");
                    setLoading(false);
                    return;
                }

                const entries = snapshot.docs.map((docu) => ({
                    id: docu.id,
                    ...docu.data(),
                })) as Log[];

                // Sort in code instead of in query
                entries.sort((a, b) => a.time.seconds - b.time.seconds);

                setLogs(entries);
                setEmployeeName(entries[0].employeeName || "Unknown Employee");

                const dailyData = processDailyLogs(entries);
                setAllDailyLogs(dailyData);

                setLoading(false);
            } catch (err) {
                setError("Error loading employee data: " + (err as Error).message);
                setEmployeeName("Error");
                setLoading(false);
            }
        };

        fetchLogs();
    }, [employeeId]);

    const processDailyLogs = (logs: Log[]): DailyLog[] => {
        const dailyMap = new Map<string, DailyLog>();

        for (let log of logs) {
            const date = new Date(log.time.seconds * 1000).toLocaleDateString();

            if (!dailyMap.has(date)) {
                dailyMap.set(date, {
                    date,
                    clockIn: null,
                    clockOut: null,
                    hours: 0,
                    runningTotal: 0,
                    hasWarning: false,
                    logId: log.id,
                    note: "",
                });
            }

            const entry = dailyMap.get(date)!;

            if (log.type === "in") {
                entry.clockIn = new Date(log.time.seconds * 1000);
            } else if (log.type === "out") {
                entry.clockOut = new Date(log.time.seconds * 1000);
                entry.logId = log.id; // Use OUT log ID for editing
                entry.hasWarning = log.autoClockOut || false;
                entry.note = log.managerNote || "";
            }
        }

        const result = Array.from(dailyMap.values())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((entry) => {
                if (entry.clockIn && entry.clockOut) {
                    const diffMs = entry.clockOut.getTime() - entry.clockIn.getTime();
                    entry.hours = diffMs / (1000 * 60 * 60);
                }
                return entry;
            });

        return result;
    };

    // Filter logs based on selected week or date
    const getFilteredLogs = () => {
        if (showAllDates) return allDailyLogs;

        if (selectedDate) {
            // Filter by specific date
            return allDailyLogs.filter(
                (log) => log.date === new Date(selectedDate).toLocaleDateString()
            );
        }

        // Filter by selected week
        if (weekOptions.length > 0) {
            const { start, end } = weekOptions[selectedWeekIndex];
            return allDailyLogs.filter((log) => {
                const logDate = new Date(log.date);
                return logDate >= start && logDate <= end;
            });
        }

        return allDailyLogs;
    };

    // Calculate stats with running total
    const calculateStats = (logs: DailyLog[]) => {
        let runningTotal = 0;
        const logsWithRunning = logs.map((log) => {
            runningTotal += log.hours;
            return { ...log, runningTotal };
        });

        const total = runningTotal;
        const reg = total > 40 ? 40 : total;
        const ot = total > 40 ? total - 40 : 0;

        return { logsWithRunning, reg, ot, total };
    };

    const filteredLogs = getFilteredLogs();
    const { logsWithRunning: displayLogs, reg, ot, total } = calculateStats(filteredLogs);

    /* ===================== Pay Period Label (ADD-ON) ===================== */
    const payPeriodLabel = useMemo(() => {
        if (showAllDates || selectedDate) return "";
        const wk = weekOptions[selectedWeekIndex];
        if (!wk) return "";
        const { periodStart, periodEnd } = biweeklyFromWeekStart(wk.start);
        return fmtPayRange(periodStart, periodEnd);
    }, [weekOptions, selectedWeekIndex, showAllDates, selectedDate]);
    /* ===================================================================== */

    const openEditModal = (log: DailyLog) => {
        setEditModal({ show: true, log });
        setEditTime(log.clockOut ? log.clockOut.toTimeString().slice(0, 5) : "17:00");
        setEditNote(log.note || "");
    };

    const saveEdit = async () => {
        if (!editModal.log?.logId) {
            alert("Cannot save: No log ID found");
            return;
        }

        if (!editModal.log.clockOut) {
            alert(
                "This employee hasn't clocked out yet. Cannot edit clock-in only entries."
            );
            return;
        }

        try {
            const logRef = doc(db, "logs", editModal.log.logId);
            const [hours, minutes] = editTime.split(":").map(Number);
            const newDate = new Date(editModal.log.date);
            newDate.setHours(hours, minutes, 0);

            await updateDoc(logRef, {
                time: Timestamp.fromDate(newDate),
                edited: true,
                managerNote: editNote,
                autoClockOut: false, // Remove auto flag when edited
            });

            alert("Time updated successfully!");
            window.location.reload();
        } catch (error) {
            alert("Failed to update time: " + (error as Error).message);
        }
    };

    const formatTime = (date: Date | null) =>
        date
            ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "-";

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
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 border-b pb-6 gap-6">
                        <div>
                            <h1 className="text-4xl font-bold text-[#1F2937] mb-2">
                                {employeeName}'s Timecard
                            </h1>
                            <p className="text-lg text-gray-600">
                                Employee ID:{" "}
                                <span className="font-semibold text-[#2563EB]">{employeeId}</span>
                            </p>
                            {weekOptions[selectedWeekIndex] && !showAllDates && !selectedDate && (
                                <div className="mt-3 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                                    <p className="text-base text-gray-700">
                                        <span className="font-semibold">Viewing:</span>{" "}
                                        {weekOptions[selectedWeekIndex].label}
                                    </p>
                                </div>
                            )}
                            {selectedDate && (
                                <div className="mt-3 bg-green-50 border-l-4 border-green-500 p-3 rounded">
                                    <p className="text-base text-gray-700">
                                        <span className="font-semibold">Viewing Date:</span>{" "}
                                        {new Date(selectedDate).toLocaleDateString()}
                                    </p>
                                </div>
                            )}
                            {showAllDates && (
                                <div className="mt-3 bg-gray-100 border-l-4 border-gray-500 p-3 rounded">
                                    <p className="text-base text-gray-700">
                                        <span className="font-semibold">Viewing:</span> All Time Records
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Date & Week Filters */}
                        <div className="flex flex-col gap-4 bg-gray-50 p-5 rounded-lg border-2 border-gray-300 min-w-[350px]">
                            {/* Pay Period header (ADD-ON) */}
                            {!showAllDates && !selectedDate && payPeriodLabel && (
                                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                                    <p className="text-sm font-semibold text-blue-800">Pay Period</p>
                                    <p className="text-base font-medium text-gray-800">{payPeriodLabel}</p>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-2">
                                    Select Date:
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => {
                                        setSelectedDate(e.target.value);
                                        setShowAllDates(false);
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-2">
                                    Select Week:
                                </label>
                                <select
                                    value={selectedWeekIndex}
                                    onChange={(e) => {
                                        setSelectedWeekIndex(Number(e.target.value));
                                        setSelectedDate("");
                                        setShowAllDates(false);
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-md text-base font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    {weekOptions.map((week, idx) => (
                                        <option key={idx} value={idx}>
                                            {week.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => {
                                    setShowAllDates(true);
                                    setSelectedDate("");
                                }}
                                className="text-sm text-white bg-[#2563EB] px-4 py-2 rounded-md font-semibold hover:bg-[#1E40AF]"
                            >
                                Show All Dates
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="text-center bg-green-50 p-6 rounded-lg border-2 border-green-300 shadow-sm hover:shadow-md transition">
                            <p className="text-sm text-gray-700 font-semibold mb-2">
                                REGULAR HOURS
                            </p>
                            <p className="text-4xl font-bold text-[#059669] mb-1">
                                {reg.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">
                                {showAllDates
                                    ? "All Time"
                                    : selectedDate
                                        ? "Selected Date"
                                        : weekOptions[selectedWeekIndex]?.label.split("(")[0]}
                            </p>
                        </div>
                        <div className="text-center bg-red-50 p-6 rounded-lg border-2 border-red-300 shadow-sm hover:shadow-md transition">
                            <p className="text-sm text-gray-700 font-semibold mb-2">
                                OVERTIME HOURS
                            </p>
                            <p
                                className={`text-4xl font-bold mb-1 ${ot > 0 ? "text-red-600" : "text-gray-400"
                                    }`}
                            >
                                {ot.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">
                                {ot > 0 ? `${((ot / total) * 100).toFixed(1)}% of total` : "No overtime"}
                            </p>
                        </div>
                        <div className="text-center bg-blue-50 p-6 rounded-lg border-2 border-blue-300 shadow-sm hover:shadow-md transition">
                            <p className="text-sm text-gray-700 font-semibold mb-2">
                                TOTAL HOURS
                            </p>
                            <p className="text-4xl font-bold text-[#2563EB] mb-1">
                                {total.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">
                                {displayLogs.length} day{displayLogs.length !== 1 ? "s" : ""} worked
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border-2 border-gray-300 rounded-lg shadow-sm">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#1F2937] text-white">
                                    <th className="px-6 py-4 text-left text-base font-semibold">Date</th>
                                    <th className="px-6 py-4 text-left text-base font-semibold">In</th>
                                    <th className="px-6 py-4 text-left text-base font-semibold">Out</th>
                                    <th className="px-6 py-4 text-left text-base font-semibold">Daily Hrs</th>
                                    <th className="px-6 py-4 text-left text-base font-semibold">
                                        Week Total
                                        <span className="block text-xs font-normal text-gray-300">Running</span>
                                    </th>
                                    <th className="px-6 py-4 text-center text-base font-semibold">Type</th>
                                    <th className="px-6 py-4 text-center text-base font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-xl text-gray-500">
                                            Loading timecard data...
                                        </td>
                                    </tr>
                                ) : displayLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-xl text-gray-500">
                                            No time records found for this period.
                                        </td>
                                    </tr>
                                ) : (
                                    displayLogs.map((log, idx) => {
                                        const isOT = log.runningTotal > 40;
                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-t-2 hover:bg-gray-50 transition ${log.hasWarning ? "bg-red-50 border-red-200" : ""
                                                    }`}
                                            >
                                                <td className="px-6 py-4 text-base font-medium">{log.date}</td>
                                                <td className="px-6 py-4 text-base">{formatTime(log.clockIn)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">{formatTime(log.clockOut)}</span>
                                                        {log.hasWarning && (
                                                            <span className="text-red-600 text-xs font-bold px-3 py-1 bg-red-200 rounded-full border border-red-400 animate-pulse">
                                                                🚩 AUTO CLOCK-OUT
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-base">
                                                    {log.hours.toFixed(2)} hrs
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-base text-gray-700">
                                                    {log.runningTotal.toFixed(2)} hrs
                                                </td>
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
                                                        className="text-sm bg-[#2563EB] text-white px-4 py-2 rounded-md hover:bg-[#1E40AF] font-semibold transition"
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
                        <h3 className="text-2xl font-bold text-[#1F2937] mb-4">
                            {editModal.log.hasWarning ? "🚩 Review Auto Clock-Out" : "Edit Clock Out Time"}
                        </h3>
                        <p className="text-base text-gray-600 mb-6">
                            Date: <strong className="text-[#2563EB]">{editModal.log.date}</strong>
                        </p>

                        {editModal.log.hasWarning && (
                            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
                                <p className="text-red-700 font-semibold text-sm">
                                    ⚠️ This employee was auto-clocked out at 5:00 PM. Please verify or adjust the time.
                                </p>
                            </div>
                        )}

                        <label className="block mb-6">
                            <span className="text-base font-semibold text-gray-700 mb-2 block">
                                Clock Out Time
                            </span>
                            <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="mt-1 block w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </label>

                        <label className="block mb-6">
                            <span className="text-base font-semibold text-gray-700 mb-2 block">
                                Manager Note
                            </span>
                            <textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                rows={4}
                                placeholder="Add reason for adjustment..."
                                className="mt-1 block w-full px-4 py-3 text-base border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </label>

                        <div className="flex gap-4">
                            <button
                                onClick={saveEdit}
                                className="flex-1 bg-[#059669] text-white px-6 py-3 rounded-md text-lg font-semibold hover:bg-[#047857] transition"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setEditModal({ show: false, log: null })}
                                className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-md text-lg font-semibold hover:bg-gray-400 transition"
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
