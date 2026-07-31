import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TinySteps",
  description: "Tiny steps, real momentum. A habit tracker built for ADHD brains.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#191734" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Applies the saved appearance (light/dark/system) before first paint so
// there is no theme flash. Kept tiny and inline on purpose.
const appearanceInit = `
try {
  var a = localStorage.getItem('ts-appearance');
  if (a === 'light' || a === 'dark') document.documentElement.dataset.appearance = a;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: appearanceInit }} />
        {children}
      </body>
    </html>
  );
}
