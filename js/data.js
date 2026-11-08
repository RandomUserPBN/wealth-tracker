'use strict';

async function fetchAll(table, order) {
  const rows = [];

  for (let start = 0; ; start += 500) {
    let query = db.from(table).select('*');

    for (const column of order) {
      query = query.order(column);
    }

    const { data, error } = await query.range(
      start,
      start + 499
    );

    if (error) throw error;

    rows.push(...data);

    if (data.length < 500) return rows;
  }
}

async function load() {
  const token = ++loadId;
  const account = userId;

  if (!account) return false;

  try {
    const [a, v, c, o, p, m] = await Promise.all([
      fetchAll('assets', ['created_at', 'id']),
      fetchAll('valuations', ['date', 'id']),
      fetchAll('custom_categories', ['name', 'id']),
      fetchAll(
        'property_ownership_changes',
        ['effective_date', 'id']
      ),
      fetchAll(
        'property_loan_plans',
        ['effective_date', 'id']
      ),
      fetchAll(
        'property_mortgage_overrides',
        ['date', 'id']
      )
    ]);

    if (
      token !== loadId ||
      account !== userId
    ) {
      return false;
    }

    assets = a;

    assets.sort(
      (x, y) =>
        Number(x.sort_order ?? 999999) -
          Number(y.sort_order ?? 999999) ||
        x.id.localeCompare(y.id)
    );

    valuations = v;
    categories = c;
    ownership = o;
    plans = p;
    overrides = m;

    render();
    return true;
  } catch (error) {
    if (
      token === loadId &&
      account === userId
    ) {
      showToast(
        `Could not load data: ${error.message}`,
        true
      );
    }

    return false;
  }
}
