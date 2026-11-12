// A fresh query per page avoids mutating a builder already in flight. RLS still determines every row.
export async function readAll(query, pageSize = 500) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const result = await query().range(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data || []));
    if ((result.data || []).length < pageSize) return { data: rows, error: null };
  }
}
