export default function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-title" className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">
          Operação financeira
        </p>
        <h1
          className="max-w-2xl text-pretty text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          id="dashboard-title"
        >
          Dashboard de transações
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
          Consulte, registre e acompanhe transações enquanto a decisão antifraude é processada.
        </p>
      </div>
      <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-6" aria-label="Informação">
        <h2 className="text-lg font-bold text-blue-950">Fonte dos dados</h2>
        <p className="mt-3 text-sm leading-6 text-blue-900">
          A API de transações mantém o estado oficial. Uma transação pendente ainda aguarda uma
          decisão antifraude.
        </p>
      </aside>
    </section>
  );
}
