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
    onSnapshot,
    deleteDoc,
    updateDoc,
    doc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Log = {
    id: string;
    employeeId: string;
    employeeName: string;
    type: "in" | "out";
    time: any;
};

type Employee = {
    id: string;
    name: string;
    hidden: boolean;
    employeeId?: string;
    duty?: string;
};

export default function ManagerDashboard() {
    const router = useRouter();
    const [logs, setLogs] = useState<Log[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [showEmployeeList, setShowEmployeeList] = useState(false);
    const [timeRange, setTimeRange] = useState<"today" | "week" | "biweekly" | "month">("week");
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showHidden, setShowHidden] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEmployeeName, setNewEmployeeName] = useState("");
    const [newEmployeeDuty, setNewEmployeeDuty] = useState("");
    const [manual, setManual] = useState<{
        open: boolean;
        employeeId?: string;
        employeeName?: string;
        date?: string;
        inTime?: string;
        outTime?: string;
        note?: string;
    }>({ open: false });
    // Add this helper function to check if a date is a holiday
    const checkIfHoliday = async (dateISO: string) => {
        try {
            const holidaysSnap = await getDocs(collection(db, "holidays"));
            const holiday = holidaysSnap.docs.find(
                (doc) => doc.data().date === dateISO && doc.data().isPaid
            );
            return holiday ? { name: holiday.data().name, isPaid: true } : null;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const q = query(collection(db, "employees"), orderBy("name"));
        const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map((d) => {
                const data = d.data() as Employee;
                return {
                    id: d.id,
                    employeeId: data.employeeId,
                    name: data.name,
                    hidden: !!data.hidden,
                };
            });

            // ✅ ALWAYS set all employees, let the grouped display handle filtering
            setEmployees(fetched);
        });

        return () => unsub();
    }, []); // Remove showHidden from dependencies



    // 🔹 Fetch logs by range
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
            setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Log)));
            setLoading(false);
        })();
    }, [timeRange]);

    // 🔹 Group employees + logs
    const grouped = useMemo(() => {
        const m = new Map();

        logs.forEach((l) => {
            const key = l.employeeId || l.employeeName || "Unknown";
            if (!m.has(key)) {
                m.set(key, {
                    employeeId: l.employeeId,
                    name: l.employeeName,
                    items: [],
                    hidden: false
                });
            }
            const entry = m.get(key);
            if (entry) {
                entry.items.push(l);
            }
        });

        employees.forEach((emp) => {
            const key = emp.employeeId || emp.id;
            if (!m.has(key)) {
                m.set(key, {
                    employeeId: key,
                    name: emp.name,
                    items: [],
                    hidden: emp.hidden || false,
                });
            } else {
                const existing = m.get(key);
                if (existing) {
                    existing.hidden = emp.hidden || false;
                }
            }
        });

        const allGroups = Array.from(m.values());
        const filtered = showHidden
            ? allGroups.filter(g => g.hidden === true)
            : allGroups.filter(g => g.hidden === false);

        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [logs, employees, showHidden]);


    // 🔹 Add new employee
    const addEmployee = async () => {
        if (!newEmployeeName.trim()) return alert("Enter a name");
        if (!newEmployeeDuty.trim()) return alert("Please select a duty");

        const employeeId = `EMP${Date.now().toString().slice(-5)}`;
        await addDoc(collection(db, "employees"), {
            name: newEmployeeName.trim(),
            employeeId,
            duty: newEmployeeDuty,
            hidden: false,
            createdAt: Timestamp.now(),
        });

        // ✅ Show the Employee ID to share with the new employee
        alert(`✅ Employee Added Successfully!\n\nName: ${newEmployeeName.trim()}\nDuty: ${newEmployeeDuty}\nEmployee ID: ${employeeId}\n\nShare this Employee ID with the employee so they can clock in at:\nyourwebsite.com/clock`);

        setNewEmployeeName("");
        setNewEmployeeDuty("");
        setShowAddModal(false);
    };
    // 🔹 Delete employee
    const deleteEmployee = async (employeeId: string) => {
        if (!confirm("Delete this employee?")) return;

        // Try finding by employeeId field first
        const q = query(collection(db, "employees"), where("employeeId", "==", employeeId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await deleteDoc(doc(db, "employees", snap.docs[0].id));
        } else {
            await deleteDoc(doc(db, "employees", employeeId));
        }
    };

    // ✅ Final Hide/Unhide function
    const toggleHidden = async (employeeId: string, currentHidden: boolean) => {
        try {
            const q = query(collection(db, "employees"), where("employeeId", "==", employeeId));
            const snap = await getDocs(q);

            if (snap.empty) {
                alert("Employee not found!");
                return;
            }

            const docRef = doc(db, "employees", snap.docs[0].id);
            await updateDoc(docRef, { hidden: !currentHidden });

            console.log(`Employee ${employeeId} is now ${!currentHidden ? "hidden" : "visible"}`);
        } catch (err) {
            console.error("Error toggling hidden:", err);
        }
    };



    // 🔹 Manual entry logic
    const openManual = (id: string, name: string) =>
        setManual({ open: true, employeeId: id, employeeName: name, date: "", inTime: "", outTime: "", note: "" });

    const saveManual = async () => {
        if (!manual.employeeId || !manual.date || !manual.inTime || !manual.outTime) return;
        const [y, m, d] = manual.date.split("-").map(Number);
        const [inH, inM] = manual.inTime.split(":").map(Number);
        const [outH, outM] = manual.outTime.split(":").map(Number);

        const inDt = new Date(y, m - 1, d, inH, inM);
        const outDt = new Date(y, m - 1, d, outH, outM);

        await addDoc(collection(db, "logs"), {
            employeeId: manual.employeeId,
            employeeName: manual.employeeName,
            type: "in",
            time: Timestamp.fromDate(inDt),
            managerNote: manual.note || "Backfilled",
        });
        await addDoc(collection(db, "logs"), {
            employeeId: manual.employeeId,
            employeeName: manual.employeeName,
            type: "out",
            time: Timestamp.fromDate(outDt),
            managerNote: manual.note || "Backfilled",
        });
        setManual({ open: false });
    };

    // 🔹 UI
    return (
        <main className="min-h-screen bg-gray-100 flex justify-center items-start px-6 py-10">
            <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-[1600px] border border-gray-200">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
                    <h1 className="text-3xl font-bold text-[#1F2937]">Manager Dashboard</h1>

                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700 transition"
                        >
                            + Add Employee
                        </button>
                        <button
                            onClick={() => router.push("/admin/holidays")}
                            className="bg-purple-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-purple-700 transition"
                        >
                            Holidays
                        </button>
                        <button
                            onClick={() => setShowHidden((prev) => !prev)}
                            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-semibold hover:bg-gray-400 transition"
                        >
                            {showHidden ? "Hide Hidden" : "Show Hidden"}
                        </button>

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

                {/* Employee Cards */}
                {loading ? (
                    <div className="text-gray-500">Loading…</div>
                ) : grouped.length === 0 ? (
                    <div className="text-gray-500">No employees found.</div>
                ) : (
                    grouped.map((g) => (
                        <div
                            key={g.employeeId}
                            className="border border-gray-200 rounded-xl flex justify-between items-center p-4 bg-gray-50 mb-3 relative overflow-visible"
                        >
                            <div
                                className="cursor-pointer"
                                onClick={() => router.push(`/admin/dashboard/${g.employeeId}`)}
                            >
                                <div className="font-semibold text-gray-800 hover:text-blue-600 transition">
                                    {g.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {g.items.length} log entries
                                    {employees.find(e => e.employeeId === g.employeeId)?.duty && (
                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                            {employees.find(e => e.employeeId === g.employeeId)?.duty}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpanded((prev) => (prev === g.employeeId ? null : g.employeeId));
                                    }}
                                    className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300"
                                >
                                    ⋮
                                </button>

                                {expanded === g.employeeId && (
                                    <div className="absolute right-0 top-10 w-44 bg-white border rounded-xl shadow-xl z-[9999]">
                                        <button
                                            onClick={() => openManual(g.employeeId, g.name)}
                                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                        >
                                            Add Manual Entry
                                        </button>

                                        <button
                                            onClick={async () => {
                                                const emp = employees.find(
                                                    (e) => e.employeeId === g.employeeId || e.id === g.employeeId
                                                );
                                                if (emp)
                                                    await toggleHidden(emp.employeeId || emp.id, emp.hidden ?? false);
                                            }}
                                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-yellow-600"
                                        >
                                            {employees.find(
                                                (e) => e.employeeId === g.employeeId || e.id === g.employeeId
                                            )?.hidden
                                                ? "Unhide"
                                                : "Hide"}
                                        </button>

                                        <button
                                            onClick={() => deleteEmployee(g.employeeId)}
                                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-600"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}

                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Employee Modal */}
            {/* Add Employee Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Add New Employee</h3>

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employee Name
                        </label>
                        <input
                            type="text"
                            value={newEmployeeName}
                            onChange={(e) => setNewEmployeeName(e.target.value)}
                            className="mt-1 w-full border rounded-md px-3 py-2 mb-4"
                            placeholder="Enter employee name"
                        />

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duty / Department
                        </label>
                        <select
                            value={newEmployeeDuty}
                            onChange={(e) => setNewEmployeeDuty(e.target.value)}
                            className="mt-1 w-full border rounded-md px-3 py-2 mb-4 bg-white"
                        >
                            <option value="">Select Duty</option>
                            <option value="Laundry">Laundry</option>
                            <option value="Front Desk">Front Desk</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Housekeeping">Housekeeping</option>
                            <option value="Other">Other</option>
                        </select>

                        <div className="flex gap-3">
                            <button
                                onClick={addEmployee}
                                className="flex-1 bg-green-600 text-white rounded-md px-4 py-2 font-semibold hover:bg-green-700"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewEmployeeName("");
                                    setNewEmployeeDuty("");
                                }}
                                className="flex-1 bg-gray-200 rounded-md px-4 py-2 font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal */}
            {manual.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-4">Add Manual Entry</h3>
                        <p className="mb-3 text-sm text-gray-600">
                            {manual.employeeName} ({manual.employeeId})
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <input
                                type="date"
                                value={manual.date || ""}
                                onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))}
                                className="col-span-2 border rounded-md px-3 py-2"
                            />
                            <input
                                type="time"
                                value={manual.inTime || ""}
                                onChange={(e) => setManual((m) => ({ ...m, inTime: e.target.value }))}
                                className="border rounded-md px-3 py-2"
                            />
                            <input
                                type="time"
                                value={manual.outTime || ""}
                                onChange={(e) => setManual((m) => ({ ...m, outTime: e.target.value }))}
                                className="border rounded-md px-3 py-2"
                            />
                        </div>
                        <textarea
                            rows={3}
                            value={manual.note || ""}
                            onChange={(e) => setManual((m) => ({ ...m, note: e.target.value }))}
                            className="w-full border rounded-md px-3 py-2 mb-4"
                            placeholder="Manager note (optional)"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={saveManual}
                                className="flex-1 bg-blue-600 text-white rounded-md px-4 py-2 font-semibold"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setManual({ open: false })}
                                className="flex-1 bg-gray-200 rounded-md px-4 py-2 font-semibold"
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
