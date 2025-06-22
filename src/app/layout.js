import "./globals.css";

export const metadata = {
  title: "Natural Language to SQL Converter",
  description: "PostgreSQL과 LM Studio를 활용한 자연어 SQL 변환 도구",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
