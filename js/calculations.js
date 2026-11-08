'use strict';

function categoryName(asset) {
  return asset.category === 'custom'
    ? categories.find(
        category =>
          category.id === asset.custom_category_id
      )?.name ?? 'Custom category'
    : TYPES[asset.category] ?? 'Other';
}

function activeAt(asset, date) {
  return !asset.archived_on ||
    date < asset.archived_on;
}

function shareAt(asset, date) {
  let result = Number(asset.ownership_percent ?? 100);

  for (const change of ownership) {
    if (
      change.asset_id === asset.id &&
      change.effective_date <= date
    ) {
      result = Number(change.ownership_percent);
    }
  }

  return result;
}

function latestValues(date) {
  const map = new Map();

  for (const valuation of valuations) {
    if (valuation.date > date) break;
    map.set(valuation.asset_id, valuation);
  }

  return map;
}

function addMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);

  const first = new Date(
    Date.UTC(year, month - 1 + months, 1)
  );

  const lastDay = new Date(
    Date.UTC(
      first.getUTCFullYear(),
      first.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  return [
    first.getUTCFullYear(),
    String(first.getUTCMonth() + 1).padStart(2, '0'),
    String(Math.min(day, lastDay)).padStart(2, '0')
  ].join('-');
}

function planRemainingMonths(plan) {
  if (plan.total_duration_months == null) {
    return Number(plan.term_months);
  }

  const total = Number(plan.total_duration_months);
  let alreadyScheduled = 0;

  for (let i = 0; i < total; i++) {
    if (
      addMonths(plan.first_payment_date, i) <
      plan.effective_date
    ) {
      alreadyScheduled++;
    } else {
      break;
    }
  }

  return Math.max(0, total - alreadyScheduled);
}

function formatDuration(months) {
  const years = Math.floor(months / 12);
  const extra = months % 12;
  const parts = [];

  if (years) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }

  if (extra) {
    parts.push(`${extra} ${extra === 1 ? 'month' : 'months'}`);
  }

  return parts.join(' ') || '0 months';
}

function annuity(principal, annualRate, months) {
  if (months <= 0 || principal === 0) return 0;

  const monthlyRate = annualRate / 1200;

  if (monthlyRate === 0) {
    return Math.round(principal / months * 100) / 100;
  }

  return Math.round(
    principal * monthlyRate /
    (1 - Math.pow(1 + monthlyRate, -months)) *
    100
  ) / 100;
}

function roundCents(number) {
  return Math.round(
    (number + Number.EPSILON) * 100
  ) / 100;
}

function activePlan(asset, date) {
  let found = null;

  for (const plan of plans) {
    if (
      plan.asset_id === asset.id &&
      plan.effective_date <= date
    ) {
      found = plan;
    }
  }

  return found;
}

function mortgageAt(asset, date) {
  const relevantActuals = overrides.filter(
    actual =>
      actual.asset_id === asset.id &&
      actual.date <= date
  );

  const plan = activePlan(asset, date);

  if (!plan) {
    const last = relevantActuals.at(-1);

    return {
      balance: last ? Number(last.balance) : 0,
      source: last
        ? `Manual balance from ${last.date}`
        : 'No balance recorded',
      payment: null,
      plan: null,
      remainingMonths: null,
      fixedPeriodExpired: false
    };
  }

  const fixedEnd = plan.fixed_interest_end_date ?? null;

  const fixedPeriodExpired =
    Boolean(fixedEnd && date > fixedEnd);

  const projectionEnd = fixedPeriodExpired
    ? fixedEnd
    : date;

  let balance = Number(plan.opening_balance);

  const remainingMonths = planRemainingMonths(plan);

  const payment = annuity(
    balance,
    Number(plan.annual_rate),
    remainingMonths
  );

  let source = 'Projected from mortgage plan';

  const planActuals = relevantActuals.filter(
    actual => actual.date >= plan.effective_date
  );

  const events = [];

  const count = plan.total_duration_months == null
    ? Number(plan.term_months)
    : Number(plan.total_duration_months);

  for (let i = 0; i < count; i++) {
    const due = addMonths(plan.first_payment_date, i);

    if (due > projectionEnd) break;

    if (due >= plan.effective_date) {
      events.push({ date: due, kind: 'payment' });
    }
  }

  for (const actual of planActuals) {
    events.push({
      date: actual.date,
      kind: 'actual',
      balance: Number(actual.balance)
    });
  }

  /*
   * If an actual balance and a scheduled payment have the
   * same date, the actual balance takes precedence.
   */
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === 'payment' ? -1 : 1)
  );

  for (const event of events) {
    if (event.kind === 'actual') {
      balance = event.balance;

      source = event.date === date
        ? 'Actual balance recorded on this date'
        : `Last actual balance recorded ${event.date}`;
    } else if (balance > 0) {
      const interest = roundCents(
        balance *
        Number(plan.annual_rate) /
        1200
      );

      balance = Math.max(
        0,
        roundCents(
          balance +
          interest -
          Math.min(balance + interest, payment)
        )
      );
    }
  }

  if (fixedPeriodExpired) {
    const actualAfterExpiry = planActuals
      .filter(actual => actual.date > fixedEnd)
      .at(-1);

    source = actualAfterExpiry
      ? `Last actual balance from ${actualAfterExpiry.date}; no payments projected after fixed interest ended ${fixedEnd}`
      : `Fixed interest ended ${fixedEnd}; last projected balance carried forward`;
  } else {
    const lastActual = planActuals.at(-1);

    if (lastActual && lastActual.date < date) {
      source =
        `Projection includes actual balance from ${lastActual.date}`;
    }
  }

  return {
    balance,
    source,
    payment: fixedPeriodExpired ? null : payment,
    plan,
    remainingMonths,
    fixedPeriodExpired
  };
}

function contribution(asset, entry, date) {
  if (!entry || !activeAt(asset, date)) return 0;

  const value = Number(entry.value);

  if (asset.category === 'debt') {
    return -value;
  }

  if (asset.category === 'real_estate') {
    return (
      value *
      shareAt(asset, date) /
      100
    ) - mortgageAt(asset, date).balance;
  }

  return value;
}

function netWorth(date) {
  const latest = latestValues(date);

  return assets.reduce(
    (sum, asset) =>
      sum + contribution(
        asset,
        latest.get(asset.id),
        date
      ),
    0
  );
}

function accessible(date) {
  const latest = latestValues(date);

  return assets.reduce((sum, asset) => {
    if (!activeAt(asset, date)) return sum;

    const entry = latest.get(asset.id);

    if (!entry) return sum;

    if (asset.category === 'debt') {
      return asset.subtract_debt_from_accessible
        ? sum + contribution(asset, entry, date)
        : sum;
    }

    if (asset.category === 'real_estate') {
      return sum;
    }

    if (asset.category === 'fixed_deposit') {
      return asset.maturity_date &&
        asset.maturity_date <= date
          ? sum + Number(entry.value)
          : sum;
    }

    return asset.accessible
      ? sum + Number(entry.value)
      : sum;
  }, 0);
}
