export default function BotaoTema({ tema, onAlternar }) {
  return (
    <button onClick={onAlternar}
      className="text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 underline focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
      {tema === "escuro" ? "claro" : "escuro"}
    </button>
  );
}
