"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main style={{ padding: "15vh 24px", textAlign: "center" }}>
      <h1>Не удалось загрузить страницу</h1>
      <p>Проверьте соединение и попробуйте ещё раз.</p>
      <button
        onClick={reset}
        style={{
          border: 0,
          padding: "16px 28px",
          borderRadius: 16,
          background: "#000",
          color: "#fff",
        }}
      >
        Повторить
      </button>
    </main>
  );
}
