'use strict';

function navigate(next) {
  view = ['dashboard', 'items', 'checkin'].includes(next)
    ? next
    : 'dashboard';

  for (const name of [
    'dashboard',
    'items',
    'checkin'
  ]) {
    $(name).classList.toggle(
      'hidden',
      name !== view
    );
  }

  for (const button of $('nav').querySelectorAll('button')) {
    button.classList.toggle(
      'active',
      button.dataset.view === view
    );
  }

  render();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

$('nav').onclick = event => {
  const button = event.target.closest('[data-view]');

  if (button) {
    navigate(button.dataset.view);
  }
};

$('brand').onclick = event => {
  event.preventDefault();

  if (userId) {
    navigate('dashboard');
  }
};

$('review-link').onclick = () => navigate('checkin');
$('open-add').onclick = () => addDialog();

function render() {
  if (view === 'dashboard') renderDashboard();
  if (view === 'items') renderItems();
  if (view === 'checkin') renderCheckin();
}

/* ============================================================
   DASHBOARD TRANSPARENCY
   ============================================================ */
