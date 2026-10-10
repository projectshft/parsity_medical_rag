import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Col = { name: string; type: string; distinct: number; nulls: number; top: { value: string; n: number }[] };

// users holds credentials, not clinical data
const TABLES = ['patients', 'conditions', 'observations', 'medications', 'encounters', 'notes'];

async function profile(table: string) {
  const [{ n: rows }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) n FROM "${table}"`);
  const cols = await prisma.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    table,
  );
  const total = Number(rows);
  const out: Col[] = [];
  for (const { column_name: c, data_type } of cols) {
    const [s] = await prisma.$queryRawUnsafe<{ d: bigint; nulls: bigint }[]>(
      `SELECT count(DISTINCT "${c}") d, count(*) FILTER (WHERE "${c}" IS NULL) nulls FROM "${table}"`,
    );
    const distinct = Number(s.d);
    // ids, foreign keys, dates and free text: a value breakdown is just noise
    const noisy = /id$/i.test(c) || data_type === 'date' || data_type.startsWith('timestamp');
    const top =
      !noisy && distinct > 0 && distinct < total * 0.5
        ? (
            await prisma.$queryRawUnsafe<{ v: string; n: bigint }[]>(
              `SELECT "${c}"::text v, count(*) n FROM "${table}" WHERE "${c}" IS NOT NULL
               GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
            )
          ).map((r) => ({ value: r.v, n: Number(r.n) }))
        : [];
    out.push({ name: c, type: data_type, distinct, nulls: Number(s.nulls), top });
  }
  return { table, total, cols: out };
}

export default async function ExplorePage() {
  const tables = await Promise.all(TABLES.map(profile));
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-700"><main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-neutral-900">Data explorer</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">
        Every column we could attach to a Pinecone vector as metadata. Columns tagged{' '}
        <Badge>good filter</Badge> have few distinct values and are almost always filled.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2">
        {tables.map((t) => (
          <a key={t.table} href={`#${t.table}`} className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-200">
            {t.table} <span className="text-neutral-500">{t.total.toLocaleString()}</span>
          </a>
        ))}
      </nav>
      <div className="mt-8 space-y-8">
        {tables.map(({ table, total, cols }) => (
          <section key={table} id={table} className="rounded-xl border border-neutral-200 bg-white">
            <h2 className="border-b border-neutral-200 px-5 py-3 text-lg font-semibold text-neutral-900">
              {table} <span className="ml-2 text-sm font-normal text-neutral-500">{total.toLocaleString()} rows · {cols.length} columns</span>
            </h2>
            <ul className="divide-y divide-neutral-200">
              {cols.map((c) => {
                const filled = total ? ((total - c.nulls) / total) * 100 : 0;
                const max = c.top[0]?.n ?? 1;
                const good = c.distinct > 1 && c.distinct <= 30 && filled >= 90 && c.top.length > 0;
                return (
                  <li key={c.name} className="grid gap-x-6 gap-y-2 px-5 py-3 md:grid-cols-[220px_1fr]">
                    <div>
                      <div className="font-mono text-sm text-neutral-900">{c.name}</div>
                      <div className="text-xs text-neutral-500">
                        {c.type} · {c.distinct.toLocaleString()} distinct · {filled.toFixed(0)}% filled
                      </div>
                      {good && <div className="mt-1"><Badge>good filter</Badge></div>}
                    </div>
                    <div className="flex flex-wrap content-start gap-1.5">
                      {c.top.length === 0 && <span className="text-xs italic text-neutral-500">id, date, or mostly-unique — no value breakdown</span>}
                      {c.top.map((t) => (
                        <span key={t.value} className="relative overflow-hidden rounded bg-neutral-100 px-2 py-0.5 text-xs">
                          <span className="absolute inset-y-0 left-0 bg-sky-200" style={{ width: `${(t.n / max) * 100}%` }} />
                          <span className="relative">{t.value.slice(0, 40)} <span className="text-neutral-500">{t.n.toLocaleString()}</span></span>
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main></div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">{children}</span>;
}
