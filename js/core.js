'use strict';

const db = supabase.createClient(
  'https://ipdvmhinxjwcxuwrwiad.supabase.co',
  'sb_publishable_sBDt7t7eY6xN5FFMlyi7RA_vUFN1U5K'
);

const TYPES = {
  cash: 'Cash',
  stocks: 'Investments',
  real_estate: 'Property',
  fixed_deposit: 'Fixed deposit',
  debt: 'Debt',
  crypto: 'Crypto',
  other: 'Other'
};

const $ = id => document.getElementById(id);

const money = amount => Number(amount).toLocaleString(
  undefined,
  { style: 'currency', currency: 'EUR' }
);

const esc = value => String(value ?? '').replace(
  /[&<>"']/g,
  char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]
);

function dateToday() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function monthEndBefore(date) {
  const [year, month] = date.split('-').map(Number);
  const previous = new Date(year, month - 1, 0);

  return [
    previous.getFullYear(),
    String(previous.getMonth() + 1).padStart(2, '0'),
    String(previous.getDate()).padStart(2, '0')
  ].join('-');
}

function parseMoney(input) {
  let text = String(input ?? '')
    .trim()
    .replace(/[€\s\u00a0\u202f]/g, '');

  if (!text) return null;

  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');

  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';

    text = text
      .replaceAll(decimal === ',' ? '.' : ',', '')
      .replace(decimal, '.');
  } else if (comma >= 0) {
    text = text.replace(',', '.');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const number = Number(text);

  return Number.isFinite(number) &&
    number <= 999999999999.99
      ? number
      : null;
}

function decimal(input, max = 100) {
  const text = String(input ?? '')
    .trim()
    .replace(',', '.');

  if (!/^\d+(\.\d{1,4})?$/.test(text)) return null;

  const number = Number(text);

  return number <= max ? number : null;
}

function inputMoney(value) {
  return value == null
    ? ''
    : String(value).replace('.', ',');
}

function showToast(message, bad = false) {
  $('toast').textContent = message;
  $('toast').className = `toast${bad ? ' bad' : ''}`;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(
    () => $('toast').classList.add('hidden'),
    4500
  );
}

let assets = [];
let valuations = [];
let categories = [];
let ownership = [];
let plans = [];
let overrides = [];

let userId = null;
let loadId = 0;
let view = 'dashboard';
let chart = null;
let sortable = null;
let orderBusy = false;
let archivedOpen = false;
let reviewedOpen = false;

$('asof').value = dateToday();
$('asof').max = dateToday();
