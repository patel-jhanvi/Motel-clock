"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';

export default function EmployeeClockInOut() {
    const [employeeId, setEmployeeId] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [lastAction, setLastAction] = useState<'in' | 'out' | null>(null);

    const handleClock = async () => {
        if (!employeeId.trim()) {
            setMessage('Please enter your Employee ID');
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // 1. Get employee info
            const empQuery = query(
                collection(db, 'employees'),
                where('employeeId', '==', employeeId.trim())
            );
            const empSnap = await getDocs(empQuery);

            if (empSnap.empty) {
                setMessage('❌ Employee ID not found. Please check with your manager.');
                setLoading(false);
                return;
            }

            const employee = empSnap.docs[0].data();
            const employeeName = employee.name;

            // 2. Check last log entry
            const logsQuery = query(
                collection(db, 'logs'),
                where('employeeId', '==', employeeId.trim()),
                orderBy('time', 'desc'),
                limit(1)
            );
            const logsSnap = await getDocs(logsQuery);

            let nextAction: 'in' | 'out' = 'in';
            if (!logsSnap.empty) {
                const lastLog = logsSnap.docs[0].data();
                nextAction = lastLog.type === 'in' ? 'out' : 'in';
            }

            // 3. Create log entry
            await addDoc(collection(db, 'logs'), {
                employeeId: employeeId.trim(),
                employeeName: employeeName,
                type: nextAction,
                time: Timestamp.now(),
                autoClockOut: false,
            });

            setLastAction(nextAction);
            setMessage(
                nextAction === 'in'
                    ? `✅ Clocked In successfully at ${new Date().toLocaleTimeString()}`
                    : `✅ Clocked Out successfully at ${new Date().toLocaleTimeString()}`
            );
        } catch (err) {
            console.error('Clock error:', err);
            setMessage('❌ Error processing request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
            <div className="bg-white shadow-2xl rounded-3xl p-8 md:p-12 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Employee Clock In/Out
                    </h1>
                    <p className="text-gray-600">Enter your Employee ID to continue</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Employee ID
                        </label>
                        <input
                            type="text"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                            placeholder="e.g., EMP12345"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                            disabled={loading}
                            onKeyPress={(e) => e.key === 'Enter' && handleClock()}
                        />
                    </div>

                    <button
                        onClick={handleClock}
                        disabled={loading}
                        className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${loading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                            }`}
                    >
                        {loading ? 'Processing...' : 'Clock In / Out'}
                    </button>

                    {message && (
                        <div
                            className={`p-4 rounded-lg text-center font-semibold ${message.includes('✅')
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                        >
                            {message}
                        </div>
                    )}

                    {lastAction && (
                        <div className="text-center pt-4">
                            <div
                                className={`inline-block px-6 py-2 rounded-full text-sm font-semibold ${lastAction === 'in'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-orange-100 text-orange-800'
                                    }`}
                            >
                                Currently: {lastAction === 'in' ? 'Clocked In ✓' : 'Clocked Out'}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                        Having trouble? Contact your manager for assistance.
                    </p>
                </div>
            </div>
        </div>
    );
}