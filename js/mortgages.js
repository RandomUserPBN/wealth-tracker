'use strict';

function mortgageDialog(asset) {
  if (asset.category !== 'real_estate') return;

  const current = mortgageAt(asset, dateToday());

  const assetPlans = plans
    .filter(plan => plan.asset_id === asset.id)
    .reverse();

  const actuals = overrides
    .filter(actual => actual.asset_id === asset.id)
    .reverse();

  dialog({
    eyebrow: 'Property mortgage',
    title: asset.name,

    description:
      'Use the original payment date and total duration. Remaining payments are calculated automatically.',

    body: `
      <div class="notice green" style="margin-top:16px">
        Estimated balance:
        <strong>${money(current.balance)}</strong>

        <br>${esc(current.source)}

        ${current.plan?.fixed_interest_end_date
          ? `
            <br>Fixed interest until:
            <strong>
              ${current.plan.fixed_interest_end_date}
            </strong>
          `
          : ''}

        ${current.plan
          ? `
            <br>Remaining payments at plan start:
            <strong>
              ${current.remainingMonths}
              (${formatDuration(current.remainingMonths)})
            </strong>
          `
          : ''}

        ${current.payment !== null
          ? `
            <br>Calculated regular payment:
            <strong>${money(current.payment)}/month</strong>
          `
          : ''}
      </div>

      ${current.fixedPeriodExpired
        ? `
          <div class="notice">
            <strong>Fixed-interest period ended.</strong>
            Payments after that date are not projected
            using the expired rate. Enter an actual balance
            or create a new plan.
          </div>
        `
        : ''}

      <h3 style="margin-top:25px">
        <span id="plan-form-title">
          Add a mortgage plan
        </span>
      </h3>

      <p class="muted small">
        If the mortgage started years ago, enter its
        <strong>original first payment date</strong> and
        <strong>total duration</strong>. The opening balance
        should be the balance on the plan start date.
        For a refinance, create a new plan with its new
        total duration and first payment date.
      </p>

      <div class="form-grid">
        <div>
          <label for="plan-date">
            Plan starts / balance date
          </label>

          <input id="plan-date"
                 class="field"
                 type="date"
                 max="${dateToday()}"
                 value="${dateToday()}">
        </div>

        <div>
          <label for="plan-opening">
            Balance at plan start (€)
          </label>

          <input id="plan-opening"
                 class="field"
                 type="text"
                 inputmode="decimal"
                 value="${esc(inputMoney(current.balance))}">
        </div>

        <div>
          <label for="plan-rate">
            Annual interest rate (%)
          </label>

          <input id="plan-rate"
                 class="field"
                 type="text"
                 inputmode="decimal"
                 placeholder="e.g. 3,5">
        </div>

        <div>
          <label for="plan-first">
            Original first payment date
          </label>

          <input id="plan-first"
                 class="field"
                 type="date">
        </div>

        <div>
          <label for="plan-years">
            Total duration in years
          </label>

          <input id="plan-years"
                 class="field"
                 type="number"
                 min="0"
                 max="50"
                 value="20">
        </div>

        <div>
          <label for="plan-months">
            Additional months
          </label>

          <input id="plan-months"
                 class="field"
                 type="number"
                 min="0"
                 max="11"
                 value="0">
        </div>

        <div class="full">
          <label for="plan-fixed-end">
            Fixed interest until
          </label>

          <input id="plan-fixed-end"
                 class="field"
                 type="date">

          <p class="muted small">
            This can end well before the mortgage's
            total duration.
          </p>
        </div>

        <div id="plan-preview"
             class="notice green full">
          Enter the dates, balance, interest rate
          and total duration to see the calculated
          remaining payments and monthly payment.
        </div>

        <div class="full actions">
          <button id="plan-save"
                  class="button"
                  type="button">
            Save mortgage plan
          </button>

          <button id="plan-new"
                  class="button secondary small hidden"
                  type="button">
            Start a new plan
          </button>
        </div>
      </div>

      <h3 style="margin-top:26px">
        Record an actual balance
      </h3>

      <p class="muted small">
        Enter a balance reported by your lender.
        It overrides the projection on that date.
      </p>

      <div class="form-grid">
        <div>
          <label for="actual-date">Date</label>

          <input id="actual-date"
                 class="field"
                 type="date"
                 max="${dateToday()}"
                 value="${dateToday()}">
        </div>

        <div>
          <label for="actual-balance">
            Actual balance (€)
          </label>

          <input id="actual-balance"
                 class="field"
                 type="text"
                 inputmode="decimal"
                 value="${esc(inputMoney(current.balance))}">
        </div>

        <div class="full">
          <button id="actual-save"
                  class="button secondary"
                  type="button">
            Save actual balance
          </button>
        </div>
      </div>

      <h3 style="margin-top:26px">
        Mortgage plans
      </h3>

      <div id="plan-list">
        ${assetPlans.length
          ? assetPlans.map(plan => {
              const legacy =
                plan.total_duration_months == null;

              const remaining =
                planRemainingMonths(plan);

              return `
                <div class="history-row"
                     data-plan="${plan.id}">
                  <span class="small">
                    <strong>${plan.effective_date}</strong>

                    ${legacy
                      ? ' · Legacy plan: previously entered remaining term'
                      : ` · Total duration ${
                          formatDuration(
                            Number(plan.total_duration_months)
                          )
                        }`}

                    · Remaining at plan start
                    <strong>
                      ${formatDuration(remaining)}
                    </strong>

                    · First payment ${plan.first_payment_date}

                    · Opening balance
                    ${money(plan.opening_balance)}

                    · ${plan.annual_rate}% annual rate

                    · Fixed interest until
                    <strong>
                      ${plan.fixed_interest_end_date ??
                        'not recorded'}
                    </strong>

                    · Calculated payment
                    ${money(
                      annuity(
                        Number(plan.opening_balance),
                        Number(plan.annual_rate),
                        remaining
                      )
                    )}/month
                  </span>

                  <span class="actions">
                    <button class="button secondary small edit-plan"
                            type="button">
                      Edit
                    </button>

                    <button class="button danger small delete-plan"
                            type="button">
                      Delete
                    </button>
                  </span>
                </div>
              `;
            }).join('')
          : '<p class="muted small">No plan yet.</p>'}
      </div>

      <h3 style="margin-top:23px">
        Actual balances
      </h3>

      <div id="actual-list">
        ${actuals.length
          ? actuals.map(actual => `
              <div class="history-row"
                   data-actual="${actual.id}">
                <span>
                  ${actual.date} · ${money(actual.balance)}
                </span>

                <button class="button danger small delete-actual"
                        type="button">
                  Delete
                </button>
              </div>
            `).join('')
          : `
            <p class="muted small">
              No actual balances entered.
            </p>
          `}
      </div>

      <p class="notice" style="margin-top:17px">
        This is a simplified fixed-rate monthly model.
        It excludes fees, insurance, daily interest,
        payment holidays and unscheduled repayments.
        Confirm balances with your lender.
      </p>
    `,

    footer: `
      <button id="mortgage-close"
              class="button secondary"
              type="button">
        Close
      </button>
    `
  });

  $('mortgage-close').onclick = closeDialog;

  function formNumbers() {
    const yearsText = $('plan-years').value;
    const monthsText = $('plan-months').value;

    if (
      !/^\d+$/.test(yearsText) ||
      !/^\d+$/.test(monthsText)
    ) {
      return null;
    }

    const years = Number(yearsText);
    const months = Number(monthsText);
    const totalMonths = years * 12 + months;

    if (
      years < 0 ||
      months < 0 ||
      months > 11 ||
      totalMonths < 1 ||
      totalMonths > 600
    ) {
      return null;
    }

    return { years, months, totalMonths };
  }

  function calculatedRemaining() {
    const duration = formNumbers();
    const effective = $('plan-date').value;
    const first = $('plan-first').value;

    if (!duration || !effective || !first) return null;

    let elapsed = 0;

    for (let i = 0; i < duration.totalMonths; i++) {
      if (addMonths(first, i) < effective) {
        elapsed++;
      } else {
        break;
      }
    }

    return duration.totalMonths - elapsed;
  }

  function preview() {
    const principal = parseMoney(
      $('plan-opening').value
    );

    const rate = decimal(
      $('plan-rate').value
    );

    const remaining =
      calculatedRemaining();

    if (
      principal === null ||
      rate === null ||
      remaining === null ||
      remaining < 1
    ) {
      $('plan-preview').textContent =
        'Enter valid dates, balance, rate and total duration. ' +
        'At least one payment must remain when the plan starts.';

      return;
    }

    $('plan-preview').textContent =
      `Calculated remaining term at plan start: ` +
      `${formatDuration(remaining)} ` +
      `(${remaining} payments). ` +
      `Estimated monthly payment: ` +
      `${money(annuity(principal, rate, remaining))}.`;
  }

  for (const id of [
    'plan-date',
    'plan-opening',
    'plan-rate',
    'plan-first',
    'plan-years',
    'plan-months'
  ]) {
    $(id).addEventListener('input', preview);
    $(id).addEventListener('change', preview);
  }

  function resetPlanForm() {
    $('plan-date').readOnly = false;
    $('plan-date').value = dateToday();
    $('plan-opening').value = inputMoney(current.balance);
    $('plan-rate').value = '';
    $('plan-first').value = '';
    $('plan-years').value = '20';
    $('plan-months').value = '0';
    $('plan-fixed-end').value = '';

    $('plan-form-title').textContent =
      'Add a mortgage plan';

    $('plan-new').classList.add('hidden');

    dialogError('');
    preview();
  }

  $('plan-new').onclick = resetPlanForm;

  $('plan-list').onclick = event => {
    const row = event.target.closest('[data-plan]');

    if (!row) return;

    const plan = plans.find(
      item => item.id === row.dataset.plan
    );

    if (!plan) return;

    if (event.target.closest('.edit-plan')) {
      $('plan-date').value = plan.effective_date;
      $('plan-date').readOnly = true;

      $('plan-opening').value =
        inputMoney(plan.opening_balance);

      $('plan-rate').value =
        inputMoney(plan.annual_rate);

      $('plan-first').value =
        plan.first_payment_date;

      const displayedMonths =
        plan.total_duration_months == null
          ? Number(plan.term_months)
          : Number(plan.total_duration_months);

      $('plan-years').value =
        Math.floor(displayedMonths / 12);

      $('plan-months').value =
        displayedMonths % 12;

      $('plan-fixed-end').value =
        plan.fixed_interest_end_date ?? '';

      $('plan-form-title').textContent =
        `Edit plan from ${plan.effective_date}`;

      $('plan-new').classList.remove('hidden');

      dialogError(
        plan.total_duration_months == null
          ? 'Legacy plan: verify the ORIGINAL first payment date and TOTAL duration before saving. The pre-filled duration is the old remaining term.'
          : ''
      );

      preview();

      $('plan-date').scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      return;
    }

    if (event.target.closest('.delete-plan')) {
      confirmDialog(
        'Delete mortgage plan?',
        'This can change projected balances and historical net worth.',
        'Delete plan',
        async () => {
          const { error } = await db
            .from('property_loan_plans')
            .delete()
            .eq('id', plan.id);

          if (error) throw error;

          await load();
          showToast('Mortgage plan deleted.');
        }
      );
    }
  };

  $('plan-save').onclick = async () => {
    const effective = $('plan-date').value;
    const first = $('plan-first').value;
    const fixedEnd = $('plan-fixed-end').value;

    const principal = parseMoney(
      $('plan-opening').value
    );

    const rate = decimal(
      $('plan-rate').value
    );

    const duration = formNumbers();
    const remaining = calculatedRemaining();

    if (
      !effective ||
      effective > dateToday() ||
      !first ||
      !fixedEnd ||
      fixedEnd < effective ||
      principal === null ||
      rate === null ||
      !duration ||
      remaining === null ||
      remaining < 1
    ) {
      dialogError(
        'Check the dates, balance, rate and total duration. ' +
        'At least one scheduled payment must remain on the ' +
        'plan start date. Fixed interest must end on or ' +
        'after the plan start date.'
      );

      return;
    }

    $('plan-save').disabled = true;

    const { error } = await db
      .from('property_loan_plans')
      .upsert(
        {
          asset_id: asset.id,
          effective_date: effective,
          opening_balance: principal,
          annual_rate: rate,
          term_months: remaining,
          total_duration_months:
            duration.totalMonths,
          first_payment_date: first,
          fixed_interest_end_date: fixedEnd
        },
        {
          onConflict: 'asset_id,effective_date'
        }
      );

    if (error) {
      dialogError(error.message);
      $('plan-save').disabled = false;
    } else {
      await load();
      mortgageDialog(asset);

      showToast(
        'Mortgage plan saved. Check the projected balance.'
      );
    }
  };

  $('actual-save').onclick = async () => {
    const date = $('actual-date').value;

    const balance = parseMoney(
      $('actual-balance').value
    );

    if (
      !date ||
      date > dateToday() ||
      balance === null
    ) {
      dialogError(
        'Enter a valid date and non-negative balance.'
      );

      return;
    }

    $('actual-save').disabled = true;

    const { error } = await db
      .from('property_mortgage_overrides')
      .upsert(
        {
          asset_id: asset.id,
          date,
          balance
        },
        {
          onConflict: 'asset_id,date'
        }
      );

    if (error) {
      dialogError(error.message);
      $('actual-save').disabled = false;
    } else {
      await load();
      mortgageDialog(asset);

      showToast('Actual mortgage balance saved.');
    }
  };

  $('actual-list').onclick = event => {
    const row = event.target.closest('[data-actual]');

    if (
      !row ||
      !event.target.closest('.delete-actual')
    ) {
      return;
    }

    confirmDialog(
      'Delete actual mortgage balance?',
      'The balance on this date and future projections may change.',
      'Delete balance',
      async () => {
        const { error } = await db
          .from('property_mortgage_overrides')
          .delete()
          .eq('id', row.dataset.actual);

        if (error) throw error;

        await load();
        showToast('Actual balance deleted.');
      }
    );
  };
}

/* ============================================================
   CSV EXPORT
   ============================================================ */
