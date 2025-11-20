"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ReactDOM from "react-dom";

import { db } from "@/lib/firebase";
import * as firestore from "firebase/firestore";

const collection = firestore.collection;
const query = firestore.query;
const where = firestore.where;
const orderBy = firestore.orderBy;
const limit = firestore.limit;
const getDocs = firestore.getDocs;
const addDoc = firestore.addDoc;
const updateDoc = firestore.updateDoc;
const deleteDoc = firestore.deleteDoc;
const doc = firestore.doc;
const Timestamp = firestore.Timestamp;
const setDoc = firestore.setDoc;



/** ================= Config ================= */
const ENABLE_ARCHIVE = true;         // copy deletions into logs_archive
const PAYWEEK_START_DOW = 0;         // 0=Sun (ADP default), 1=Mon, ... 6=Sat
const WEEKS_TO_SHOW = 30;            // last 30 weeks listed in the dropdown
const PAY_PERIOD_ANCHOR = new Date(2025, 9, 26); // Oct 26, 2025 (manager’s defined start)
const PAY_PERIOD_DAYS = 14;
const PAY_PERIODS_TO_SHOW = 35;



/** ================= Types ================= */
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
    dateISO: string;
    displayDate: string;
    in?: Log;
    out?: Log;
    hours: number;
    warning: boolean;
};

/** ================= Helpers ================= */
const pad2 = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const tsToDate = (t: any) => (t?.toDate ? t.toDate() : new Date(t));
const msToHours = (ms: number) => Math.max(0, ms / 3600000);

const startOfWeek = (d: Date, weekStartDow = PAYWEEK_START_DOW) => {
    const x = new Date(d);
    const cur = x.getDay();
    const diff = (cur - weekStartDow + 7) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
    return x;
};
const endOfWeekExcl = (weekStart: Date) => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 7); // exclusive
    e.setHours(0, 0, 0, 0);
    return e;
};
const fmtMDY = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
const fmtShort = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const withinExcl = (d: Date, start: Date, endExcl: Date) => d >= start && d < endExcl;
// ✅ Improved calcTotals that handles weekly OT even in pay period
function calcTotals(rows: DayRow[], mode: "week" | "payperiod") {
    if (!rows || rows.length === 0) return { reg: 0, ot: 0, total: 0 };

    // Group rows by week start (Sunday)
    const byWeek = new Map<string, number>();
    for (const r of rows) {
        if (!r.in || !r.out || !r.hours) continue;
        const d = new Date(r.dateISO + "T00:00:00");
        const weekKey = toISO(startOfWeek(d));
        byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + r.hours);
    }

    // Now compute REG and OT per week (each week capped at 40)
    let reg = 0, ot = 0;
    for (const [, hrs] of byWeek) {
        if (hrs > 40) {
            reg += 40;
            ot += hrs - 40;
        } else {
            reg += hrs;
        }
    }

    return { reg, ot, total: reg + ot };
}

/** ================= Small UI piece ================= */

function ActionsMenu({
    row,
    onEditHours,
    onEditIn,
    onEditOut,
    onDeleteIn,
    onDeleteOut,
    onDeleteDay,
}: {
    row: DayRow;
    onEditHours: () => void;
    onEditIn: () => void;
    onEditOut: () => void;
    onDeleteIn: () => void;
    onDeleteOut: () => void;
    onDeleteDay: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [coords, setCoords] = React.useState<{ x: number; y: number } | null>(
        null
    );
    const btnRef = React.useRef<HTMLButtonElement | null>(null);

    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (
                !(e.target as HTMLElement).closest(".action-menu-dropdown") &&
                !(e.target as HTMLElement).closest(".action-btn")
            )
                setOpen(false);
        };
        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, []);

    const openMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (open) {
            setOpen(false);
            return;
        }
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) setCoords({ x: rect.right - 200, y: rect.bottom + window.scrollY });
        setOpen(true);
    };

    const menu = open && coords
        ? ReactDOM.createPortal(
            <div
                style={{
                    position: "absolute",
                    top: coords.y,
                    left: coords.x,
                    zIndex: 9999,
                    width: "200px",
                }}
                className="action-menu-dropdown rounded-md border bg-white shadow-lg"
            >
                <button
                    onClick={() => {
                        setOpen(false);
                        onEditHours();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                    Edit Hours
                </button>
                <div className="my-1 h-px bg-gray-200" />
                <button
                    onClick={() => {
                        setOpen(false);
                        onEditIn();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                    Edit In
                </button>
                <button
                    onClick={() => {
                        setOpen(false);
                        onEditOut();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                    Edit Out
                </button>

                <div className="my-1 h-px bg-gray-200" />

                <button
                    onClick={() => {
                        setOpen(false);
                        onDeleteDay();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                >
                    Delete Day
                </button>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={openMenu}
                className="action-btn px-3 py-1 text-xs font-semibold rounded bg-white border hover:bg-gray-50"
            >
                Actions ▾
            </button>
            {menu}
        </>
    );
}

/** ================= Main ================= */
export default function EmployeeDetail() {
    const params = useParams();
    const router = useRouter();

    const initialEmpId = (params.employeeID ?? params.employeeId) as string;

    const [currentEmployeeId, setCurrentEmployeeId] = useState(initialEmpId);
    const [name, setName] = useState("Loading…");
    const [employees, setEmployees] = useState<{ employeeId: string; name: string }[]>([]);
    const [allRows, setAllRows] = useState<DayRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Right-panel controls
    const [viewMode, setViewMode] = useState<"weekly" | "biweekly">("weekly");
    const [datePicker, setDatePicker] = useState<string>(""); // mm/dd/yyyy via input
    const now = new Date();
    const thisWeekStart = startOfWeek(now);

    // build week options (last 30 weeks)


    const payPeriods = useMemo(() => {
        const out: {
            iso: string;
            start: Date;
            endExcl: Date;
            label: string;
        }[] = [];


        const now = new Date();
        let anchor = new Date(PAY_PERIOD_ANCHOR);

        // move forward until anchor reaches current date
        while (anchor.getTime() + PAY_PERIOD_DAYS * 86400000 < now.getTime()) {
            anchor.setDate(anchor.getDate() + PAY_PERIOD_DAYS);
        }

        // build backwards list of pay periods
        for (let i = 0; i < PAY_PERIODS_TO_SHOW; i++) {
            const start = new Date(anchor);
            start.setDate(anchor.getDate() - i * PAY_PERIOD_DAYS);
            const end = new Date(start);
            end.setDate(start.getDate() + PAY_PERIOD_DAYS - 1);
            out.push({
                iso: toISO(start),
                start,
                endExcl: new Date(end.getTime() + 86400000),
                label: `${fmtMDY(start)} – ${fmtMDY(end)}`,
            });
        }
        return out;
    }, []);
    // ✅ Build week list with pay period linkage
    const weeks = useMemo(() => {
        const out: {
            iso: string;
            start: Date;
            endExcl: Date;
            label: string;
            header: string;
            periodIso: string;
        }[] = [];

        for (const period of payPeriods) {
            let cur = new Date(period.start);
            while (cur < period.endExcl) {
                const s = startOfWeek(cur);
                const e = endOfWeekExcl(s);
                if (s >= period.start && s < period.endExcl) {
                    out.push({
                        iso: toISO(s),
                        start: s,
                        endExcl: e,
                        label: `${fmtMDY(s)} - ${fmtMDY(new Date(e.getTime() - 86400000))}`,
                        header: `${fmtShort(s)} – ${fmtShort(new Date(e.getTime() - 86400000))}`,
                        periodIso: period.iso,
                    });
                }
                cur.setDate(cur.getDate() + 7);
            }
        }
        return out.sort((a, b) => b.start.getTime() - a.start.getTime());
    }, [payPeriods]);
    // ✅ Automatically select current pay period
    useEffect(() => {
        const today = new Date();
        const current = payPeriods.find(
            (p) => withinExcl(today, p.start, p.endExcl)
        );
        if (current) setSelectedPayISO(current.iso);
    }, [payPeriods]);

    const [selectedWeekISO, setSelectedWeekISO] = useState<string | null>(
        weeks[0]?.iso ?? toISO(thisWeekStart)
    );
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const [showAll, setShowAll] = useState(false);

    const [selectedPayISO, setSelectedPayISO] = useState<string | null>(
        payPeriods[0]?.iso ?? null
    );

    /** ===== employees list once ===== */

    useEffect(() => {
        (async () => {
            const uniq = new Map<string, { employeeId: string; name: string }>();

            // Get employees from logs
            const logsSnap = await getDocs(collection(db, "logs"));
            logsSnap.docs.forEach((d) => {
                const x = d.data() as any;
                if (x.employeeId && x.employeeName) {
                    uniq.set(x.employeeId, { employeeId: x.employeeId, name: x.employeeName });
                }
            });

            // Also get employees from employees collection (includes new ones with 0 logs)
            const empSnap = await getDocs(collection(db, "employees"));
            empSnap.docs.forEach((d) => {
                const emp = d.data() as any;
                if (emp.employeeId && emp.name) {
                    // Only add if not already in map, or update if it is
                    uniq.set(emp.employeeId, { employeeId: emp.employeeId, name: emp.name });
                }
            });

            setEmployees([...uniq.values()].sort((a, b) => a.name.localeCompare(b.name)));
        })();
    }, []);

    /** ===== fetch last 30 weeks of logs for employee ===== */
    const earliestWeekStart = useMemo(() => {
        const e = new Date(thisWeekStart);
        e.setDate(e.getDate() - (WEEKS_TO_SHOW - 1) * 7);
        e.setHours(0, 0, 0, 0);
        return e;
    }, [thisWeekStart]);

    const fetchRows = async (empId: string) => {
        if (!empId) return;
        setLoading(true);

        const qy = query(
            collection(db, "logs"),
            where("employeeId", "==", empId),
            where("time", ">=", Timestamp.fromDate(earliestWeekStart))
        );
        const snap = await getDocs(qy);
        const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log));
        entries.sort((a, b) => tsToDate(b.time).getTime() - tsToDate(a.time).getTime());


        // Try to get name from logs first, then from employees collection
        if (entries[0]?.employeeName) {
            setName(entries[0].employeeName);
        } else {
            // Fetch from employees collection if no logs exist yet
            try {
                const empQuery = query(
                    collection(db, "employees"),
                    where("employeeId", "==", empId)
                );
                const empSnap = await getDocs(empQuery);
                if (!empSnap.empty) {
                    const empData = empSnap.docs[0].data();
                    setName(empData.name || empData.employeeName || "Unknown Employee");
                } else {
                    setName("Unknown Employee");
                }
            } catch (err) {
                console.error("Error fetching employee name:", err);
                setName("Unknown Employee");
            }
        }

        // group by date & pair
        const groups = new Map<string, Log[]>();

        for (const lg of entries) {
            const d = tsToDate(lg.time);
            let key = toISO(d);

            // Night shift logic: treat 11 PM - 6 AM as belonging to the shift start date
            if (lg.type === "in" && d.getHours() >= 23) {
                // Clock-in at 11 PM or later stays on its current date (shift start)
                key = toISO(d);
            } else if (lg.type === "out" && d.getHours() < 6) {
                // Clock-out before 6 AM moves to previous day (to match the shift start)
                const prev = new Date(d);
                prev.setDate(prev.getDate() - 1);
                key = toISO(prev);
            } else if (lg.type === "in" && d.getHours() < 6) {
                // Clock-in before 6 AM also moves to previous day (late arrival to night shift)
                const prev = new Date(d);
                prev.setDate(prev.getDate() - 1);
                key = toISO(prev);
            }

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(lg);
        }

        const rows: DayRow[] = [];
        for (const [dateISO, list] of groups) {
            list.sort((a, b) => tsToDate(a.time).getTime() - tsToDate(b.time).getTime());

            const ins: Log[] = [];
            const outs: Log[] = [];
            list.forEach((lg) => (lg.type === "in" ? ins.push(lg) : outs.push(lg)));

            const usedOut = new Set<string>();
            const usedIn = new Set<string>();

            for (const IN of ins) {
                const inTime = tsToDate(IN.time);
                const inMs = inTime.getTime();

                // Find the OUT that comes after this IN
                let bestOut: Log | null = null;
                let bestOutMs = Infinity;

                for (const OUT of outs) {
                    if (usedOut.has(OUT.id)) continue;

                    const outTime = tsToDate(OUT.time);
                    let outMs = outTime.getTime();

                    // If OUT time is before IN time, add 24 hours (overnight shift)
                    if (outMs < inMs) {
                        outMs += 24 * 60 * 60 * 1000;
                    }

                    // Is this OUT after IN and closer than previous matches?
                    if (outMs >= inMs && outMs < bestOutMs) {
                        bestOut = OUT;
                        bestOutMs = outMs;
                    }
                }

                if (bestOut) {
                    usedOut.add(bestOut.id);
                    usedIn.add(IN.id);

                    // Calculate hours with overnight handling
                    let outTimeMs = tsToDate(bestOut.time).getTime();
                    if (outTimeMs < inMs) {
                        outTimeMs += 24 * 60 * 60 * 1000;
                    }

                    rows.push({
                        dateISO,
                        displayDate: inTime.toLocaleDateString(),
                        in: IN,
                        out: bestOut,
                        hours: msToHours(outTimeMs - inMs),
                        warning: !!bestOut.autoClockOut,
                    });
                } else {
                    usedIn.add(IN.id);
                    rows.push({
                        dateISO,
                        displayDate: inTime.toLocaleDateString(),
                        in: IN,
                        hours: 0,
                        warning: false,
                    });
                }
            }

            // Orphaned OUTs
            outs.forEach((O) => {
                if (!usedOut.has(O.id)) {
                    rows.push({
                        dateISO,
                        displayDate: tsToDate(O.time).toLocaleDateString(),
                        out: O,
                        hours: 0,
                        warning: !!O.autoClockOut,
                    });
                }
            });
        }
        setAllRows(rows);
        setLoading(false);
    };
    useEffect(() => {
        fetchRows(currentEmployeeId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentEmployeeId, earliestWeekStart.toISOString()]);

    /** ===== utilities ===== */
    const archiveDoc = async (log?: Log) => {
        if (!ENABLE_ARCHIVE || !log) return;
        try {
            await setDoc(doc(db, "logs_archive", log.id), {
                ...log,
                archivedAt: Timestamp.fromDate(new Date()),
            });
        } catch { }
    };

    const hasOverlap = (dateISO: string, start: Date, end: Date, ignoreIds: string[] = []) => {
        const rowsSameDay = allRows.filter((r) => r.dateISO === dateISO);
        for (const r of rowsSameDay) {
            const inId = r.in?.id;
            const outId = r.out?.id;
            if (ignoreIds.includes(inId || "") || ignoreIds.includes(outId || "")) continue;
            const s = r.in ? tsToDate(r.in.time) : null;
            const e = r.out ? tsToDate(r.out.time) : null;
            if (!s || !e) continue;

            // Handle night shifts: if end time is before start time, add 24 hours
            let adjustedEnd = new Date(e);
            if (e <= s) {
                adjustedEnd = new Date(e.getTime() + 24 * 60 * 60 * 1000);
            }

            // Similarly adjust the time range being checked
            let checkEnd = new Date(end);
            if (end <= start) {
                checkEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
            }

            if (start < adjustedEnd && checkEnd > s) return true;
        }
        return false;
    };

    /** ===== right panel behaviors ===== */
    const selectedWeek = useMemo(() => {
        const w = weeks.find((w) => w.iso === selectedWeekISO) ?? weeks[0];
        return w;
    }, [weeks, selectedWeekISO]);

    // When date is chosen, jump to that week
    const onPickDate = (mmddyyyy: string) => {
        setDatePicker(mmddyyyy);
        const parts = mmddyyyy.split("/");
        if (parts.length === 3) {
            const m = parseInt(parts[0], 10) - 1;
            const d = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y)) {
                const chosen = new Date(y, m, d);
                const weekStart = startOfWeek(chosen);
                const iso = toISO(weekStart);
                setSelectedWeekISO(iso);
                setShowAll(false);
            }
        }
    };

    /** ===== build filtered rows for Weekly / Biweekly / All ===== */
    const biweeklyRange = useMemo(() => {
        if (!selectedWeek) return null;
        const first = selectedWeek.start;
        const secondStart = new Date(first);
        secondStart.setDate(secondStart.getDate() + 7);
        return {
            firstStart: first,
            firstEndExcl: endOfWeekExcl(first),
            secondStart,
            secondEndExcl: endOfWeekExcl(secondStart),
        };
    }, [selectedWeek]);

    const rowsForView = useMemo(() => {
        if (showAll) return allRows;

        if (viewMode === "weekly" || !biweeklyRange) {
            return allRows.filter((r) => {
                const d = new Date(r.dateISO + "T00:00:00");
                return withinExcl(d, selectedWeek.start, selectedWeek.endExcl);
            });
        }

        // biweekly -> include both adjacent weeks
        return allRows.filter((r) => {
            const d = new Date(r.dateISO + "T00:00:00");
            return (
                withinExcl(d, biweeklyRange.firstStart, biweeklyRange.firstEndExcl) ||
                withinExcl(d, biweeklyRange.secondStart, biweeklyRange.secondEndExcl)
            );
        });
    }, [allRows, showAll, viewMode, selectedWeek, biweeklyRange]);
    /** ✅ Filter rows for selected pay period **/
    const rowsForPayPeriod = useMemo(() => {
        const period = payPeriods.find(p => p.iso === selectedPayISO);
        if (!period) return allRows;
        return allRows.filter(r => {
            const d = new Date(r.dateISO + "T00:00:00");
            return withinExcl(d, period.start, period.endExcl);
        });
    }, [allRows, selectedPayISO, payPeriods]);

    /** ===== compute week totals and REG/OT ===== */
    // Map weekStartISO -> total hours in that week
    // ✅ Cumulative week totals reset per pay period or week
    const weekTotals = useMemo(() => {
        const map = new Map<string, number>();
        const activeRows = selectedPayISO ? rowsForPayPeriod : rowsForView;

        // Sort ascending (oldest first) so we can accumulate
        const sorted = [...activeRows].sort(
            (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
        );

        let running = 0;
        for (const r of sorted) {
            if (!r.in || !r.out || r.hours <= 0) continue;

            running += r.hours;
            map.set(r.dateISO, running);
        }
        return map;
    }, [rowsForView, rowsForPayPeriod, selectedPayISO]);



    // ✅ Compute totals dynamically based on week or pay period
    const totals = useMemo(() => {
        if (showAll) return calcTotals(allRows, "payperiod"); // treat as biweekly view

        if (selectedPayISO) {
            const selectedPayPeriod = payPeriods.find(p => p.iso === selectedPayISO);
            if (!selectedPayPeriod) return { reg: 0, ot: 0, total: 0 };

            const filtered = allRows.filter(r => {
                const d = new Date(r.dateISO + "T00:00:00");
                return d >= selectedPayPeriod.start && d < selectedPayPeriod.endExcl;
            });
            return calcTotals(filtered, "payperiod");
        }

        if (selectedWeekISO) {
            const selectedWeek = weeks.find(w => w.iso === selectedWeekISO);
            if (!selectedWeek) return { reg: 0, ot: 0, total: 0 };

            const filtered = allRows.filter(r => {
                const d = new Date(r.dateISO + "T00:00:00");
                return d >= selectedWeek.start && d < selectedWeek.endExcl;
            });
            return calcTotals(filtered, "week");
        }

        return { reg: 0, ot: 0, total: 0 };
    }, [showAll, selectedPayISO, selectedWeekISO, allRows, weeks, payPeriods]);



    /** ===== per-row helpers ===== */
    const weekTotalForRow = (row: DayRow) => {
        return weekTotals.get(row.dateISO) || 0;
    };

    /** ===== add/edit/delete ===== */
    const [quickAdd, setQuickAdd] = useState<{ open: boolean; date?: string; start?: string; hours?: string; note?: string; }>({ open: false });
    const [manualAdd, setManualAdd] = useState<{ open: boolean; date?: string; inTime?: string; outTime?: string; note?: string; }>({ open: false });
    const [editHours, setEditHours] = useState<{ open: boolean; row?: DayRow; hours?: string; note?: string; }>({ open: false });
    const [editTs, setEditTs] = useState<{ open: boolean; kind: "in" | "out"; row?: DayRow; time?: string; note?: string; }>({ open: false, kind: "in" });
    const [noteView, setNoteView] = useState<{ open: boolean; text?: string }>({ open: false });

    const saveQuickHours = async () => {
        if (!quickAdd.date || !quickAdd.hours) return;
        const [y, m, d] = quickAdd.date.split("-").map(Number); // yyyy-mm-dd
        const [sh, sm] = (quickAdd.start || "09:00").split(":").map(Number);
        const hrs = Math.max(0, parseFloat(quickAdd.hours || "0"));
        const start = new Date(y, m - 1, d, sh, sm, 0, 0);
        const end = new Date(start.getTime() + hrs * 3600000);
        const note = (quickAdd.note || "Manual hours").trim();
        if (hasOverlap(toISO(start), start, end)) {
            alert("New hours overlap with existing entries for this day.");
            return;
        }
        await addDoc(collection(db, "logs"), { employeeId: currentEmployeeId, employeeName: name, type: "in", time: Timestamp.fromDate(start), edited: true, managerNote: note, autoClockOut: false });
        await addDoc(collection(db, "logs"), { employeeId: currentEmployeeId, employeeName: name, type: "out", time: Timestamp.fromDate(end), edited: true, managerNote: note, autoClockOut: false });
        setQuickAdd({ open: false });
        await fetchRows(currentEmployeeId);
    };
    const saveManualAdd = async () => {
        if (!manualAdd.date || !manualAdd.inTime || !manualAdd.outTime) return;

        const [y, m, d] = manualAdd.date.split("-").map(Number);
        const [inH, inM] = (manualAdd.inTime || "09:00").split(":").map(Number);
        const [outH, outM] = (manualAdd.outTime || "17:00").split(":").map(Number);

        const inDt = new Date(y, m - 1, d, inH, inM, 0, 0);
        let outDt = new Date(y, m - 1, d, outH, outM, 0, 0);

        // ✅ Handle overnight shifts: if out time <= in time, it's next day
        if (outDt <= inDt || outH < inH || (outH === inH && outM <= inM)) {
            outDt.setDate(outDt.getDate() + 1);
        }

        const note = (manualAdd.note || "Manual entry").trim();

        // ✅ No overlap check for now - just create the entries
        await addDoc(collection(db, "logs"), {
            employeeId: currentEmployeeId,
            employeeName: name,
            type: "in",
            time: Timestamp.fromDate(inDt),
            edited: true,
            managerNote: note,
            autoClockOut: false
        });

        await addDoc(collection(db, "logs"), {
            employeeId: currentEmployeeId,
            employeeName: name,
            type: "out",
            time: Timestamp.fromDate(outDt),
            edited: true,
            managerNote: note,
            autoClockOut: false
        });

        setManualAdd({ open: false });
        await fetchRows(currentEmployeeId);
    };


    const saveEditHours = async () => {
        if (!editHours.row || !editHours.hours) return;
        const hrs = parseFloat(editHours.hours);
        if (hrs <= 0) return;
        const row = editHours.row;
        const note = (editHours.note || "Hours adjusted").trim();

        if (row.in) await archiveDoc(row.in);
        if (row.out) await archiveDoc(row.out);
        if (row.in) await deleteDoc(doc(db, "logs", row.in.id));
        if (row.out) await deleteDoc(doc(db, "logs", row.out.id));

        const [y, m, d] = row.dateISO.split("-").map(Number);
        const start = new Date(y, m - 1, d, 9, 0, 0, 0);
        const end = new Date(start.getTime() + hrs * 3600000);
        if (hasOverlap(row.dateISO, start, end)) { alert("Adjusted hours overlap with another interval on this day."); return; }

        await addDoc(collection(db, "logs"), { employeeId: currentEmployeeId, employeeName: name, type: "in", time: Timestamp.fromDate(start), edited: true, managerNote: note, autoClockOut: false });
        await addDoc(collection(db, "logs"), { employeeId: currentEmployeeId, employeeName: name, type: "out", time: Timestamp.fromDate(end), edited: true, managerNote: note, autoClockOut: false });

        setEditHours({ open: false });
        await fetchRows(currentEmployeeId);
    };

    // === Edit modal open ===
    const openEditTs = (kind: "in" | "out", row: DayRow) => {
        const ref = kind === "in" ? row.in : row.out;
        const base = ref ? tsToDate(ref.time) : new Date(`${row.dateISO}T00:00:00`);
        const hh = pad2(base.getHours());
        const mm = pad2(base.getMinutes());
        setEditTs({ open: true, kind, row, time: `${hh}:${mm}`, note: ref?.managerNote || "" });
    };

    // === Save edit timestamp ===
    // === Save edit timestamp ===
    const saveEditTs = async () => {
        if (!editTs.open || !editTs.row || !editTs.time) return;

        const [H, M] = editTs.time.split(":").map(Number);
        const [y, m, d] = editTs.row.dateISO.split("-").map(Number);
        let when = new Date(y, m - 1, d, H, M, 0, 0);

        // ✅ Handle night-shift timestamps
        if (editTs.kind === "out" && H < 6) {
            // Clock-out before 6 AM → belongs to next day
            when.setDate(when.getDate() + 1);
        }
        // NOTE: Clock-in at/after 11 PM stays on the dateISO (which is already the shift start date)
        // No adjustment needed because the grouping logic already put it on the right date

        const note = (editTs.note || "Timestamp adjusted").trim();
        const target = editTs.kind === "in" ? editTs.row.in : editTs.row.out;

        try {
            if (target && target.id) {
                // ✅ Update existing log
                console.log("✅ Updating existing log:", target.id, "to", when.toString());
                await updateDoc(doc(db, "logs", target.id), {
                    time: Timestamp.fromDate(when),
                    edited: true,
                    managerNote: note,
                    autoClockOut: false,
                });
            } else {
                // ✅ Create new log
                console.log("✅ Creating new log:", editTs.kind, "at", when.toString());
                await addDoc(collection(db, "logs"), {
                    employeeId: currentEmployeeId,
                    employeeName: name,
                    type: editTs.kind,
                    time: Timestamp.fromDate(when),
                    edited: true,
                    managerNote: note,
                    autoClockOut: false,
                });
            }

            setEditTs({ open: false, kind: "in" });
            await fetchRows(currentEmployeeId);
        } catch (err) {
            console.error("❌ Error saving edit:", err);
            alert("Error: " + (err as Error).message);
        }
    };




    const deleteSingle = async (which: "in" | "out", row: DayRow) => {
        const log = which === "in" ? row.in : row.out;
        if (!log) return;
        if (!confirm(`Delete ${which.toUpperCase()} for ${row.displayDate}?`)) return;
        await archiveDoc(log);
        await deleteDoc(doc(db, "logs", log.id));
        await fetchRows(currentEmployeeId);
    };

    const deleteDay = async (row: DayRow) => {
        if (!confirm(`Delete all entries for ${row.displayDate}?`)) return;
        if (row.in) { await archiveDoc(row.in); await deleteDoc(doc(db, "logs", row.in.id)); }
        if (row.out) { await archiveDoc(row.out); await deleteDoc(doc(db, "logs", row.out.id)); }
        await fetchRows(currentEmployeeId);
    };

    /** ===== export (respect current view) ===== */
    const exportCSV = async () => {
        // Fetch holidays
        const holidaysSnap = await getDocs(collection(db, "holidays"));
        const holidays = new Map<string, string>();
        holidaysSnap.docs.forEach((d) => {
            const data = d.data();
            if (data.isPaid) {
                holidays.set(data.date, data.name);
            }
        });

        // Get the rows to export
        const rows = selectedPayISO ? rowsForPayPeriod : rowsForView;

        // Calculate totals
        const { reg, ot, total } = totals;

        // Count holiday hours
        let holidayHours = 0;
        rows.forEach((r) => {
            if (holidays.has(r.dateISO) && r.hours > 0) {
                holidayHours += r.hours;
            }
        });

        // Get pay period info for header
        let periodLabel = "";
        if (selectedPayISO) {
            const period = payPeriods.find((p) => p.iso === selectedPayISO);
            if (period) {
                periodLabel = `${fmtMDY(period.start)} - ${fmtMDY(new Date(period.endExcl.getTime() - 86400000))}`;
            }
        } else if (selectedWeekISO) {
            const week = weeks.find((w) => w.iso === selectedWeekISO);
            if (week) {
                periodLabel = `${fmtMDY(week.start)} - ${fmtMDY(new Date(week.endExcl.getTime() - 86400000))}`;
            }
        }

        const lines: string[] = [];

        // Title section
        lines.push("EMPLOYEE TIMECARD");
        lines.push("");
        lines.push(`Employee Name:,${name}`);
        lines.push(`Employee ID:,${currentEmployeeId}`);
        if (periodLabel) {
            lines.push(`Pay Period:,${periodLabel}`);
        }
        lines.push("");
        lines.push("");

        // Table header
        lines.push("DATE,DAY,HOURS,HOLIDAY");
        lines.push(",,,,"); // Separator line for visual clarity

        // Sort rows by date (oldest first)
        const sortedRows = [...rows].sort((a, b) => a.dateISO.localeCompare(b.dateISO));

        // Add each row
        sortedRows.forEach((r) => {
            const date = new Date(r.dateISO + "T00:00:00");
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            const dateStr = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

            const dailyHrs = r.hours.toFixed(2);
            const holidayName = holidays.has(r.dateISO) ? holidays.get(r.dateISO) : "";

            lines.push(`${dateStr},${dayName},${dailyHrs},${holidayName}`);
        });

        // Summary section
        lines.push("");
        lines.push("");
        lines.push("HOURS SUMMARY");
        lines.push(",,,,");
        lines.push(`Regular Hours (REG):,,${reg.toFixed(2)}`);
        lines.push(`Overtime Hours (OT):,,${ot.toFixed(2)}`);
        lines.push(`Holiday Hours:,,${holidayHours.toFixed(2)}`);
        lines.push(",,,,");
        lines.push(`TOTAL HOURS:,,${total.toFixed(2)}`);

        // Create and download
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const nameSuffix = selectedPayISO
            ? `payperiod_${selectedPayISO}`
            : selectedWeekISO
                ? `week_${selectedWeekISO}`
                : "all_dates";

        a.download = `Timecard_${name.replace(/\s+/g, "_")}_${currentEmployeeId}_${nameSuffix}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /** ================= UI ================= */
    return (
        <main className="min-h-screen bg-[#F6F7FB] p-6">
            <div className="max-w-[1400px] mx-auto">

                <button
                    onClick={() => router.push("/admin/dashboard")}
                    className="text-[#2563EB] font-semibold mb-6 hover:underline flex items-center gap-2 text-lg"
                >
                    ← Back to Dashboard
                </button>
                {/* ✅ Top bar: Back + Select Employee */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">


                    <div className="w-full md:w-[420px]">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Select Employee
                        </label>
                        <select
                            value={currentEmployeeId}
                            onChange={(e) => {
                                setCurrentEmployeeId(e.target.value);
                                router.push(`/admin/dashboard/${e.target.value}`);
                            }}
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base font-medium bg-white focus:ring-2 focus:ring-blue-500"
                        >
                            {employees.map((emp) => (
                                <option key={emp.employeeId} value={emp.employeeId}>
                                    {emp.name} ({emp.employeeId})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-white shadow-xl rounded-2xl border border-gray-200 p-6 md:p-8">
                    {/* Header: Name + right panel */}
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Left: Title + cards */}
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight text-[#1F2937] mb-2">
                                {name.toUpperCase()}'s Timecard
                            </h1>
                            <p className="text-gray-600 mb-4">
                                Employee ID:{" "}
                                <span className="font-semibold text-[#2563EB]">{currentEmployeeId}</span>
                            </p>

                            {/* Viewing banner */}
                            {!showAll && (
                                <div className="mb-4">
                                    <div className="text-sm px-3 py-2 rounded-md bg-blue-50 text-blue-700 inline-block border border-blue-200">
                                        {selectedPayISO ? (() => {
                                            const p = payPeriods.find(x => x.iso === selectedPayISO);
                                            if (!p) return "Viewing Pay Period (invalid)";
                                            return `Viewing Pay Period (${fmtMDY(p.start)} – ${fmtMDY(new Date(p.endExcl.getTime() - 86400000))})`;
                                        })()
                                            : selectedWeekISO ? (() => {
                                                const w = weeks.find(x => x.iso === selectedWeekISO);
                                                if (!w) return "Viewing Week (invalid)";
                                                return `Viewing Week (${fmtMDY(w.start)} – ${fmtMDY(new Date(w.endExcl.getTime() - 86400000))})`;
                                            })()
                                                : `Viewing: ${viewMode === "weekly" ? "This Week" : "Biweekly"}`}
                                    </div>
                                </div>
                            )}



                            {/* Cards */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="text-center bg-green-50 p-4 rounded-lg border-2 border-green-200">
                                    <p className="text-xs text-gray-700 font-semibold mb-1">REG {showAll ? "" : "(this view)"}</p>
                                    <p className="text-2xl font-bold text-[#059669]">{totals.reg.toFixed(2)}</p>
                                </div>

                                <div className="text-center bg-red-50 p-4 rounded-lg border-2 border-red-200">
                                    <p className="text-xs text-gray-700 font-semibold mb-1">OT {showAll ? "" : "(this view)"}</p>
                                    <p className={`text-2xl font-bold ${totals.ot > 0 ? "text-red-600" : "text-gray-400"}`}>
                                        {totals.ot.toFixed(2)}
                                    </p>
                                </div>

                                <div className="text-center bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                                    <p className="text-xs text-gray-700 font-semibold mb-1">TOTAL {showAll ? "" : "(this view)"}</p>
                                    <p className="text-2xl font-bold text-[#2563EB]">{totals.total.toFixed(2)}</p>
                                </div>
                            </div>


                            {/* Table */}
                            <div className="overflow-x-auto border-2 border-gray-200 rounded-lg relative overflow-visible">
                                <table className="w-full border-collapse relative z-0">

                                    <thead>
                                        <tr className="bg-[#1F2937] text-white">
                                            <th className="px-6 py-3 text-left">Date</th>
                                            <th className="px-6 py-3 text-left">In</th>
                                            <th className="px-6 py-3 text-left">Out</th>
                                            <th className="px-6 py-3 text-left">Daily Hrs</th>
                                            <th className="px-6 py-3 text-left">Week Total</th>
                                            <th className="px-6 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="relative z-0 overflow-visible">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-10 text-gray-500">
                                                    Loading…
                                                </td>
                                            </tr>
                                        ) : (selectedPayISO ? rowsForPayPeriod.length === 0 : rowsForView.length === 0) ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-10 text-gray-500">
                                                    No records{showAll ? "" : " in this pay period"}.
                                                </td>
                                            </tr>
                                        ) : (
                                            (selectedPayISO ? rowsForPayPeriod : rowsForView).map((r, idx) => {
                                                const hasNote = !!(r.in?.managerNote || r.out?.managerNote);
                                                return (

                                                    <tr
                                                        key={idx}
                                                        className={`border-t hover:bg-gray-50 ${r.warning ? "bg-red-50" : ""} relative overflow-visible`}
                                                    >

                                                        <td className="px-6 py-3">{r.displayDate}</td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span>
                                                                    {r.in
                                                                        ? tsToDate(r.in.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                                        : "-"}
                                                                </span>
                                                                {r.in?.edited && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                        Edited
                                                                    </span>
                                                                )}
                                                                {r.in?.managerNote && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                                        Manual
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span>
                                                                    {r.out
                                                                        ? tsToDate(r.out.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                                        : r.in
                                                                            ? "Still clocked in"
                                                                            : "-"}
                                                                </span>
                                                                {r.warning && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-200 text-red-800 border border-red-300">
                                                                        Auto
                                                                    </span>
                                                                )}
                                                                {r.out?.edited && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                        Edited
                                                                    </span>
                                                                )}
                                                                {hasNote && (
                                                                    <button
                                                                        onClick={() =>
                                                                            setNoteView({
                                                                                open: true,
                                                                                text: r.out?.managerNote || r.in?.managerNote,
                                                                            })
                                                                        }
                                                                        className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800"
                                                                    >
                                                                        Manager note
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 font-semibold">{r.hours.toFixed(2)} hrs</td>
                                                        <td className="px-6 py-3">{weekTotalForRow(r).toFixed(2)} hrs</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <ActionsMenu
                                                                row={r}
                                                                onEditHours={() => setEditHours({ open: true, row: r, hours: r.hours.toFixed(2) })}
                                                                onEditIn={() => openEditTs("in", r)}
                                                                onEditOut={() => openEditTs("out", r)}
                                                                onDeleteIn={() => deleteSingle("in", r)}
                                                                onDeleteOut={() => deleteSingle("out", r)}
                                                                onDeleteDay={() => deleteDay(r)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right panel (calendar-like controls) */}
                        <div className="w-full lg:w-[420px]">
                            <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
                                <h3 className="text-lg font-semibold mb-4">Pay Period</h3>



                                {/* Select Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">
                                        Select Date
                                    </label>
                                    <input
                                        type="date"  // 👈 this gives you a native calendar picker
                                        value={selectedDate ?? ""}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                {/* ✅ Select Pay Period dropdown */}
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Pay Period
                                </label>
                                <select
                                    value={selectedPayISO ?? ""}
                                    onChange={(e) => {
                                        setSelectedPayISO(e.target.value);
                                        setSelectedWeekISO(null);
                                        setShowAll(false);
                                    }}
                                    className="w-full border rounded-md px-3 py-2 mb-4 bg-white"
                                >
                                    {payPeriods.map((p, idx) => (
                                        <option key={p.iso} value={p.iso}>
                                            {`Pay Period ${idx + 1}: ${p.label}`}
                                        </option>
                                    ))}
                                </select>
                                {/* Select Week dropdown */}
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Week
                                </label>
                                <select
                                    value={selectedWeekISO ?? ""}
                                    onChange={(e) => {

                                        setSelectedWeekISO(e.target.value);
                                        setSelectedPayISO(null);  // 👈 clear pay period
                                        setShowAll(false);


                                    }}
                                    className="w-full border rounded-md px-3 py-2 mb-4 bg-white"
                                >
                                    {weeks.map((w, idx) => (
                                        <option key={w.iso} value={w.iso}>
                                            {idx === 0 ? w.label : `${fmtMDY(w.start)} - ${fmtMDY(new Date(w.endExcl.getTime() - 86400000))}`}
                                        </option>
                                    ))}
                                </select>

                                {/* Weekly / Biweekly toggle */}
                                <div className="flex items-center gap-2 mb-4">
                                    <button
                                        onClick={() => { setViewMode("weekly"); setShowAll(false); }}
                                        className={`flex-1 px-3 py-2 rounded-md font-semibold border ${viewMode === "weekly" ? "bg-[#2563EB] text-white border-[#1E40AF]" : "bg-white"
                                            }`}
                                    >
                                        Weekly
                                    </button>
                                    <button
                                        onClick={() => { setViewMode("biweekly"); setShowAll(false); }}
                                        className={`flex-1 px-3 py-2 rounded-md font-semibold border ${viewMode === "biweekly" ? "bg-[#2563EB] text-white border-[#1E40AF]" : "bg-white"
                                            }`}
                                    >
                                        Biweekly
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowAll(true)}
                                    className="w-full bg-[#2563EB] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#1E40AF] transition mb-2"
                                >
                                    Show All Dates
                                </button>

                                {/* Actions under panel */}
                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        onClick={() => setQuickAdd({ open: true })}
                                        className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-md font-semibold"
                                    >
                                        + Quick Add
                                    </button>
                                    <button
                                        onClick={() => setManualAdd({ open: true })}
                                        className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-md font-semibold"
                                    >
                                        Manual In/Out
                                    </button>
                                </div>
                                <button
                                    onClick={exportCSV}
                                    className="w-full mt-3 bg-white border px-4 py-2 rounded-md font-semibold hover:bg-gray-50"
                                >
                                    Export CSV
                                </button>
                            </div>


                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Add Modal */}
            {quickAdd.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-2xl font-bold mb-4">Quick Add Hours</h3>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <label className="col-span-2">
                                <span className="text-sm font-medium">Date</span>
                                <input
                                    type="date"
                                    value={quickAdd.date || ""}
                                    onChange={(e) => setQuickAdd((q) => ({ ...q, date: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Start Time</span>
                                <input
                                    type="time"
                                    value={quickAdd.start || "09:00"}
                                    onChange={(e) => setQuickAdd((q) => ({ ...q, start: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Total Hours</span>
                                <input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    value={quickAdd.hours || ""}
                                    onChange={(e) => setQuickAdd((q) => ({ ...q, hours: e.target.value }))}
                                    placeholder="7.5"
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                        </div>
                        <label className="block mb-4">
                            <span className="text-sm font-medium">Note</span>
                            <textarea
                                rows={3}
                                value={quickAdd.note || ""}
                                onChange={(e) => setQuickAdd((q) => ({ ...q, note: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                            />
                        </label>
                        <div className="flex gap-3">
                            <button onClick={saveQuickHours} className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-md font-semibold">
                                Save
                            </button>
                            <button onClick={() => setQuickAdd({ open: false })} className="flex-1 bg-gray-200 px-4 py-2 rounded-md font-semibold">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Add Modal */}
            {manualAdd.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-2xl font-bold mb-4">Add Manual In/Out</h3>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <label className="col-span-2">
                                <span className="text-sm font-medium">Date</span>
                                <input
                                    type="date"
                                    value={manualAdd.date || ""}
                                    onChange={(e) => setManualAdd((m) => ({ ...m, date: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Clock In</span>
                                <input
                                    type="time"
                                    value={manualAdd.inTime || ""}
                                    onChange={(e) => setManualAdd((m) => ({ ...m, inTime: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                            <label>
                                <span className="text-sm font-medium">Clock Out</span>
                                <input
                                    type="time"
                                    value={manualAdd.outTime || ""}
                                    onChange={(e) => setManualAdd((m) => ({ ...m, outTime: e.target.value }))}
                                    className="mt-1 w-full border rounded-md px-3 py-2"
                                />
                            </label>
                        </div>
                        <label className="block mb-4">
                            <span className="text-sm font-medium">Note</span>
                            <textarea
                                rows={3}
                                value={manualAdd.note || ""}
                                onChange={(e) => setManualAdd((m) => ({ ...m, note: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                            />
                        </label>
                        <div className="flex gap-3">
                            <button onClick={saveManualAdd} className="flex-1 bg-[#2563EB] text-white px-4 py-2 rounded-md font-semibold">
                                Save
                            </button>
                            <button onClick={() => setManualAdd({ open: false })} className="flex-1 bg-gray-200 px-4 py-2 rounded-md font-semibold">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Hours Modal */}
            {editHours.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-2xl font-bold mb-4">Edit Hours Directly</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Date: <strong>{editHours.row?.displayDate}</strong>
                        </p>
                        <label className="block mb-4">
                            <span className="text-sm font-medium">Total Hours</span>
                            <input
                                type="number"
                                step="0.25"
                                min="0"
                                value={editHours.hours || ""}
                                onChange={(e) => setEditHours((e2) => ({ ...e2, hours: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                            />
                        </label>
                        <label className="block mb-4">
                            <span className="text-sm font-medium">Note</span>
                            <textarea
                                rows={3}
                                value={editHours.note || ""}
                                onChange={(e) => setEditHours((e2) => ({ ...e2, note: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                            />
                        </label>
                        <div className="flex gap-3">
                            <button onClick={saveEditHours} className="flex-1 bg-[#059669] text-white px-4 py-2 rounded-md font-semibold">
                                Save
                            </button>
                            <button onClick={() => setEditHours({ open: false })} className="flex-1 bg-gray-200 px-4 py-2 rounded-md font-semibold">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Timestamp Modal */}
            {editTs.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-2xl font-bold mb-4">
                            Edit {editTs.kind === "in" ? "Clock In" : "Clock Out"}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Date: <strong>{editTs.row?.displayDate}</strong>
                        </p>
                        <label className="block mb-4">
                            <span className="text-sm font-medium">Time</span>
                            <input
                                type="time"
                                value={editTs.time || ""}
                                onChange={(e) => setEditTs((s) => ({ ...s, time: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                            />
                        </label>
                        <label className="block mb-6">
                            <span className="text-sm font-medium">Manager Note</span>
                            <textarea
                                rows={3}
                                value={editTs.note || ""}
                                onChange={(e) => setEditTs((s) => ({ ...s, note: e.target.value }))}
                                className="mt-1 w-full border rounded-md px-3 py-2"
                                placeholder="Reason for adjustment"
                            />
                        </label>
                        <div className="flex gap-3">
                            <button onClick={saveEditTs} className="flex-1 bg-[#2563EB] text-white px-4 py-2 rounded-md font-semibold">
                                Save
                            </button>
                            <button onClick={() => setEditTs({ open: false, kind: "in" })} className="flex-1 bg-gray-200 px-4 py-2 rounded-md font-semibold">
                                Cancel
                            </button>
                        </div>
                        {!editTs.row?.[editTs.kind] && (
                            <p className="mt-3 text-xs text-gray-500">
                                No existing {editTs.kind.toUpperCase()} found — a new entry will be created.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Note modal */}
            {noteView.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-3">Manager Note</h3>
                        <div className="border rounded-md p-3 bg-gray-50 whitespace-pre-wrap min-h-[80px]">
                            {noteView.text || "—"}
                        </div>
                        <div className="mt-4 text-right">
                            <button
                                onClick={() => setNoteView({ open: false })}
                                className="px-4 py-2 rounded-md bg-gray-200 font-semibold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
