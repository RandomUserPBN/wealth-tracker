'use strict';

function csvCell(value) {
  let text = String(value ?? '');

  if (/^\s*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

$('export').onclick = () => {
  if (!assets.length) {
    showToast('Nothing to export.', true);
    return;
  }

  const rows = [[
    'Record type',
    'Item ID',
    'Name',
    'Category',
    'Date',
    'Value EUR',
    'Mortgage EUR',
    'Ownership percent',
    'Annual rate percent',
    'Remaining months at plan start',
    'Total duration months',
    'Original first payment date',
    'Fixed interest until',
    'Archived on',
    'Accessible',
    'Subtract debt from accessible',
    'Fixed deposit until'
  ]];

  for (const asset of assets) {
    const common = [
      asset.id,
      asset.name,
      categoryName(asset)
    ];

    rows.push([
      'Item',
      ...common,
      '',
      '',
      '',
      asset.ownership_percent ?? '',
      '',
      '',
      '',
      '',
      '',
      asset.archived_on ?? '',
      asset.accessible ? 'Yes' : 'No',
      asset.subtract_debt_from_accessible
        ? 'Yes'
        : 'No',
      asset.maturity_date ?? ''
    ]);

    for (
      const valuation of
      valuations.filter(
        item => item.asset_id === asset.id
      )
    ) {
      rows.push([
        'Valuation',
        ...common,
        valuation.date,
        valuation.value,

        asset.category === 'real_estate'
          ? mortgageAt(asset, valuation.date).balance
          : '',

        asset.category === 'real_estate'
          ? shareAt(asset, valuation.date)
          : '',

        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
    }

    for (
      const plan of
      plans.filter(
        item => item.asset_id === asset.id
      )
    ) {
      rows.push([
        'Loan plan',
        ...common,
        plan.effective_date,
        plan.opening_balance,
        '',
        '',
        plan.annual_rate,
        plan.term_months,
        plan.total_duration_months ?? '',
        plan.first_payment_date,
        plan.fixed_interest_end_date ?? '',
        '',
        '',
        '',
        ''
      ]);
    }

    for (
      const actual of
      overrides.filter(
        item => item.asset_id === asset.id
      )
    ) {
      rows.push([
        'Actual mortgage',
        ...common,
        actual.date,
        '',
        actual.balance,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
    }

    for (
      const change of
      ownership.filter(
        item => item.asset_id === asset.id
      )
    ) {
      rows.push([
        'Ownership change',
        ...common,
        change.effective_date,
        '',
        '',
        change.ownership_percent,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
    }
  }

  const csv = rows
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  const url = URL.createObjectURL(
    new Blob(
      ['\uFEFF', csv],
      { type: 'text/csv;charset=utf-8' }
    )
  );

  const link = document.createElement('a');

  link.href = url;
  link.download = `wealth-tracker-${dateToday()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
