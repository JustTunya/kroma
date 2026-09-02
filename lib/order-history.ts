
export function summarize(items: { item_name: string; quantity: number }[]): string {
  if (items.length === 0) return "No lines";

  const rest =
    items[0].quantity - 1 + items.slice(1).reduce((sum, item) => sum + item.quantity, 0);

  return rest > 0 ? `${items[0].item_name} + ${rest} more` : items[0].item_name;
}

export function groupByMonth<T extends { month: string }>(
  rows: T[],
): { month: string; rows: T[] }[] {
  return rows.reduce<{ month: string; rows: T[] }[]>((groups, row) => {
    const open = groups[groups.length - 1];

    if (open && open.month === row.month) open.rows.push(row);
    else groups.push({ month: row.month, rows: [row] });

    return groups;
  }, []);
}
