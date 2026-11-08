'use strict';

function valueAgeDays(entry, date) {
  if (!entry) return null;

  return Math.max(
    0,
    Math.floor(
      (
        Date.parse(date + 'T12:00:00Z') -
        Date.parse(entry.date + 'T12:00:00Z')
      ) / 86400000
    )
  );
}

function freshnessDays(asset) {
  if (asset.category === 'real_estate') return 365;

  if (
    ['fixed_deposit', 'other', 'custom']
      .includes(asset.category)
  ) {
    return 90;
  }

  return 30;
}

function mortgageEvidence(asset, date) {
  const mortgage = mortgageAt(asset, date);

  const planActuals = overrides.filter(
    actual =>
      actual.asset_id === asset.id &&
      actual.date <= date &&
      (
        !mortgage.plan ||
        actual.date >= mortgage.plan.effective_date
      )
  );

  const lastActual = planActuals.at(-1) ?? null;

  if (mortgage.fixedPeriodExpired) {
    return {
      label: 'Fixed-interest period ended',
      warning: true,
      explanation:
        `Payments are no longer projected using the expired rate. ` +
        `The displayed balance needs review. ${mortgage.source}.`
    };
  }

  if (mortgage.plan) {
    if (lastActual?.date === date) {
      return {
        label: 'Actual balance recorded',
        warning: false,
        explanation:
          `Mortgage balance entered for ${date}.`
      };
    }

    return {
      label: 'Mortgage projection',
      warning: false,
      explanation:
        lastActual
          ? `Projected using the plan and an actual balance ` +
            `recorded ${lastActual.date}.`
          : 'Projected using the mortgage plan.'
    };
  }

  if (lastActual) {
    return {
      label: 'Manual balance carried forward',
      warning: false,
      explanation:
        `Last mortgage balance entered ${lastActual.date}; ` +
        `no automatic payment projection.`
    };
  }

  return {
    label: 'Mortgage balance missing',
    warning: true,
    explanation:
      'No mortgage plan or actual mortgage balance is recorded. ' +
      'The calculation currently assumes a balance of €0.'
  };
}

function renderReliability(date, active, latest) {
  const withValues = active.filter(
    asset => latest.has(asset.id)
  );

  const missing = active.filter(
    asset => !latest.has(asset.id)
  );

  const older = withValues.filter(asset =>
    valueAgeDays(latest.get(asset.id), date) >
    freshnessDays(asset)
  );

  const recentCount =
    withValues.length - older.length;

  const propertyStates = withValues
    .filter(asset => asset.category === 'real_estate')
    .map(asset => ({
      asset,
      evidence: mortgageEvidence(asset, date)
    }));

  const projections = propertyStates.filter(
    item =>
      item.evidence.label === 'Mortgage projection'
  );

  const mortgageWarnings = propertyStates.filter(
    item => item.evidence.warning
  );

  const attentionCount = new Set([
    ...missing.map(asset => asset.id),
    ...older.map(asset => asset.id),
    ...mortgageWarnings.map(item => item.asset.id)
  ]).size;

  $('stale').textContent = attentionCount
    ? `${attentionCount} items`
    : 'Up to date';

  $('reliability-summary').textContent =
    attentionCount
      ? `${attentionCount} need attention`
      : 'No issues flagged';

  const summary = `
    <p class="small">
      <strong>${withValues.length}</strong> items included ·
      <strong>${recentCount}</strong> recently recorded ·
      <strong>${older.length}</strong> older values carried forward ·
      <strong>${projections.length}</strong> mortgage projections ·
      <strong>${missing.length}</strong> items without a value
    </p>
  `;

  const issues = [
    ...missing.map(asset => ({
      name: asset.name,
      label: 'No value',
      explanation:
        'This item is not contributing to the displayed net worth.'
    })),

    ...older.map(asset => {
      const entry = latest.get(asset.id);

      return {
        name: asset.name,
        label: 'Older value',
        explanation:
          `Value from ${entry.date} is being carried forward.`
      };
    }),

    ...mortgageWarnings.map(({ asset, evidence }) => ({
      name: asset.name,
      label: evidence.label,
      explanation: evidence.explanation
    }))
  ];

  $('reliability-content').innerHTML =
    summary +
    (
      issues.length
        ? `
          <div class="transparency-list"
               style="margin-top:13px">
            ${issues.map(issue => `
              <div class="transparency-item">
                <div class="row">
                  <strong>${esc(issue.name)}</strong>

                  <span class="status warning">
                    ${esc(issue.label)}
                  </span>
                </div>

                <p class="muted small">
                  ${esc(issue.explanation)}
                </p>
              </div>
            `).join('')}
          </div>
        `
        : `
          <p class="notice green"
             style="margin-top:13px">
            No missing values, older values, or mortgage
            warnings were identified for this date.
          </p>
        `
    );

  if (projections.length) {
    $('reliability-content').insertAdjacentHTML(
      'beforeend',
      `
        <p class="muted small" style="margin-top:12px">
          Projected mortgage balances:
          ${projections.map(
            item => esc(item.asset.name)
          ).join(', ')}.
          Check these against your lender periodically.
        </p>
      `
    );
  }

  if (!active.length) {
    $('reliability-summary').textContent = 'No active items';

    $('reliability-content').innerHTML = `
      <p class="muted small">
        Add an item to start building your net-worth estimate.
      </p>
    `;
  }
}

function renderNetWorthComposition(date, active, latest) {
  const groups = new Map();

  for (const asset of active) {
    const name = categoryName(asset);

    if (!groups.has(name)) {
      groups.set(name, []);
    }

    groups.get(name).push(asset);
  }

  $('breakdown').innerHTML = groups.size
    ? [...groups].map(([name, items]) => {
        const total = items.reduce(
          (sum, asset) =>
            sum + contribution(
              asset,
              latest.get(asset.id),
              date
            ),
          0
        );

        return `
          <details class="category-details">
            <summary>
              <span class="category-name">${esc(name)}</span>

              <strong class="${total < 0 ? 'negative' : ''}">
                ${money(total)}
              </strong>
            </summary>

            <div class="category-items">
              ${items.map(asset => {
                const entry = latest.get(asset.id);

                if (!entry) {
                  return `
                    <div class="transparency-item"
                         style="margin-bottom:8px">
                      <strong>${esc(asset.name)}</strong>

                      <p class="muted small">
                        No recorded value; contributes €0
                        to this estimate.
                      </p>
                    </div>
                  `;
                }

                const amount = contribution(
                  asset,
                  entry,
                  date
                );

                let explanation =
                  `Value from ${entry.date} carried ` +
                  `forward to ${date}.`;

                if (asset.category === 'real_estate') {
                  const share = shareAt(asset, date);

                  const shareValue =
                    Number(entry.value) *
                    share / 100;

                  const mortgage = mortgageAt(
                    asset,
                    date
                  );

                  const evidence = mortgageEvidence(
                    asset,
                    date
                  );

                  explanation =
                    `Full property value ${money(entry.value)} ` +
                    `from ${entry.date} × ${share}% ownership ` +
                    `= ${money(shareValue)}; minus mortgage ` +
                    `${money(mortgage.balance)} ` +
                    `= ${money(amount)}. ` +
                    `${evidence.explanation}`;
                } else if (asset.category === 'debt') {
                  explanation =
                    `Amount owed ${money(entry.value)} ` +
                    `from ${entry.date}; subtracts ` +
                    `${money(entry.value)} from net worth.`;
                }

                return `
                  <div class="transparency-item"
                       style="margin-bottom:8px">
                    <div class="row">
                      <strong>${esc(asset.name)}</strong>

                      <strong class="${
                        amount < 0 ? 'negative' : ''
                      }">
                        ${money(amount)}
                      </strong>
                    </div>

                    <p class="muted small">
                      ${esc(explanation)}
                    </p>
                  </div>
                `;
              }).join('')}
            </div>
          </details>
        `;
      }).join('')
    : `
      <p class="muted small" style="margin-top:13px">
        Add an item to get started.
      </p>
    `;
}

function renderChangeExplanation(date) {
  const previous = monthEndBefore(date);
  const before = latestValues(previous);
  const after = latestValues(date);

  const groups = {
    propertyValues: [],
    mortgageBalances: [],
    ownership: [],
    otherValues: [],
    newlyTracked: [],
    archived: []
  };

  function add(group, name, amount) {
    if (Math.abs(amount) >= .005) {
      groups[group].push({ name, amount });
    }
  }

  for (const asset of assets) {
    const oldEntry = before.get(asset.id);
    const newEntry = after.get(asset.id);

    const wasIncluded =
      activeAt(asset, previous) &&
      Boolean(oldEntry);

    const isIncluded =
      activeAt(asset, date) &&
      Boolean(newEntry);

    const oldContribution = contribution(
      asset,
      oldEntry,
      previous
    );

    const newContribution = contribution(
      asset,
      newEntry,
      date
    );

    if (wasIncluded && !isIncluded) {
      add(
        'archived',
        asset.name,
        -oldContribution
      );
      continue;
    }

    if (!wasIncluded && isIncluded) {
      add(
        'newlyTracked',
        asset.name,
        newContribution
      );
      continue;
    }

    if (!wasIncluded || !isIncluded) {
      continue;
    }

    if (asset.category !== 'real_estate') {
      add(
        'otherValues',
        asset.name,
        newContribution -
        oldContribution
      );
      continue;
    }

    const oldShare = shareAt(asset, previous) / 100;
    const newShare = shareAt(asset, date) / 100;

    const oldValue = Number(oldEntry.value);
    const newValue = Number(newEntry.value);

    /*
     * Split the property contribution into ownership,
     * recorded property value, and mortgage components.
     * Together they equal the total contribution change.
     */
    add(
      'ownership',
      asset.name,
      oldValue * (newShare - oldShare)
    );

    add(
      'propertyValues',
      asset.name,
      (newValue - oldValue) * newShare
    );

    add(
      'mortgageBalances',
      asset.name,
      mortgageAt(asset, previous).balance -
      mortgageAt(asset, date).balance
    );
  }

  const definitions = [
    [
      'propertyValues',
      'Recorded property-value changes'
    ],
    [
      'mortgageBalances',
      'Mortgage-balance changes'
    ],
    [
      'ownership',
      'Ownership-percentage changes'
    ],
    [
      'otherValues',
      'Other asset and debt changes'
    ],
    [
      'newlyTracked',
      'Newly tracked items'
    ],
    [
      'archived',
      'Archived items'
    ]
  ];

  $('changes-period').textContent =
    `${previous} → ${date}`;

  $('changes').innerHTML =
    definitions.map(([key, heading]) => {
      const rows = groups[key].sort(
        (a, b) =>
          Math.abs(b.amount) -
          Math.abs(a.amount)
      );

      if (!rows.length) return '';

      const subtotal = rows.reduce(
        (sum, row) => sum + row.amount,
        0
      );

      return `
        <div class="change-group">
          <div class="line">
            <h3>${heading}</h3>

            <strong class="${
              subtotal < 0 ? 'negative' : ''
            }">
              ${subtotal >= 0 ? '+' : ''}${money(subtotal)}
            </strong>
          </div>

          ${rows.map(row => `
            <div class="line">
              <span>${esc(row.name)}</span>

              <span class="${
                row.amount < 0 ? 'negative' : ''
              }">
                ${row.amount >= 0 ? '+' : ''}${money(row.amount)}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }).join('') ||
    `
      <p class="muted small" style="margin-top:13px">
        No recorded change in this period.
      </p>
    `;

  if (groups.archived.length) {
    $('changes').insertAdjacentHTML(
      'beforeend',
      `
        <p class="notice" style="margin-top:14px">
          Archiving removes an item from tracked net worth.
          It does not mean the money was lost or a debt was repaid.
        </p>
      `
    );
  }
}

function renderDashboard() {
  const date = $('asof').value || dateToday();
  const latest = latestValues(date);

  const active = assets.filter(
    asset => activeAt(asset, date)
  );

  $('historical').classList.toggle(
    'hidden',
    date === dateToday()
  );

  $('review-link').classList.toggle(
    'hidden',
    date !== dateToday()
  );

  $('networth').textContent =
    money(netWorth(date));

  $('accessible').textContent =
    money(accessible(date));

  $('net-caption').textContent =
    `As of ${date} · last known values carried forward`;

  renderReliability(date, active, latest);
  renderNetWorthComposition(date, active, latest);
  renderChangeExplanation(date);
  renderChart(date);
}

$('asof').onchange = () => {
  if (
    !$('asof').value ||
    $('asof').value > dateToday()
  ) {
    $('asof').value = dateToday();
  }

  renderDashboard();
};

$('today-button').onclick = () => {
  $('asof').value = dateToday();
  renderDashboard();
};

$('chart-range').onchange = () => renderDashboard();

function renderChart(date) {
  const dates = new Set(
    valuations
      .filter(valuation => valuation.date <= date)
      .map(valuation => valuation.date)
  );

  for (const asset of assets) {
    if (
      asset.archived_on &&
      asset.archived_on <= date
    ) {
      dates.add(asset.archived_on);
    }
  }

  for (const change of ownership) {
    if (change.effective_date <= date) {
      dates.add(change.effective_date);
    }
  }

  for (const plan of plans) {
    if (plan.effective_date <= date) {
      dates.add(plan.effective_date);
    }

    if (
      plan.fixed_interest_end_date &&
      plan.fixed_interest_end_date <= date
    ) {
      dates.add(plan.fixed_interest_end_date);
    }
  }

  for (const plan of plans) {
    const end = plan.fixed_interest_end_date &&
      plan.fixed_interest_end_date < date
        ? plan.fixed_interest_end_date
        : date;

    const count = plan.total_duration_months == null
      ? Number(plan.term_months)
      : Number(plan.total_duration_months);

    for (let i = 0; i < count; i++) {
      const due = addMonths(plan.first_payment_date, i);

      if (due > end) break;

      if (due >= plan.effective_date) {
        dates.add(due);
      }
    }
  }

  for (const actual of overrides) {
    if (actual.date <= date) {
      dates.add(actual.date);
    }
  }

  const all = [...dates].sort();
  const range = $('chart-range').value;

  const cutoff = range === 'all'
    ? null
    : addMonths(date, -Number(range));

  const points = all.filter(
    point => !cutoff || point >= cutoff
  );

  if (
    cutoff &&
    all.some(point => point < cutoff)
  ) {
    points.unshift(cutoff);
  }

  if (
    all.length &&
    !points.includes(date)
  ) {
    points.push(date);
  }

  if (chart) {
    chart.destroy();
    chart = null;
  }

  $('chart-wrap').classList.toggle(
    'hidden',
    points.length < 2
  );

  $('chart-empty').classList.toggle(
    'hidden',
    points.length >= 2
  );

  $('chart-caption').textContent =
    points.length >= 2
      ? `${money(netWorth(points[0]))} → ${money(netWorth(points.at(-1)))}`
      : 'Not enough history in this range.';

  if (points.length < 2) return;

  chart = new Chart($('chart'), {
    type: 'line',

    data: {
      labels: points,

      datasets: [{
        data: points.map(netWorth),
        borderColor: '#167453',
        backgroundColor: '#16745318',
        fill: true,
        pointRadius: points.length > 30 ? 0 : 3,
        tension: .15
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: { display: false },

        tooltip: {
          callbacks: {
            label: context =>
              `Net worth: ${money(context.parsed.y)}`
          }
        }
      },

      scales: {
        x: {
          ticks: { maxTicksLimit: 6 },
          grid: { display: false }
        },

        y: {
          ticks: {
            callback: value => money(value)
          }
        }
      }
    }
  });
}

/* ============================================================
   ITEMS
   ============================================================ */
