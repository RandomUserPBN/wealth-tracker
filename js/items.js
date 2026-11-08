'use strict';

function renderItems() {
  const active = assets.filter(
    asset => !asset.archived_on
  );

  const archived = assets.filter(
    asset => asset.archived_on
  );

  const latest = latestValues(dateToday());

  $('item-count').textContent =
    `${active.length} active items`;

  $('archived-count').textContent =
    archived.length;

  $('item-list').innerHTML = active.length
    ? active.map((asset, index) => {
        const entry = latest.get(asset.id);

        const mortgage =
          asset.category === 'real_estate'
            ? mortgageAt(asset, dateToday())
            : null;

        const detail = [
          categoryName(asset),

          asset.category === 'real_estate'
            ? `${shareAt(asset, dateToday())}% owned`
            : '',

          mortgage
            ? `Mortgage ${money(mortgage.balance)} · ${mortgage.source}`
            : '',

          mortgage?.plan?.fixed_interest_end_date
            ? `Fixed interest until ${mortgage.plan.fixed_interest_end_date}`
            : '',

          asset.category === 'fixed_deposit' &&
          asset.maturity_date
            ? `Fixed until ${asset.maturity_date}`
            : '',

          entry
            ? `Property/asset value updated ${entry.date}`
            : 'No value recorded'
        ].filter(Boolean).join(' · ');

        return `
          <div class="asset-row" data-id="${asset.id}">
            <div>
              <button class="drag" type="button"
                      aria-label="Drag ${esc(asset.name)} to reorder">
                ⋮⋮
              </button>

              <button class="move up" type="button"
                      aria-label="Move ${esc(asset.name)} up"
                      ${index === 0 ? 'disabled' : ''}>↑</button>

              <button class="move down" type="button"
                      aria-label="Move ${esc(asset.name)} down"
                      ${index === active.length - 1
                        ? 'disabled'
                        : ''}>↓</button>
            </div>

            <div>
              <strong>${esc(asset.name)}</strong>
              <p class="muted small">${esc(detail)}</p>
            </div>

            <div class="amount">
              ${entry
                ? money(contribution(asset, entry, dateToday()))
                : '—'}
            </div>

            <div class="actions">
              <button class="button secondary small details"
                      type="button">Details</button>

              <button class="button secondary small edit"
                      type="button">Edit</button>
            </div>
          </div>
        `;
      }).join('')
    : `
      <div class="empty" style="margin-top:15px">
        No active items.
      </div>
    `;

  $('archived-list').classList.toggle(
    'hidden',
    !archivedOpen
  );

  $('archived-toggle').setAttribute(
    'aria-expanded',
    String(archivedOpen)
  );

  $('archived-list').innerHTML =
    archived.map(asset => `
      <div class="line" data-archived="${asset.id}">
        <span>
          ${esc(asset.name)} · Archived ${asset.archived_on}
        </span>

        <span class="actions">
          <button class="button secondary small details"
                  type="button">History</button>

          <button class="button secondary small restore"
                  type="button">Restore</button>
        </span>
      </div>
    `).join('') ||
    '<p class="muted small">No archived items.</p>';

  if (!sortable && window.Sortable) {
    sortable = Sortable.create(
      $('item-list'),
      {
        animation: 160,
        handle: '.drag',
        draggable: '.asset-row[data-id]',
        ghostClass: 'sort-ghost',
        forceFallback: true,
        fallbackOnBody: true,
        onEnd: saveOrder
      }
    );
  }
}

async function saveOrder() {
  if (orderBusy || !userId) return;

  const ids = [
    ...$('item-list').querySelectorAll('[data-id]')
  ].map(row => row.dataset.id);

  const old = assets
    .filter(asset => !asset.archived_on)
    .map(asset => asset.id);

  if (ids.join(',') === old.join(',')) return;

  orderBusy = true;

  if (sortable) {
    sortable.option('disabled', true);
  }

  const { error } = await db.rpc(
    'reorder_my_assets',
    { p_ids: ids }
  );

  orderBusy = false;

  if (sortable) {
    sortable.option('disabled', false);
  }

  await load();

  showToast(
    error ? error.message : 'Order saved.',
    Boolean(error)
  );
}

$('item-list').onclick = async event => {
  const button = event.target.closest('button');
  const row = event.target.closest('[data-id]');

  if (!button || !row) return;

  const asset = assets.find(
    item => item.id === row.dataset.id
  );

  if (!asset) return;

  if (
    button.classList.contains('up') ||
    button.classList.contains('down')
  ) {
    if (orderBusy) return;

    const other = button.classList.contains('up')
      ? row.previousElementSibling
      : row.nextElementSibling;

    if (!other?.dataset.id) return;

    if (button.classList.contains('up')) {
      row.parentNode.insertBefore(row, other);
    } else {
      row.parentNode.insertBefore(other, row);
    }

    await saveOrder();
  } else if (
    button.classList.contains('details')
  ) {
    detailsDialog(asset);
  } else if (
    button.classList.contains('edit')
  ) {
    editDialog(asset);
  }
};

$('archived-toggle').onclick = () => {
  archivedOpen = !archivedOpen;
  renderItems();
};

$('archived-list').onclick = event => {
  const button = event.target.closest('button');
  const row = event.target.closest('[data-archived]');

  if (!button || !row) return;

  const asset = assets.find(
    item => item.id === row.dataset.archived
  );

  if (!asset) return;

  if (button.classList.contains('details')) {
    detailsDialog(asset);
  }

  if (button.classList.contains('restore')) {
    confirmDialog(
      `Restore ${asset.name}?`,
      'Its last recorded values will count again. Review them after restoring.',
      'Restore item',
      async () => {
        const { error } = await db
          .from('assets')
          .update({ archived_on: null })
          .eq('id', asset.id);

        if (error) throw error;

        await load();
        showToast('Item restored.');
      }
    );
  }
};

/* ============================================================
   CHECK-IN
   ============================================================ */
