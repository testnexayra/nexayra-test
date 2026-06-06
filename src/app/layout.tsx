import type { Metadata } from "next";
import { Lato, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexayra Arc",
  description: "Internal operations platform for Nexayra Arc General Contracting L.L.C.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${poppins.variable}`} suppressHydrationWarning>
      <body className="font-body antialiased bg-bg text-fg transition-colors">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}