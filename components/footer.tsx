// components/Footer.tsx
"use client";

export default function Footer() {
    return (
        <footer className="bg-[#1F2937] text-white py-6 mt-auto border-t-4 border-[#2563EB]">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    {/* Copyright */}
                    <div className="text-center md:text-left">
                        <p className="text-sm text-gray-300">
                            © {new Date().getFullYear()} <span className="font-semibold text-white">ClockMotel</span> - Employee Time Tracking System
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Designed for Microtel Jacksonville
                        </p>
                    </div>

                    {/* Developer Credit */}
                    <div className="text-center md:text-right">
                        <p className="text-sm text-gray-300">
                            Developed by{" "}
                            <a
                                href="https://github.com/YOUR_GITHUB_USERNAME"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#2563EB] hover:text-[#3B82F6] hover:underline transition"
                            >
                                Your Name
                            </a>
                        </p>
                        <div className="flex items-center justify-center md:justify-end gap-4 mt-2">
                            <a
                                href="https://github.com/YOUR_GITHUB_USERNAME"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-white transition"
                                aria-label="GitHub"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </a>
                            <a
                                href="mailto:your.email@example.com"
                                className="text-gray-400 hover:text-white transition"
                                aria-label="Email"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Optional: Additional Links */}
                <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                    <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
                        <a href="/privacy" className="hover:text-white transition">Privacy Policy</a>
                        <span>•</span>
                        <a href="/terms" className="hover:text-white transition">Terms of Service</a>
                        <span>•</span>
                        <a href="/support" className="hover:text-white transition">Support</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}