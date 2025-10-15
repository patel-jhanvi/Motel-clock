"use client";

export default function Footer() {
    return (
        <footer className="w-full mt-10 border-t border-gray-200 bg-gray-50 py-5 text-center text-sm text-gray-600">
            <p>
                © {new Date().getFullYear()}{" "}
                <span className="font-semibold text-blue-600">ShiftTrack</span> · Built for{" "}
                <span className="font-medium text-gray-800">Microtel Jacksonville</span>
            </p>

            <p className="mt-2 text-xs text-gray-500">
                Designed & Developed by{" "}
                <a
                    href="https://jhanvi-patel.netlify.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-600 hover:underline hover:text-blue-800 transition"
                >
                    Jhanvi Patel
                </a>
            </p>
        </footer>
    );
}
