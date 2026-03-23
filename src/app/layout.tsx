import type { Metadata } from "next";
import { ConvexProvider } from "@/components/ConvexProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "BotMake Direct",
  description: "Автоматизация Instagram Direct и комментариев",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Header />
        <main><ConvexProvider>{children}</ConvexProvider></main>
        <Footer />
      </body>
    </html>
  );
}
