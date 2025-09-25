"use client";

import { useEffect, useState } from "react";

export default function Clock() {
    const [clock, setClock] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const day = now.toLocaleDateString("en-US", {
                weekday: "long",
                timeZone: "America/New_York",
            });
            const date = now.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "America/New_York",
            });
            const time = now.toLocaleTimeString("en-US", {
                timeZone: "America/New_York",
            });
            setClock(`${day}, ${date} — ${time} EST`);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return <p className="text-sm font-medium">{clock}</p>;
}
