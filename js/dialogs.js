'use strict';

function dialog({
  eyebrow = '',
  title,
  description = '',
  body = '',
  footer = ''
}) {
  $('dialog-eyebrow').textContent = eyebrow;
  $('dialog-title').textContent = title;
  $('dialog-description').textContent = description;
  $('dialog-body').innerHTML = body;
  $('dialog-footer').innerHTML = footer;
  $('dialog-error').textContent = '';

  if (!$('dialog').open) {
    $('dialog').showModal();
  }
}

function closeDialog() {
  if ($('dialog').open) {
    $('dialog').close();
  }
}

function dialogError(message) {
  $('dialog-error').textContent = message;
}

$('dialog-close').onclick = closeDialog;

$('dialog').onclick = event => {
  if (event.target === $('dialog')) {
    closeDialog();
  }
};

function confirmDialog(title, description, label, action) {
  dialog({
    eyebrow: 'Please confirm',
    title,
    description,

    footer: `
      <button id="cancel-action"
              class="button secondary"
              type="button">Cancel</button>

      <button id="confirm-action"
              class="button danger"
              type="button">${esc(label)}</button>
    `
  });

  $('cancel-action').onclick = closeDialog;

  $('confirm-action').onclick = async () => {
    $('confirm-action').disabled = true;

    try {
      await action();
      closeDialog();
    } catch (error) {
      dialogError(error.message);
      $('confirm-action').disabled = false;
    }
  };
}

function options(selected) {
  return Object.entries(TYPES)
    .filter(
      ([key]) =>
        ['cash', 'stocks', 'crypto', 'other'].includes(key)
    )
    .map(([key, label]) => `
      <option value="${key}"
              ${selected === key ? 'selected' : ''}>
        ${label}
      </option>
    `).join('') +
    categories.map(category => `
      <option value="custom:${category.id}"
              ${selected === `custom:${category.id}`
                ? 'selected'
                : ''}>
        ${esc(category.name)}
      </option>
    `).join('');
}

function addDialog() {
  dialog({
    eyebrow: 'New item',
    title: 'What would you like to track?',
    description: 'Choose an item type to see the right fields.',

    body: `
      <div class="type-grid">
        ${Object.entries(TYPES).map(([key, label]) => `
          <button class="type" data-type="${key}"
                  type="button">
            <strong>${label}</strong>
          </button>
        `).join('')}
      </div>

      <div id="add-fields"></div>
    `,

    footer: `
      <button id="add-cancel" class="button secondary"
              type="button">Cancel</button>

      <button id="add-save" class="button hidden"
              type="button">Add item</button>
    `
  });

  $('add-cancel').onclick = closeDialog;

  $('dialog-body').querySelector('.type-grid').onclick = event => {
    const choice = event.target.closest('[data-type]');

    if (choice) selectType(choice.dataset.type);
  };
}

function selectType(type) {
  $('dialog-body')
    .querySelectorAll('.type')
    .forEach(button =>
      button.classList.toggle(
        'selected',
        button.dataset.type === type
      )
    );

  const property = type === 'real_estate';

  $('add-fields').innerHTML = `
    <div class="form-grid">
      <div class="full">
        <label for="new-name">Name</label>

        <input id="new-name"
               class="field"
               maxlength="100"
               placeholder="${
                 property
                   ? 'e.g. Apartment'
                   : 'e.g. Savings account'
               }">
      </div>

      ${type === 'other'
        ? `
          <div class="full">
            <label for="new-category">Category</label>

            <select id="new-category" class="field">
              ${options('other')}
            </select>

            <button id="new-custom"
                    class="button secondary small"
                    style="margin-top:8px"
                    type="button">
              + Create category
            </button>
          </div>
        `
        : ''}

      <div>
        <label for="new-date">Value as of</label>

        <input id="new-date"
               class="field"
               type="date"
               max="${dateToday()}"
               value="${dateToday()}">
      </div>

      <div>
        <label for="new-value">
          ${property
            ? 'Full property value (€)'
            : type === 'debt'
              ? 'Amount owed (€)'
              : 'Current value (€)'}
        </label>

        <input id="new-value"
               class="field"
               type="text"
               inputmode="decimal">
      </div>

      ${property
        ? `
          <div>
            <label for="new-share">Your ownership (%)</label>

            <input id="new-share"
                   class="field"
                   type="text"
                   inputmode="decimal"
                   value="100">
          </div>

          <div>
            <label for="new-mortgage">
              Your mortgage at the value date (€)
            </label>

            <input id="new-mortgage"
                   class="field"
                   type="text"
                   inputmode="decimal"
                   value="0">
          </div>

          <p class="muted small full">
            Add the property first, then open its Details
            to set up an automatic mortgage plan.
          </p>
        `
        : ''}

      ${type === 'fixed_deposit'
        ? `
          <div class="full">
            <label for="new-maturity">Fixed until</label>

            <input id="new-maturity"
                   class="field"
                   type="date">
          </div>
        `
        : ''}

      ${!['real_estate', 'fixed_deposit', 'debt'].includes(type)
        ? `
          <div class="full">
            <label class="check-label">
              <input id="new-accessible"
                     type="checkbox"
                     ${['cash', 'stocks'].includes(type)
                       ? 'checked'
                       : ''}>

              Count as accessible money
            </label>
          </div>
        `
        : ''}

      ${type === 'debt'
        ? `
          <div class="full">
            <label class="check-label">
              <input id="new-debt-access"
                     type="checkbox">

              Subtract this debt from accessible balance
            </label>
          </div>
        `
        : ''}
    </div>
  `;

  $('add-save').classList.remove('hidden');
  $('add-save').onclick = () => saveNew(type);

  if ($('new-custom')) {
    $('new-custom').onclick = () => categoryDialog();
  }
}

async function saveNew(type) {
  const name = $('new-name').value.trim();
  const date = $('new-date').value;
  const value = parseMoney($('new-value').value);
  const property = type === 'real_estate';

  const share = property
    ? decimal($('new-share').value)
    : null;

  const mortgage = property
    ? parseMoney($('new-mortgage').value)
    : 0;

  const maturity = type === 'fixed_deposit'
    ? $('new-maturity').value
    : null;

  if (
    !name ||
    !date ||
    date > dateToday() ||
    value === null ||
    (property && (share === null || mortgage === null)) ||
    (type === 'fixed_deposit' && !maturity)
  ) {
    dialogError('Complete all fields with valid amounts and dates.');
    return;
  }

  const selected = type === 'other'
    ? $('new-category').value
    : type;

  const custom = selected.startsWith('custom:');

  $('add-save').disabled = true;

  let asset = null;

  try {
    const max = Math.max(
      0,
      ...assets.map(item => Number(item.sort_order) || 0)
    );

    const result = await db
      .from('assets')
      .insert({
        name,
        category: custom ? 'custom' : selected,
        custom_category_id: custom ? selected.slice(7) : null,
        ownership_percent: share,
        maturity_date: maturity,
        accessible: Boolean($('new-accessible')?.checked),
        subtract_debt_from_accessible:
          Boolean($('new-debt-access')?.checked),
        sort_order: max + 1
      })
      .select()
      .single();

    if (result.error) throw result.error;

    asset = result.data;

    const valuation = await db
      .from('valuations')
      .insert({
        asset_id: asset.id,
        date,
        value,
        mortgage_value: mortgage
      });

    if (valuation.error) throw valuation.error;

    if (property) {
      const actual = await db
        .from('property_mortgage_overrides')
        .insert({
          asset_id: asset.id,
          date,
          balance: mortgage
        });

      if (actual.error) throw actual.error;
    }

    closeDialog();
    await load();
    showToast('Item added.');
  } catch (error) {
    if (asset) {
      const cleanup = await db
        .from('assets')
        .delete()
        .eq('id', asset.id);

      dialogError(
        cleanup.error
          ? `${error.message} An incomplete item remains; check your Items.`
          : `Item not added: ${error.message}`
      );
    } else {
      dialogError(error.message);
    }

    $('add-save').disabled = false;
  }
}

function categoryDialog() {
  dialog({
    eyebrow: 'Personal category',
    title: 'Create category',

    body: `
      <div style="margin-top:16px">
        <label for="category-name">Name</label>

        <input id="category-name"
               class="field"
               maxlength="50"
               placeholder="e.g. Pension">
      </div>
    `,

    footer: `
      <button id="category-cancel"
              class="button secondary"
              type="button">Cancel</button>

      <button id="category-save"
              class="button"
              type="button">Create</button>
    `
  });

  $('category-cancel').onclick = closeDialog;

  $('category-save').onclick = async () => {
    const name = $('category-name').value.trim();

    if (!name) {
      dialogError('Enter a name.');
      return;
    }

    if (
      [
        ...Object.values(TYPES),
        ...categories.map(category => category.name)
      ].some(item =>
        item.toLocaleLowerCase() === name.toLocaleLowerCase()
      )
    ) {
      dialogError('That category already exists.');
      return;
    }

    $('category-save').disabled = true;

    const { error } = await db
      .from('custom_categories')
      .insert({ name });

    if (error) {
      dialogError(error.message);
      $('category-save').disabled = false;
    } else {
      closeDialog();
      await load();

      showToast(
        'Category created. Select it when adding an item.'
      );
    }
  };
}

function editDialog(asset) {
  const simple = [
    'cash',
    'stocks',
    'crypto',
    'other',
    'custom'
  ].includes(asset.category);

  const selected = asset.category === 'custom'
    ? `custom:${asset.custom_category_id}`
    : asset.category;

  dialog({
    eyebrow: 'Item settings',
    title: `Edit ${asset.name}`,

    description:
      'Changing current settings may affect historical estimates.',

    body: `
      <div class="form-grid">
        <div class="full">
          <label for="edit-name">Name</label>

          <input id="edit-name"
                 class="field"
                 maxlength="100"
                 value="${esc(asset.name)}">
        </div>

        ${simple
          ? `
            <div class="full">
              <label for="edit-category">Category</label>

              <select id="edit-category" class="field">
                ${options(selected)}
              </select>
            </div>
          `
          : ''}

        ${asset.category === 'fixed_deposit'
          ? `
            <div class="full">
              <label for="edit-maturity">Fixed until</label>

              <input id="edit-maturity"
                     class="field"
                     type="date"
                     value="${asset.maturity_date ?? ''}">
            </div>
          `
          : ''}

        ${asset.category === 'real_estate'
          ? `
            <div class="full">
              <label for="edit-share">
                Ownership from today (%)
              </label>

              <input id="edit-share"
                     class="field"
                     type="text"
                     inputmode="decimal"
                     value="${shareAt(asset, dateToday())}">

              <p class="muted small">
                Earlier ownership percentages are preserved.
                Edit the mortgage separately in Details.
              </p>
            </div>
          `
          : ''}

        ${simple
          ? `
            <label class="check-label full">
              <input id="edit-access"
                     type="checkbox"
                     ${asset.accessible ? 'checked' : ''}>

              Count as accessible money
            </label>
          `
          : ''}

        ${asset.category === 'debt'
          ? `
            <label class="check-label full">
              <input id="edit-debt-access"
                     type="checkbox"
                     ${asset.subtract_debt_from_accessible
                       ? 'checked'
                       : ''}>

              Subtract from accessible balance
            </label>
          `
          : ''}
      </div>
    `,

    footer: `
      <button id="edit-cancel"
              class="button secondary"
              type="button">Cancel</button>

      <button id="edit-save"
              class="button"
              type="button">Save changes</button>
    `
  });

  $('edit-cancel').onclick = closeDialog;

  $('edit-save').onclick = async () => {
    const name = $('edit-name').value.trim();

    const share = $('edit-share')
      ? decimal($('edit-share').value)
      : null;

    if (
      !name ||
      ($('edit-share') && share === null) ||
      ($('edit-maturity') && !$('edit-maturity').value)
    ) {
      dialogError('Check the required fields.');
      return;
    }

    $('edit-save').disabled = true;

    try {
      if (
        $('edit-share') &&
        share !== shareAt(asset, dateToday())
      ) {
        const result = await db
          .from('property_ownership_changes')
          .upsert(
            {
              asset_id: asset.id,
              effective_date: dateToday(),
              ownership_percent: share
            },
            { onConflict: 'asset_id,effective_date' }
          );

        if (result.error) throw result.error;
      }

      const patch = { name };

      if ($('edit-category')) {
        const choice = $('edit-category').value;

        patch.category = choice.startsWith('custom:')
          ? 'custom'
          : choice;

        patch.custom_category_id =
          choice.startsWith('custom:')
            ? choice.slice(7)
            : null;
      }

      if ($('edit-maturity')) {
        patch.maturity_date = $('edit-maturity').value;
      }

      if ($('edit-access')) {
        patch.accessible = $('edit-access').checked;
      }

      if ($('edit-debt-access')) {
        patch.subtract_debt_from_accessible =
          $('edit-debt-access').checked;
      }

      const { error } = await db
        .from('assets')
        .update(patch)
        .eq('id', asset.id);

      if (error) throw error;

      closeDialog();
      await load();
      showToast('Item updated.');
    } catch (error) {
      dialogError(error.message);
      $('edit-save').disabled = false;
      await load();
    }
  };
}

function detailsDialog(asset) {
  const entries = valuations
    .filter(valuation => valuation.asset_id === asset.id)
    .reverse();

  const entry = latestValues(dateToday()).get(asset.id);

  const mortgage = asset.category === 'real_estate'
    ? mortgageAt(asset, dateToday())
    : null;

  dialog({
    eyebrow: categoryName(asset),
    title: asset.name,

    description: asset.archived_on
      ? `Archived ${asset.archived_on} · earlier history is retained.`
      : `Current contribution: ${
          entry
            ? money(contribution(asset, entry, dateToday()))
            : 'No value'
        }`,

    body: `
      ${mortgage
        ? `
          <div class="notice green" style="margin-top:15px">
            <strong>
              Mortgage balance: ${money(mortgage.balance)}
            </strong>

            <br>${esc(mortgage.source)}

            ${mortgage.plan?.fixed_interest_end_date
              ? `
                <br>Fixed interest until:
                <strong>
                  ${mortgage.plan.fixed_interest_end_date}
                </strong>
              `
              : ''}

            ${mortgage.payment !== null
              ? `
                <br>Calculated regular payment:
                <strong>
                  ${money(mortgage.payment)}/month
                </strong>
              `
              : ''}

            ${mortgage.plan
              ? `
                <br>Remaining scheduled payments at plan start:
                <strong>
                  ${mortgage.remainingMonths}
                  (${formatDuration(mortgage.remainingMonths)})
                </strong>
              `
              : ''}

            <br>Projection only; confirm against your lender.
          </div>

          ${mortgage.fixedPeriodExpired
            ? `
              <div class="notice">
                <strong>Fixed-interest period ended.</strong>
                Scheduled payments are no longer projected
                using the expired rate. Enter an actual balance
                or add a new mortgage plan.
              </div>
            `
            : ''}

          <button id="manage-mortgage"
                  class="button secondary"
                  style="margin-top:13px"
                  type="button">
            Mortgage plans &amp; actual balances
          </button>
        `
        : ''}

      ${asset.archived_on
        ? ''
        : `
          <h3 style="margin-top:22px">
            Add or update value
          </h3>

          <div class="form-grid">
            <div>
              <label for="detail-date">Date</label>

              <input id="detail-date"
                     class="field"
                     type="date"
                     max="${dateToday()}"
                     value="${dateToday()}">
            </div>

            <div>
              <label for="detail-value">
                ${asset.category === 'real_estate'
                  ? 'Full property value (€)'
                  : asset.category === 'debt'
                    ? 'Amount owed (€)'
                    : 'Value (€)'}
              </label>

              <input id="detail-value"
                     class="field"
                     type="text"
                     inputmode="decimal"
                     value="${esc(inputMoney(entry?.value))}">
            </div>

            <div>
              <button id="detail-save"
                      class="button"
                      type="button">Save value</button>
            </div>
          </div>
        `}

      <h3 style="margin-top:24px">Value history</h3>

      <div id="value-history">
        ${entries.length
          ? entries.map(valuation => `
              <div class="history-row"
                   data-entry="${valuation.id}">
                <span>
                  ${valuation.date} · ${money(valuation.value)}
                </span>

                <button class="button secondary small edit-entry"
                        type="button">Edit</button>
              </div>
            `).join('')
          : '<p class="muted small">No entries yet.</p>'}
      </div>
    `,

    footer: `
      ${asset.archived_on
        ? ''
        : `
          <button id="archive"
                  class="button danger"
                  type="button">Archive item</button>
        `}

      <button id="detail-close"
              class="button secondary"
              type="button">Close</button>
    `
  });

  $('detail-close').onclick = closeDialog;

  if ($('manage-mortgage')) {
    $('manage-mortgage').onclick =
      () => mortgageDialog(asset);
  }

  if ($('detail-save')) {
    $('detail-save').onclick = async () => {
      const date = $('detail-date').value;
      const value = parseMoney($('detail-value').value);

      if (
        !date ||
        date > dateToday() ||
        value === null
      ) {
        dialogError(
          'Enter a valid date and non-negative value.'
        );
        return;
      }

      $('detail-save').disabled = true;

      try {
        await saveValue(asset, date, value);
        closeDialog();
        await load();
        showToast('Value saved.');
      } catch (error) {
        dialogError(error.message);
        $('detail-save').disabled = false;
      }
    };
  }

  $('value-history').onclick = event => {
    const row = event.target.closest('[data-entry]');

    if (
      !event.target.closest('.edit-entry') ||
      !row
    ) {
      return;
    }

    const valuation = valuations.find(
      item => item.id === row.dataset.entry
    );

    if (valuation) {
      editValueDialog(asset, valuation);
    }
  };

  if ($('archive')) {
    $('archive').onclick = () => confirmDialog(
      `Archive ${asset.name}?`,
      'It leaves tracked net worth from today. Earlier history remains.',
      'Archive item',
      async () => {
        const { error } = await db
          .from('assets')
          .update({ archived_on: dateToday() })
          .eq('id', asset.id);

        if (error) throw error;

        await load();
        showToast('Item archived.');
      }
    );
  }
}

function editValueDialog(asset, valuation) {
  dialog({
    eyebrow: 'Correct history',
    title: asset.name,

    description:
      'Editing an entry may change earlier net-worth figures.',

    body: `
      <div class="form-grid">
        <div>
          <label for="history-date">Date</label>

          <input id="history-date"
                 class="field"
                 type="date"
                 max="${dateToday()}"
                 value="${valuation.date}">
        </div>

        <div>
          <label for="history-value">
            ${asset.category === 'real_estate'
              ? 'Full property value (€)'
              : 'Value (€)'}
          </label>

          <input id="history-value"
                 class="field"
                 type="text"
                 inputmode="decimal"
                 value="${esc(inputMoney(valuation.value))}">
        </div>
      </div>

      ${asset.category === 'real_estate'
        ? `
          <p class="notice" style="margin-top:14px">
            This edits the property's value only.
            Change an actual mortgage balance under
            Mortgage plans &amp; actual balances.
          </p>
        `
        : ''}
    `,

    footer: `
      <button id="history-delete"
              class="button danger"
              type="button">Delete entry</button>

      <button id="history-cancel"
              class="button secondary"
              type="button">Cancel</button>

      <button id="history-save"
              class="button"
              type="button">Save correction</button>
    `
  });

  $('history-cancel').onclick = () => detailsDialog(asset);

  $('history-save').onclick = async () => {
    const date = $('history-date').value;
    const value = parseMoney($('history-value').value);

    if (
      !date ||
      date > dateToday() ||
      value === null
    ) {
      dialogError(
        'Enter a valid date and non-negative value.'
      );
      return;
    }

    $('history-save').disabled = true;

    const { error } = await db
      .from('valuations')
      .update({ date, value })
      .eq('id', valuation.id);

    if (error) {
      dialogError(error.message);
      $('history-save').disabled = false;
    } else {
      closeDialog();
      await load();
      showToast('Value corrected.');
    }
  };

  $('history-delete').onclick = () => confirmDialog(
    `Delete value from ${valuation.date}?`,
    'This removes the recorded property/asset value, not a separate mortgage balance.',
    'Delete value',
    async () => {
      const { error } = await db
        .from('valuations')
        .delete()
        .eq('id', valuation.id);

      if (error) throw error;

      await load();
      showToast('Value deleted.');
    }
  );
}

/* ============================================================
   MORTGAGES
   ============================================================ */
