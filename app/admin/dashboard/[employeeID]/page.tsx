"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import ReactDOM from "react-dom";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    Timestamp,
    setDoc,
} from "firebase/firestore";

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
                    disabled={!row.in}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                    Edit In
                </button>
                <button
                    onClick={() => {
                        setOpen(false);
                        onEditOut();
                    }}
                    disabled={!row.out}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                    Edit Out
                </button>
                <div className="my-1 h-px bg-gray-200" />
                <button
                    onClick={() => {
                        setOpen(false);
                        onDeleteIn();
                    }}
                    disabled={!row.in}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 disabled:opacity-40"
                >
                    Delete In
                </button>
                <button
                    onClick={() => {
                        setOpen(false);
                        onDeleteOut();
                    }}
                    disabled={!row.out}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 disabled:opacity-40"
                >
                    Delete Out
                </button>
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
    const weeks = useMemo(() => {
        const out: { iso: string; start: Date; endExcl: Date; label: string; header: string }[] = [];
        for (let i = 0; i < WEEKS_TO_SHOW; i++) {
            const s = new Date(thisWeekStart);
            s.setDate(s.getDate() - i * 7);
            const e = endOfWeekExcl(s);
            const label = `This Week (${fmtMDY(s)} - ${fmtMDY(new Date(e.getTime() - 86400000))})`;
            const header = `${fmtShort(s)} – ${fmtShort(new Date(e.getTime() - 86400000))}`;
            out.push({ iso: toISO(s), start: s, endExcl: e, label, header });
        }
        return out;
    }, [thisWeekStart]);
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
            const snap = await getDocs(collection(db, "logs"));
            const uniq = new Map<string, { employeeId: string; name: string }>();
            snap.docs.forEach((d) => {
                const x = d.data() as any;
                if (x.employeeId && x.employeeName) uniq.set(x.employeeId, { employeeId: x.employeeId, name: x.employeeName });
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
        entries.sort((a, b) => tsToDate(a.time).getTime() - tsToDate(b.time).getTime());

        if (entries[0]?.employeeName) setName(entries[0].employeeName);
        else setName("Unknown Employee");

        // group by date & pair
        const groups = new Map<string, Log[]>();
        for (const lg of entries) {
            const d = tsToDate(lg.time);
            const key = toISO(d);
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
            for (const IN of ins) {
                const inMs = tsToDate(IN.time).getTime();
                const OUT = outs.find((o) => !usedOut.has(o.id) && tsToDate(o.time).getTime() >= inMs);
                if (OUT) {
                    usedOut.add(OUT.id);
                    rows.push({
                        dateISO,
                        displayDate: tsToDate(IN.time).toLocaleDateString(),
                        in: IN,
                        out: OUT,
                        hours: msToHours(tsToDate(OUT.time).getTime() - inMs),
                        warning: !!OUT.autoClockOut,
                    });
                } else {
                    rows.push({
                        dateISO,
                        displayDate: tsToDate(IN.time).toLocaleDateString(),
                        in: IN,
                        hours: 0,
                        warning: false,
                    });
                }
            }
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
        rows.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
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
            if (start < e && end > s) return true;
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
    const weekTotals = useMemo(() => {
        const map = new Map<string, number>();
        for (const r of allRows) {
            const d = new Date(r.dateISO + "T00:00:00");
            const ws = startOfWeek(d);
            const key = toISO(ws);
            map.set(key, (map.get(key) || 0) + r.hours);
        }
        return map;
    }, [allRows]);

    const weeklyNumbers = useMemo(() => {
        if (showAll) {
            // in "All Dates", cards show 0.00 to avoid confusion
            return { reg: 0, ot: 0, total: 0, header: "All Dates" };
        }

        if (viewMode === "weekly") {
            const wkKey = selectedWeek.iso;
            const total = weekTotals.get(wkKey) || 0;
            const reg = Math.min(40, total);
            const ot = Math.max(0, total - 40);
            return { reg, ot, total, header: `${fmtShort(selectedWeek.start)} – ${fmtShort(new Date(selectedWeek.endExcl.getTime() - 86400000))}` };
        }

        // biweekly: sum two adjacent weeks, but OT is calculated per week and then summed
        const w1Key = selectedWeek.iso;
        const w2Key = toISO(new Date(selectedWeek.start.getTime() + 7 * 86400000));
        const t1 = weekTotals.get(w1Key) || 0;
        const t2 = weekTotals.get(w2Key) || 0;

        const reg = Math.min(40, t1) + Math.min(40, t2);
        const ot = Math.max(0, t1 - 40) + Math.max(0, t2 - 40);
        const total = t1 + t2;

        const w2End = endOfWeekExcl(new Date(selectedWeek.start.getTime() + 7 * 86400000));
        const header = `${fmtShort(selectedWeek.start)} – ${fmtShort(new Date(w2End.getTime() - 86400000))}`;
        return { reg, ot, total, header };
    }, [showAll, viewMode, selectedWeek, weekTotals]);

    /** ✅ Pay period totals **/
    /** ✅ Pay period totals (weekly OT logic) **/
    const payPeriodNumbers = useMemo(() => {
        const period = payPeriods.find(p => p.iso === selectedPayISO);
        if (!period) return { reg: 0, ot: 0, total: 0, header: "No Pay Period Selected" };

        // all rows in this pay period
        const rows = allRows.filter(r => {
            const d = new Date(r.dateISO + "T00:00:00");
            return withinExcl(d, period.start, period.endExcl);
        });

        // group by week start (Sunday)
        const weeklyMap = new Map<string, number>();
        for (const r of rows) {
            const d = new Date(r.dateISO + "T00:00:00");
            const ws = toISO(startOfWeek(d, 0)); // Sunday start
            weeklyMap.set(ws, (weeklyMap.get(ws) || 0) + r.hours);
        }

        let reg = 0;
        let ot = 0;

        for (const hrs of weeklyMap.values()) {
            reg += Math.min(40, hrs);
            ot += Math.max(0, hrs - 40);
        }

        const total = reg + ot;

        return {
            reg,
            ot,
            total,
            header: `${fmtShort(period.start)} – ${fmtShort(
                new Date(period.endExcl.getTime() - 86400000)
            )}`,
        };
    }, [allRows, selectedPayISO, payPeriods]);

    /** ===== per-row helpers ===== */
    const weekTotalForRow = (row: DayRow) => {
        const d = new Date(row.dateISO + "T00:00:00");
        const key = toISO(startOfWeek(d));
        return weekTotals.get(key) || 0;
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
        const outDt = new Date(y, m - 1, d, outH, outM, 0, 0);
        const note = (manualAdd.note || "Backfilled").trim();
        if (outDt <= inDt) { alert("Clock out must be after clock in."); return; }
        if (hasOverlap(toISO(inDt), inDt, outDt)) { alert("This pair overlaps another interval for this day."); return; }
        await addDoc(collection(db, "logs"), { employeeId: currentEmployeeId, employeeName: name, type: "in", time: Timestamp.fromDate(inDt), edited: true, managerNote: note, autoClockOut: false });
        await addDoc(collection(db, "logs"), { employeeId: currentEmployeeId, employeeName: name, type: "out", time: Timestamp.fromDate(outDt), edited: true, managerNote: note, autoClockOut: false });
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

    const openEditTs = (kind: "in" | "out", row: DayRow) => {
        const ref = kind === "in" ? row.in : row.out;
        const base = ref ? tsToDate(ref.time) : new Date(`${row.dateISO}T00:00:00`);
        const hh = pad2(base.getHours());
        const mm = pad2(base.getMinutes());
        setEditTs({ open: true, kind, row, time: `${hh}:${mm}`, note: ref?.managerNote || "" });
    };

    const saveEditTs = async () => {
        if (!editTs.open || !editTs.row || !editTs.time) return;
        const [H, M] = editTs.time.split(":").map(Number);
        const [y, m, d] = editTs.row.dateISO.split("-").map(Number);
        const when = new Date(y, m - 1, d, H, M, 0, 0);
        const note = (editTs.note || "Timestamp adjusted").trim();
        const target = editTs.kind === "in" ? editTs.row.in : editTs.row.out;

        const ignore: string[] = [];
        if (editTs.row.in?.id) ignore.push(editTs.row.in.id);
        if (editTs.row.out?.id) ignore.push(editTs.row.out.id);

        const partner = editTs.kind === "in" ? editTs.row.out : editTs.row.in;
        if (partner) {
            const s = editTs.kind === "in" ? when : tsToDate(partner.time);
            const e = editTs.kind === "in" ? tsToDate(partner.time) : when;
            if (e <= s) { alert("Clock out must be after clock in."); return; }
            if (hasOverlap(editTs.row.dateISO, s, e, ignore)) {
                alert("This edit creates an overlap with another interval.");
                return;
            }
        }

        if (target) {
            await updateDoc(doc(db, "logs", target.id), {
                time: Timestamp.fromDate(when), edited: true, managerNote: note, autoClockOut: false,
            });
        } else {
            await addDoc(collection(db, "logs"), {
                employeeId: currentEmployeeId, employeeName: name, type: editTs.kind,
                time: Timestamp.fromDate(when), edited: true, managerNote: note, autoClockOut: false,
            });
        }
        setEditTs({ open: false, kind: "in" });
        await fetchRows(currentEmployeeId);
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
    const exportCSV = () => {
        const header = ["Date", "In", "Out", "Daily Hrs", "Week Total", "Note"];
        const lines = [header.join(",")];
        rowsForView.forEach((r) => {
            const inStr = r.in
                ? tsToDate(r.in.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";
            const outStr = r.out
                ? tsToDate(r.out.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : r.in ? "Still clocked in" : "";
            const weekTot = weekTotalForRow(r).toFixed(2);
            const note = (r.out?.managerNote || r.in?.managerNote || "").replace(/,/g, " ");
            lines.push([r.displayDate, inStr, outStr, r.hours.toFixed(2), weekTot, note].join(","));
        });
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const nameSuffix = showAll
            ? "all_dates"
            : viewMode === "weekly"
                ? `week_${selectedWeek.iso}`
                : `biweekly_${selectedWeek.iso}`;
        a.download = `timecard_${currentEmployeeId}_${nameSuffix}.csv`;
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
                                        {selectedPayISO
                                            ? (() => {
                                                const p = payPeriods.find((x) => x.iso === selectedPayISO);
                                                if (!p) return "Viewing Pay Period (invalid)";
                                                return `Viewing Pay Period (${fmtMDY(p.start)} – ${fmtMDY(
                                                    new Date(p.endExcl.getTime() - 86400000)
                                                )})`;
                                            })()
                                            : `Viewing: ${viewMode === "weekly" ? "This Week" : "Biweekly"
                                            } (${weeklyNumbers.header})`}
                                    </div>
                                </div>
                            )}


                            {/* Cards */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="text-center bg-green-50 p-4 rounded-lg border-2 border-green-200">
                                    <p className="text-xs text-gray-700 font-semibold mb-1">
                                        REG {showAll ? "" : "(this view)"}
                                    </p>
                                    <p className="text-2xl font-bold text-[#059669]">
                                        {(selectedPayISO ? payPeriodNumbers.reg : weeklyNumbers.reg).toFixed(2)}

                                    </p>
                                </div>
                                <div className="text-center bg-red-50 p-4 rounded-lg border-2 border-red-200">
                                    <p className="text-xs text-gray-700 font-semibold mb-1">
                                        OT {showAll ? "" : "(this view)"}
                                    </p>
                                    <p
                                        className={`text-2xl font-bold ${weeklyNumbers.ot > 0 ? "text-red-600" : "text-gray-400"
                                            }`}
                                    >
                                        {(selectedPayISO ? payPeriodNumbers.ot : weeklyNumbers.ot).toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-center bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                                    <p className="text-xs text-gray-700 font-semibold mb-1">
                                        TOTAL {showAll ? "" : "(this view)"}
                                    </p>
                                    <p className="text-2xl font-bold text-[#2563EB]">
                                        {(selectedPayISO ? payPeriodNumbers.total : weeklyNumbers.total).toFixed(2)}
                                    </p>
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
