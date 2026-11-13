import Link from "next/link";
export default function NotFound() {
  return (
    <main style={{ padding: "20vh 24px", textAlign: "center" }}>
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-8px" }}>
        404<span style={{ color: "#e60012" }}>.</span>
      </div>
      <h1>Страница не найдена</h1>
      <Link href="/ru">В каталог</Link>
    </main>
  );
}
