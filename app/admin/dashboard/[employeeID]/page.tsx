"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";

/** ===== Types ===== */
type Log = {
    id: string;
    employeeId: string;
    employeeName: string;
    type: "in" | "out";
    time: any; // Firestore Timestamp
    autoClockOut?: boolean;
    edited?: boolean;
    managerNote?: string;
};

type DayRow = {
    dateISO: string;         // yyyy-mm-dd (local)
    displayDate: string;     // locale date
    in?: Log;
    out?: Log;
    hours: number;
    warning: boolean;
};

/** ===== Date helpers (Sunday–Saturday week) ===== */
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const startOfWeekSun = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay(); // 0 = Sun
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - day);
    return x;
};
const endOfWeekSat = (d: Date) => {
    const s = startOfWeekSun(d);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
};
const weekLabel = (start: Date) => {
    const end = endOfWeekSat(start);
    return `This Week (${fmt(start)} - ${fmt(end)})`;
};

/** Build week dropdown: current week back N weeks */
const buildWeekOptions = (howMany = 16) => {
    const now = new Date();
    const startThis = startOfWeekSun(now);
    const opts: { key: string; start: Date; end: Date; label: string }[] = [];
    for (let i = 0; i < howMany; i++) {
        const s = new Date(startThis);
        s.setDate(startThis.getDate() - 7 * i);
        const e = endOfWeekSat(s);
        opts.push({
            key: `${toISO(s)}_${toISO(e)}`,
            start: s,
            end: e,
            label: i === 0 ? weekLabel(s) : `${fmt(s)} - ${fmt(e)}`,
        });
    }
    return opts;
};

/** ===== robust pairing logic (fixes 0 hrs & cross-midnight) ===== */
const toLocalISODate = (d: Date) => toISO(d);

/**
 * Build daily rows:
 *  - sort ASC
 *  - group by local date
 *  - each day = earliest IN + latest OUT
 *  - if an OUT has no same-day IN but there’s an unmatched previous-day IN within 16h,
 *    attribute the hours to the previous day (overnight shift)
 */
function buildDailyRows(entries: Log[]): DayRow[] {
    const asc = [...entries].sort(
        (a, b) => a.time.toDate().getTime() - b.time.toDate().getTime()
    );
    const byDate = new Map<string, Log[]>();
    for (const lg of asc) {
        const dt = lg.time.toDate();
        const key = toLocalISODate(dt);
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key)!.push(lg);
    }

    let carryIn: Log | undefined; // unmatched previous-day IN
    const keys = [...byDate.keys()].sort();
    const rows: DayRow[] = [];

    for (const key of keys) {
        const list = byDate.get(key)!;
        const displayDate = new Date(key + "T00:00:00").toLocaleDateString();

        const firstIn = list.find((l) => l.type === "in");
        const lastOut = [...list].reverse().find((l) => l.type === "out");

        let useIn = firstIn;
        let useOut = lastOut;
        let warning = !!lastOut?.autoClockOut;

        // cross-midnight stitch: OUT today but only IN yesterday
        if (!useIn && useOut && carryIn) {
            const diff = useOut.time.toDate().getTime() - carryIn.time.toDate().getTime();
            const hours = diff / 3600000;
            if (hours > 0 && hours <= 16) {
                const prevKey = toLocalISODate(carryIn.time.toDate());
                let prevRow = rows.find((r) => r.dateISO === prevKey);
                if (!prevRow) {
                    prevRow = {
                        dateISO: prevKey,
                        displayDate: new Date(prevKey + "T00:00:00").toLocaleDateString(),
                        in: carryIn,
                        out: undefined,
                        hours: 0,
                        warning: !!useOut.autoClockOut,
                    };
                    rows.push(prevRow);
                }
                prevRow.out = useOut;
                prevRow.warning = prevRow.warning || !!useOut.autoClockOut;
                prevRow.hours = Math.max(0, diff / 3600000);

                // current day still shows OUT only (0 hrs)
                rows.push({
                    dateISO: key,
                    displayDate,
                    in: undefined,
                    out: useOut,
                    hours: 0,
                    warning: !!useOut.autoClockOut,
                });

                carryIn = undefined;
                continue;
            }
        }

        // IN but no OUT → keep carry for tomorrow
        if (useIn && !useOut) {
            rows.push({
                dateISO: key,
                displayDate,
                in: useIn,
                out: undefined,
                hours: 0,
                warning: false,
            });
            carryIn = useIn;
            continue;
        }

        // normal same-day
        const row: DayRow = {
            dateISO: key,
            displayDate,
            in: useIn,
            out: useOut,
            hours: 0,
            warning,
        };
        if (useIn && useOut) {
            const ms = useOut.time.toDate().getTime() - useIn.time.toDate().getTime();
            row.hours = ms > 0 ? ms / 3600000 : 0;
        }
        rows.push(row);
        carryIn = useIn && !useOut ? useIn : undefined;
    }

    // newest first for table
    return rows.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
}

/** ===== Page ===== */
export default function EmployeeDetail() {
    const params = useParams();
    const router = useRouter();

    // tolerate [employeeID] vs [employeeId]
    const employeeId = useMemo(() => {
        const raw: any = (params as any)?.employeeID ?? (params as any)?.employeeId;
        return Array.isArray(raw) ? raw[0] : (raw as string | undefined);
    }, [params]);

    const [name, setName] = useState("Loading…");
    const [allRows, setAllRows] = useState<DayRow[]>([]);
    const [loading, setLoading] = useState(true);

    // UI: date pick + week select
    const weekOptions = useMemo(() => buildWeekOptions(16), []);
    const [selectedDate, setSelectedDate] = useState<string>(""); // mm/dd/yyyy
    const [selectedWeekKey, setSelectedWeekKey] = useState<string>(
        `${toISO(startOfWeekSun(new Date()))}_${toISO(endOfWeekSat(new Date()))}`
    );
    const [showAllDates, setShowAllDates] = useState(false);

    // Edit modal
    const [modal, setModal] = useState<{
        open: boolean;
        kind: "in" | "out";
        dateISO?: string;
        logId?: string;
        time?: string; // "HH:MM"
        note?: string;
    }>({ open: false, kind: "out" });

    /** Fetch logs (last 8 weeks window) with robust calc */
    useEffect(() => {
        if (!employeeId) return;
        (async () => {
            setLoading(true);
            const start = new Date();
            start.setDate(start.getDate() - 56);

            // ASC is important for pairing logic
            const qy = query(
                collection(db, "logs"),
                where("employeeId", "==", employeeId),
                where("time", ">=", Timestamp.fromDate(start)),
                orderBy("time", "asc")
            );
            const snap = await getDocs(qy);
            const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log));

            if (entries[0]?.employeeName) setName(entries[0].employeeName);
            else setName("Unknown Employee");

            setAllRows(buildDailyRows(entries));
            setLoading(false);
        })();
    }, [employeeId]);

    /** Filter by selected week unless "Show All Dates" is ON */
    const filteredRows = useMemo(() => {
        if (showAllDates) return allRows;

        const opt = weekOptions.find((o) => o.key === selectedWeekKey);
        if (!opt) return allRows;

        const start = opt.start;
        const end = opt.end;
        return allRows.filter((r) => {
            const d = new Date(`${r.dateISO}T00:00:00`);
            return d >= start && d <= end;
        });
    }, [showAllDates, selectedWeekKey, weekOptions, allRows]);

    /** Per-week REG/OT using rows in view */
    const weeklyStats = useMemo(() => {
        const total = filteredRows.reduce((s, r) => s + r.hours, 0);
        const reg = Math.min(total, 40);
        const ot = Math.max(0, total - 40);
        return { reg, ot, total };
    }, [filteredRows]);

    /** Running Total column (within the week view) */
    const rowsWithRunningTotal = useMemo(() => {
        let running = 0;
        return filteredRows
            .slice()
            .reverse()
            .map((r) => {
                running += r.hours;
                return { ...r, runningTotal: running };
            })
            .reverse();
    }, [filteredRows]);

    /** When a date is picked, snap the drop-down to that date’s week */
    useEffect(() => {
        if (!selectedDate) return;
        const [m, d, y] = selectedDate.split("/").map((x) => parseInt(x, 10));
        const dt = new Date(y, m - 1, d);
        const s = startOfWeekSun(dt);
        const e = endOfWeekSat(dt);
        const key = `${toISO(s)}_${toISO(e)}`;
        setSelectedWeekKey(key);
        setShowAllDates(false);
    }, [selectedDate]);

    /** Edit handlers */
    const openEdit = (kind: "in" | "out", row: DayRow) => {
        const existing = kind === "in" ? row.in : row.out;
        const base = new Date(`${row.dateISO}T00:00:00`);
        const t = existing ? existing.time.toDate() : base;
        const hh = pad2(t.getHours());
        const mm = pad2(t.getMinutes());
        setModal({
            open: true,
            kind,
            dateISO: row.dateISO,
            logId: existing?.id,
            time: `${hh}:${mm}`,
            note: existing?.managerNote || "",
        });
    };

    const refreshRows = async (employeeId: string) => {
        const start = new Date();
        start.setDate(start.getDate() - 56);
        const qy = query(
            collection(db, "logs"),
            where("employeeId", "==", employeeId),
            where("time", ">=", Timestamp.fromDate(start)),
            orderBy("time", "asc")
        );
        const snap = await getDocs(qy);
        const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log));
        if (entries[0]?.employeeName) setName(entries[0].employeeName);
        setAllRows(buildDailyRows(entries));
    };

    const saveEdit = async () => {
        if (!modal.open || !modal.dateISO || !modal.time || !employeeId) return;
        const [H, M] = modal.time.split(":").map(Number);
        const dt = new Date(`${modal.dateISO}T00:00:00`);
        dt.setHours(H, M, 0, 0);

        if (modal.logId) {
            await updateDoc(doc(db, "logs", modal.logId), {
                time: Timestamp.fromDate(dt),
                edited: true,
                managerNote: modal.note || "",
                autoClockOut: false,
            });
        } else {
            await addDoc(collection(db, "logs"), {
                employeeId,
                employeeName: name,
                type: modal.kind,
                time: Timestamp.fromDate(dt),
                edited: true,
                managerNote: modal.note || "Manual add",
                autoClockOut: false,
            });
        }

        await refreshRows(employeeId);
        setModal({ open: false, kind: "out" });
    };

    /** Right-side card “Pay Period” label (two weeks ending this Sat) */
    const payPeriodLabel = useMemo(() => {
        const thisSat = endOfWeekSat(new Date());
        const start = new Date(thisSat);
        start.setDate(thisSat.getDate() - 13); // past 14 days
        return `${fmt(start)} – ${fmt(thisSat)}`;
    }, []);

    return (
        <main className="min-h-screen bg-[#F3F4F6] p-6">
            <div className="max-w-[1200px] mx-auto">
                <button
                    onClick={() => router.push("/admin/dashboard")}
                    className="text-[#2563EB] font-semibold mb-6 hover:underline flex items-center gap-2 text-lg"
                >
                    ← Back to Dashboard
                </button>

                <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-200">
                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-[#1F2937] mb-2">
                                {name}'s Timecard
                            </h1>
                            <p className="text-gray-600">
                                Employee ID:{" "}
                                <span className="font-semibold text-[#2563EB]">
                                    {employeeId}
                                </span>
                            </p>

                            {/* Viewing banner */}
                            {!showAllDates && (
                                <div className="mt-3 border-l-4 border-[#2563EB] bg-blue-50 text-sm text-[#1F2937] px-3 py-2 rounded">
                                    Viewing:&nbsp;
                                    {weekOptions.find((o) => o.key === selectedWeekKey)?.label}
                                </div>
                            )}
                        </div>

                        {/* Right card: Pay period + filters */}
                        <div className="w-full max-w-sm border rounded-xl p-4 bg-gray-50">
                            <div className="text-sm font-semibold text-[#1F2937] mb-2">
                                Pay Period
                            </div>
                            <div className="text-sm bg-white border rounded-md px-3 py-2 mb-4">
                                {payPeriodLabel}
                            </div>

                            {/* Date Picker */}
                            <label className="block mb-3">
                                <span className="text-sm font-medium">Select Date</span>
                                <input
                                    type="text"
                                    inputMode="none"
                                    onFocus={(e) => (e.currentTarget.type = "date")}
                                    onBlur={(e) => (e.currentTarget.type = "text")}
                                    placeholder="mm/dd/yyyy"
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                    onChange={(e) => {
                                        const v = e.target.value; // yyyy-mm-dd from date input
                                        if (!v) {
                                            setSelectedDate("");
                                            return;
                                        }
                                        const [yy, mm, dd] = v.split("-").map(Number);
                                        setSelectedDate(`${mm}/${dd}/${yy}`);
                                    }}
                                />
                            </label>

                            {/* Week select */}
                            <label className="block mb-3">
                                <span className="text-sm font-medium">Select Week</span>
                                <select
                                    className="mt-1 w-full border rounded-md px-3 py-2 bg-white"
                                    value={selectedWeekKey}
                                    onChange={(e) => {
                                        setSelectedWeekKey(e.target.value);
                                        setShowAllDates(false);
                                    }}
                                >
                                    {weekOptions.map((o) => (
                                        <option key={o.key} value={o.key}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button
                                onClick={() => setShowAllDates(true)}
                                className="w-full bg-[#2563EB] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#1E40AF]"
                            >
                                Show All Dates
                            </button>
                        </div>
                    </div>

                    {/* Weekly Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center bg-green-50 p-4 rounded-lg border-2 border-green-200">
                            <p className="text-sm text-gray-700 font-semibold mb-1">
                                REG (this view)
                            </p>
                            <p className="text-3xl font-bold text-[#059669]">
                                {weeklyStats.reg.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-center bg-red-50 p-4 rounded-lg border-2 border-red-200">
                            <p className="text-sm text-gray-700 font-semibold mb-1">
                                OT (this view)
                            </p>
                            <p
                                className={`text-3xl font-bold ${weeklyStats.ot > 0 ? "text-red-600" : "text-gray-400"
                                    }`}
                            >
                                {weeklyStats.ot.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-center bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                            <p className="text-sm text-gray-700 font-semibold mb-1">
                                TOTAL (this view)
                            </p>
                            <p className="text-3xl font-bold text-[#2563EB]">
                                {weeklyStats.total.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border-2 border-gray-200 rounded-lg">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#1F2937] text-white">
                                    <th className="px-6 py-3 text-left">Date</th>
                                    <th className="px-6 py-3 text-left">In</th>
                                    <th className="px-6 py-3 text-left">Out</th>
                                    <th className="px-6 py-3 text-left">Daily Hrs</th>
                                    <th className="px-6 py-3 text-left">Week Total</th>
                                    <th className="px-6 py-3 text-center">Type</th>
                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-gray-500">
                                            Loading…
                                        </td>
                                    </tr>
                                ) : rowsWithRunningTotal.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-gray-500">
                                            No records.
                                        </td>
                                    </tr>
                                ) : (
                                    rowsWithRunningTotal.map((r) => {
                                        const isOT = r.hours > 8;
                                        return (
                                            <tr key={r.dateISO} className="border-t hover:bg-gray-50">
                                                <td className="px-6 py-3">{r.displayDate}</td>
                                                <td className="px-6 py-3">
                                                    {r.in
                                                        ? r.in.time!.toDate().toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                        : "-"}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span>
                                                            {r.out
                                                                ? r.out.time!.toDate().toLocaleTimeString([], {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                })
                                                                : "-"}
                                                        </span>
                                                        {r.warning && (
                                                            <span className="text-red-600 text-xs font-bold px-2 py-1 bg-red-100 rounded">
                                                                ⚠️ AUTO CLOCK-OUT
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 font-semibold">
                                                    {r.hours.toFixed(2)} hrs
                                                </td>
                                                <td className="px-6 py-3 font-semibold">
                                                    {(r as any).runningTotal.toFixed(2)} hrs
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <span
                                                        className={`px-3 py-1 rounded-md text-xs font-bold ${isOT
                                                            ? "bg-red-100 text-red-700"
                                                            : "bg-green-100 text-green-700"
                                                            }`}
                                                    >
                                                        {isOT ? "OT" : "REG"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex gap-2 justify-center">
                                                        <button
                                                            onClick={() => openEdit("in", r)}
                                                            className="text-sm bg-gray-800 text-white px-3 py-2 rounded-md hover:bg-black"
                                                        >
                                                            Edit In
                                                        </button>
                                                        <button
                                                            onClick={() => openEdit("out", r)}
                                                            className="text-sm bg-[#2563EB] text-white px-3 py-2 rounded-md hover:bg-[#1E40AF]"
                                                        >
                                                            Edit Out
                                                        </button>
                                                    </div>
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
            {modal.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-2xl font-bold mb-3">
                            {modal.kind === "in" ? "Edit Clock In" : "Edit Clock Out"}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Date: <span className="font-semibold">{modal.dateISO}</span>
                        </p>

                        <label className="block mb-4">
                            <span className="text-sm font-medium">Time</span>
                            <input
                                type="time"
                                value={modal.time || ""}
                                onChange={(e) =>
                                    setModal((m) => ({ ...m, time: e.target.value }))
                                }
                                className="mt-1 w-full border rounded-md px-3 py-2"
                            />
                        </label>

                        <label className="block mb-6">
                            <span className="text-sm font-medium">Manager Note</span>
                            <textarea
                                rows={3}
                                value={modal.note || ""}
                                onChange={(e) =>
                                    setModal((m) => ({ ...m, note: e.target.value }))
                                }
                                className="mt-1 w-full border rounded-md px-3 py-2"
                                placeholder="Reason for adjustment"
                            />
                        </label>

                        <div className="flex gap-3">
                            <button
                                onClick={saveEdit}
                                className="flex-1 bg-[#059669] text-white px-4 py-2 rounded-md font-semibold"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setModal({ open: false, kind: "out" })}
                                className="flex-1 bg-gray-200 px-4 py-2 rounded-md font-semibold"
                            >
                                Cancel
                            </button>
                        </div>

                        {!modal.logId && (
                            <p className="mt-3 text-xs text-gray-500">
                                No existing {modal.kind === "in" ? "Clock In" : "Clock Out"} for
                                this date — a new entry will be created.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
