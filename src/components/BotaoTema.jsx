export default function BotaoTema({ tema, onAlternar }) {
  const escuro = tema === "escuro";
  return (
    <button onClick={onAlternar}
      aria-label={escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      className="w-11 h-11 -mr-1.5 grid place-items-center rounded-full text-[var(--rotulo-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
      {escuro ? (
        // sol
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M15.7 4.3l-1.4 1.4M5.7 14.3l-1.4 1.4"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        // lua
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M16.5 11.8A7 7 0 0 1 8.2 3.5a7 7 0 1 0 8.3 8.3z"
                stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
