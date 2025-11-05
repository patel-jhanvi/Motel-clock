"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    orderBy,
    query,
    where,
    Timestamp,
    addDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Log = {
    id: string;
    employeeId: string;
    employeeName: string;
    type: "in" | "out";
    time: any; // Timestamp
};

export default function ManagerDashboard() {
    const router = useRouter();
    const [logs, setLogs] = useState<Log[]>([]);
    const [employees, setEmployees] = useState<{ employeeId: string; name: string }[]>([]);
    const [showEmployeeList, setShowEmployeeList] = useState(false);
    const [timeRange, setTimeRange] = useState<"today" | "week" | "biweekly" | "month">("week");
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [manual, setManual] = useState<{
        open: boolean;
        employeeId?: string;
        employeeName?: string;
        date?: string;
        inTime?: string;
        outTime?: string;
        note?: string;
    }>({ open: false });

    // pull employees from logs once
    useEffect(() => {
        (async () => {
            const snap = await getDocs(collection(db, "logs"));
            const uniq = new Map<string, { employeeId: string; name: string }>();
            snap.docs.forEach((d) => {
                const x = d.data() as any;
                if (x.employeeId && x.employeeName) {
                    uniq.set(x.employeeId, { employeeId: x.employeeId, name: x.employeeName });
                }
            });
            setEmployees([...uniq.values()].sort((a, b) => a.name.localeCompare(b.name)));
        })();
    }, []);

    // range fetch
    useEffect(() => {
        (async () => {
            setLoading(true);
            const now = new Date();
            let start = new Date();
            if (timeRange === "today") start.setHours(0, 0, 0, 0);
            else if (timeRange === "week") start.setDate(now.getDate() - 7);
            else if (timeRange === "biweekly") start.setDate(now.getDate() - 14);
            else if (timeRange === "month") start.setMonth(now.getMonth() - 1);

            const qy = query(
                collection(db, "logs"),
                where("time", ">=", Timestamp.fromDate(start)),
                orderBy("time", "desc")
            );
            const snap = await getDocs(qy);
            const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log));
            setLogs(fetched);
            setLoading(false);
        })();
    }, [timeRange]);

    // group by employee
    const grouped = useMemo(() => {
        const m = new Map<string, { employeeId: string; name: string; items: Log[] }>();
        logs.forEach((l) => {
            const key = l.employeeId || l.employeeName || "Unknown";
            if (!m.has(key)) m.set(key, { employeeId: l.employeeId, name: l.employeeName, items: [] });
            m.get(key)!.items.push(l);
        });
        // sort each employee’s items by time desc
        [...m.values()].forEach((g) =>
            g.items.sort((a, b) => b.time.toDate().getTime() - a.time.toDate().getTime())
        );
        // sort employees by name
        return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [logs]);

    const openManual = (empId: string, name: string) =>
        setManual({ open: true, employeeId: empId, employeeName: name, date: "", inTime: "", outTime: "", note: "" });

    const saveManual = async () => {
        if (!manual.employeeId || !manual.employeeName || !manual.date || !manual.inTime || !manual.outTime) return;
        const [y, m, d] = manual.date.split("-").map(Number); // yyyy-mm-dd
        const [inH, inM] = (manual.inTime || "09:00").split(":").map(Number);
        const [outH, outM] = (manual.outTime || "17:00").split(":").map(Number);

        const inDt = new Date(y, m - 1, d, inH, inM, 0, 0);
        const outDt = new Date(y, m - 1, d, outH, outM, 0, 0);

        await addDoc(collection(db, "logs"), {
            employeeId: manual.employeeId,
            employeeName: manual.employeeName,
            type: "in",
            time: Timestamp.fromDate(inDt),
            edited: true,
            managerNote: manual.note || "Backfilled",
        });
        await addDoc(collection(db, "logs"), {
            employeeId: manual.employeeId,
            employeeName: manual.employeeName,
            type: "out",
            time: Timestamp.fromDate(outDt),
            edited: true,
            managerNote: manual.note || "Backfilled",
        });

        // close & refresh
        setManual({ open: false });
        // quick refetch
        const now = new Date();
        let start = new Date();
        if (timeRange === "today") start.setHours(0, 0, 0, 0);
        else if (timeRange === "week") start.setDate(now.getDate() - 7);
        else if (timeRange === "biweekly") start.setDate(now.getDate() - 14);
        else if (timeRange === "month") start.setMonth(now.getMonth() - 1);
        const qy = query(
            collection(db, "logs"),
            where("time", ">=", Timestamp.fromDate(start)),
            orderBy("time", "desc")
        );
        const snap = await getDocs(qy);
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log)));
    };

    return (
        <main className="min-h-screen bg-[#F3F4F6] flex justify-center items-start px-6 py-10">
            <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-[1600px] border border-gray-200">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-[#1F2937]">Manager Dashboard</h1>

                    <div className="flex gap-2 flex-wrap">
                        {["today", "week", "biweekly", "month"].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range as any)}
                                className={`px-4 py-2 rounded-md font-semibold capitalize transition ${timeRange === range ? "bg-[#2563EB] text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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

                {/* Quick employee chooser */}
                {showEmployeeList && (
                    <div className="border border-gray-300 rounded-lg p-6 mb-6 bg-gray-50">
                        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                            Select an Employee ({employees.length})
                        </h2>
                        {employees.length === 0 ? (
                            <p className="text-gray-500">No employees found yet.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {employees.map((emp) => (
                                    <button
                                        key={emp.employeeId}
                                        onClick={() => router.push(`/admin/dashboard/${emp.employeeId}`)}
                                        className="px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-400 text-gray-800 font-medium transition"
                                    >
                                        {emp.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Grouped by employee (like the old kiosk “separate by names”) */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-gray-500">Loading…</div>
                    ) : grouped.length === 0 ? (
                        <div className="text-gray-500">No activity for this range.</div>
                    ) : (
                        grouped.map((g) => (
                            <div key={g.employeeId} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between bg-gray-100 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() =>
                                                setExpanded((e) => ({ ...e, [g.employeeId]: !e[g.employeeId] }))
                                            }
                                            className="font-semibold text-[#2563EB] hover:underline"
                                        >
                                            {expanded[g.employeeId] ? "▾" : "▸"} {g.name}
                                        </button>
                                        <span className="text-sm text-gray-500">({g.items.length} entries)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => router.push(`/admin/dashboard/${g.employeeId}`)}
                                            className="px-3 py-1 rounded-md bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1E40AF]"
                                        >
                                            View Timecard
                                        </button>
                                        <button
                                            onClick={() => openManual(g.employeeId, g.name)}
                                            className="px-3 py-1 rounded-md bg-gray-800 text-white text-sm font-semibold hover:bg-black"
                                        >
                                            Add Manual Entry
                                        </button>
                                    </div>
                                </div>

                                {expanded[g.employeeId] && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-[#1F2937] text-white text-left">
                                                    <th className="px-4 py-2">Type</th>
                                                    <th className="px-4 py-2">Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {g.items.map((log) => (
                                                    <tr key={log.id} className="border-t">
                                                        <td className="px-4 py-2">
                                                            <span
                                                                className={`px-3 py-1 rounded-full text-xs font-semibold ${log.type === "in"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : "bg-red-100 text-red-700"
                                                                    }`}
                                                            >
                                                                {log.type === "in" ? "Clock In" : "Clock Out"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2">{log.time?.toDate().toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Manual backfill modal */}
            {manual.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">Add Manual Entry</h3>
                        <p className="mb-3 text-sm text-gray-600">
                            {manual.employeeName} ({manual.employeeId})
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <label className="col-span-2">
                                <span className="text-sm font-medium">Date</span>
                                <input
                                    type="date"
                                    value={manual.date || ""}
                                    onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Clock In</span>
                                <input
                                    type="time"
                                    value={manual.inTime || ""}
                                    onChange={(e) => setManual((m) => ({ ...m, inTime: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Clock Out</span>
                                <input
                                    type="time"
                                    value={manual.outTime || ""}
                                    onChange={(e) => setManual((m) => ({ ...m, outTime: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                        </div>

                        <label className="block mb-4">
                            <span className="text-sm font-medium">Manager Note (optional)</span>
                            <textarea
                                rows={3}
                                value={manual.note || ""}
                                onChange={(e) => setManual((m) => ({ ...m, note: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                                placeholder="Reason / backfill notes"
                            />
                        </label>

                        <div className="flex gap-3">
                            <button onClick={saveManual} className="flex-1 bg-[#2563EB] text-white rounded-md px-4 py-2 font-semibold">
                                Save
                            </button>
                            <button onClick={() => setManual({ open: false })} className="flex-1 bg-gray-200 rounded-md px-4 py-2 font-semibold">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
