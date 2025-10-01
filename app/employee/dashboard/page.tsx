"use client";

import { Suspense } from "react";
import EmployeeDashboard from "./EmployeeDashboard";

export const dynamic = "force-dynamic"; // ⬅️ ensures runtime rendering

export default function Page() {
    return (
        <Suspense
            fallback={
                <main className="flex items-center justify-center min-h-screen">
                    <p className="text-gray-600">Loading dashboard...</p>
                </main>
            }
        >
            <EmployeeDashboard />
        </Suspense>
    );
}
