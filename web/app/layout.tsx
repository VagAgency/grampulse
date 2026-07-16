import type { Metadata } from "next";
import { BulkRefreshProvider } from "@/components/BulkRefreshProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "GramPulse — Analytics Instagram",
  description: "Analyse la santé de n'importe quel compte Instagram public.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("grampulse_theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <BulkRefreshProvider>{children}</BulkRefreshProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
