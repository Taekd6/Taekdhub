import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Prepahub", description: "Ton système de travail en prépa." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }
