import type { Metadata } from "next";
import { ConvexProvider } from "@/components/ConvexProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaBot",
  description: "Personal Instagram automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  );
}
