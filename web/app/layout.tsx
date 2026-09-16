import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "オフ会コネクト｜参加者紹介",
  description:
    "オフ会参加者の関心や取り組みから、会話のきっかけをつくる紹介サービス。",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
