import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SurvivalMind | GenLayer AI Survival Game",
  description: "Submit your survival plan. GenLayer AI judges your instincts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
