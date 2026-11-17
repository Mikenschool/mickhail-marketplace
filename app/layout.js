import { DM_Sans } from "next/font/google";
import Header from "./Header";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });

export const metadata = {
  title: "Palengke · a mini marketplace",
  description: "Buy and sell around campus. Built with React, Next.js and Supabase.",
};

export const viewport = { themeColor: "#14532d" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={sans.className}>
        <Header />
        {children}
      </body>
    </html>
  );
}
