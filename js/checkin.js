'use strict';

function renderCheckin() {
  const active = assets.filter(
    asset => !asset.archived_on
  );

  const latest = latestValues(dateToday());
  const first = dateToday().slice(0, 7) + '-01';

  const pending = active.filter(asset => {
    const valuation = latest.get(asset.id);

    return !valuation ||
      valuation.date < first;
  });

  const done = active.filter(
    asset => !pending.includes(asset)
  );

  $('checkin-count').textContent =
    `${done.length} of ${active.length} reviewed`;

  const percent = active.length
    ? Math.round(done.length / active.length * 100)
    : 0;

  $('progress-bar').style.width = percent + '%';

  document.querySelector('.progress')
    .setAttribute('aria-valuenow', String(percent));

  $('checkin-complete').classList.toggle(
    'hidden',
    !active.length || pending.length > 0
  );

  $('pending').innerHTML =
    pending.map(reviewCard).join('') ||
    (!active.length
      ? '<div class="empty">Add an item to start your check-in.</div>'
      : '');

  $('reviewed-count').textContent = done.length;

  $('reviewed-toggle').classList.toggle(
    'hidden',
    !done.length
  );

  $('reviewed-toggle').setAttribute(
    'aria-expanded',
    String(reviewedOpen)
  );

  $('reviewed').classList.toggle(
    'hidden',
    !reviewedOpen
  );

  $('reviewed').innerHTML =
    reviewedOpen
      ? done.map(reviewCard).join('')
      : '';
}

function reviewCard(asset) {
  const entry = latestValues(dateToday()).get(asset.id);
  const property = asset.category === 'real_estate';

  return `
    <div class="review" data-review="${asset.id}">
      <div class="row">
        <div>
          <strong>${esc(asset.name)}</strong>

          <p class="muted small">
            ${entry
              ? `Asset value last recorded ${entry.date}`
              : 'No value yet'}

            ${property
              ? ` · Mortgage estimate ${
                  money(mortgageAt(asset, dateToday()).balance)
                }`
              : ''}
          </p>
        </div>

        <strong>
          ${entry
            ? money(contribution(asset, entry, dateToday()))
            : '—'}
        </strong>
      </div>

      <div class="actions" style="margin-top:12px">
        <div style="width:min(220px,100%)">
          <label for="review-${asset.id}">
            ${property
              ? 'Full property value (€)'
              : asset.category === 'debt'
                ? 'Amount owed (€)'
                : 'Value (€)'}
          </label>

          <input id="review-${asset.id}"
                 class="field value"
                 type="text"
                 inputmode="decimal"
                 value="${esc(inputMoney(entry?.value))}">
        </div>

        <button class="button secondary save-review"
                type="button">Confirm / save</button>

        ${property
          ? `<button class="button secondary mortgage-link"
                     type="button">Mortgage details</button>`
          : ''}
      </div>

      <p class="error" role="alert"></p>
    </div>
  `;
}

$('reviewed-toggle').onclick = () => {
  reviewedOpen = !reviewedOpen;
  renderCheckin();
};

$('checkin').onclick = async event => {
  const row = event.target.closest('[data-review]');
  const button = event.target.closest('button');

  if (!row || !button) return;

  const asset = assets.find(
    item => item.id === row.dataset.review
  );

  if (!asset) return;

  if (button.classList.contains('mortgage-link')) {
    mortgageDialog(asset);
    return;
  }

  if (!button.classList.contains('save-review')) return;

  const value = parseMoney(
    row.querySelector('.value').value
  );

  if (value === null) {
    row.querySelector('.error').textContent =
      'Enter a non-negative amount, e.g. 1234,56.';
    return;
  }

  button.disabled = true;

  try {
    await saveValue(asset, dateToday(), value);
    await load();
    showToast(`${asset.name} reviewed.`);
  } catch (error) {
    button.disabled = false;
    row.querySelector('.error').textContent = error.message;
  }
};

async function saveValue(asset, date, value) {
  /*
   * Retain the legacy mortgage_value column for compatibility.
   * Live calculations use plans and actual balances.
   */
  const { error } = await db
    .from('valuations')
    .upsert(
      {
        asset_id: asset.id,
        date,
        value,
        mortgage_value:
          asset.category === 'real_estate'
            ? mortgageAt(asset, date).balance
            : 0
      },
      { onConflict: 'asset_id,date' }
    );

  if (error) throw error;
}

/* ============================================================
   DIALOGS AND ITEM FORMS
   ============================================================ */
