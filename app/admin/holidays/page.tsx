"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Holiday = {
    id: string;
    name: string;
    date: string; // YYYY-MM-DD format
    isPaid: boolean;
    year: number;
};

export default function HolidaysManagement() {
    const router = useRouter();
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newHoliday, setNewHoliday] = useState({
        name: "",
        date: "",
        isPaid: true,
    });

    // Predefined federal holidays for quick setup
    const federalHolidays2025 = [
        { name: "New Year's Day", date: "2025-01-01" },
        { name: "Martin Luther King Jr. Day", date: "2025-01-20" },
        { name: "Presidents' Day", date: "2025-02-17" },
        { name: "Memorial Day", date: "2025-05-26" },
        { name: "Juneteenth", date: "2025-06-19" },
        { name: "Independence Day", date: "2025-07-04" },
        { name: "Labor Day", date: "2025-09-01" },
        { name: "Columbus Day", date: "2025-10-13" },
        { name: "Veterans Day", date: "2025-11-11" },
        { name: "Thanksgiving Day", date: "2025-11-27" },
        { name: "Christmas Day", date: "2025-12-25" },
    ];

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        const snap = await getDocs(collection(db, "holidays"));
        const fetched = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        } as Holiday));
        setHolidays(fetched.sort((a, b) => a.date.localeCompare(b.date)));
    };

    const addHoliday = async () => {
        if (!newHoliday.name.trim() || !newHoliday.date) {
            return alert("Please enter holiday name and date");
        }

        const year = new Date(newHoliday.date).getFullYear();
        await addDoc(collection(db, "holidays"), {
            name: newHoliday.name.trim(),
            date: newHoliday.date,
            isPaid: newHoliday.isPaid,
            year,
            createdAt: Timestamp.now(),
        });

        setNewHoliday({ name: "", date: "", isPaid: true });
        setShowAddModal(false);
        fetchHolidays();
    };

    const addAllFederalHolidays = async () => {
        if (!confirm("Add all 11 federal holidays for 2025?")) return;

        for (const holiday of federalHolidays2025) {
            await addDoc(collection(db, "holidays"), {
                name: holiday.name,
                date: holiday.date,
                isPaid: true,
                year: 2025,
                createdAt: Timestamp.now(),
            });
        }

        alert("✅ All federal holidays added!");
        fetchHolidays();
    };

    const deleteHoliday = async (id: string) => {
        if (!confirm("Delete this holiday?")) return;
        await deleteDoc(doc(db, "holidays", id));
        fetchHolidays();
    };

    const togglePaid = async (holiday: Holiday) => {
        await updateDoc(doc(db, "holidays", holiday.id), {
            isPaid: !holiday.isPaid,
        });
        fetchHolidays();
    };

    return (
        <main className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow-xl rounded-2xl p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">
                                Holidays Management
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Manage paid holidays for your employees
                            </p>
                        </div>
                        <button
                            onClick={() => router.push("/admin/dashboard")}
                            className="text-blue-600 hover:underline"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-700"
                        >
                            + Add Holiday
                        </button>
                        <button
                            onClick={addAllFederalHolidays}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700"
                        >
                            + Add All Federal Holidays (2025)
                        </button>
                    </div>

                    {/* Holidays List */}
                    <div className="space-y-3">
                        {holidays.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                No holidays added yet. Click "Add All Federal Holidays"
                                to get started.
                            </div>
                        ) : (
                            holidays.map((holiday) => (
                                <div
                                    key={holiday.id}
                                    className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
                                >
                                    <div>
                                        <div className="font-semibold text-gray-800">
                                            {holiday.name}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {new Date(
                                                holiday.date + "T00:00:00"
                                            ).toLocaleDateString("en-US", {
                                                weekday: "long",
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => togglePaid(holiday)}
                                            className={`px-3 py-1 rounded-md text-sm font-semibold ${holiday.isPaid
                                                ? "bg-green-100 text-green-700"
                                                : "bg-gray-200 text-gray-600"
                                                }`}
                                        >
                                            {holiday.isPaid ? "Paid" : "Unpaid"}
                                        </button>
                                        <button
                                            onClick={() => deleteHoliday(holiday.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Holiday Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Add New Holiday</h3>

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Holiday Name
                        </label>
                        <input
                            type="text"
                            value={newHoliday.name}
                            onChange={(e) =>
                                setNewHoliday({ ...newHoliday, name: e.target.value })
                            }
                            className="w-full border rounded-md px-3 py-2 mb-4"
                            placeholder="e.g., New Year's Day"
                        />

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date
                        </label>
                        <input
                            type="date"
                            value={newHoliday.date}
                            onChange={(e) =>
                                setNewHoliday({ ...newHoliday, date: e.target.value })
                            }
                            className="w-full border rounded-md px-3 py-2 mb-4"
                        />

                        <label className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                checked={newHoliday.isPaid}
                                onChange={(e) =>
                                    setNewHoliday({
                                        ...newHoliday,
                                        isPaid: e.target.checked,
                                    })
                                }
                                className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Paid Holiday</span>
                        </label>

                        <div className="flex gap-3">
                            <button
                                onClick={addHoliday}
                                className="flex-1 bg-green-600 text-white rounded-md px-4 py-2 font-semibold"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setShowAddModal(false)}
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