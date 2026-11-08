'use strict';

db.auth.onAuthStateChange((_event, session) => {
  const next = session?.user?.id ?? null;

  $('auth').classList.toggle('hidden', Boolean(next));
  $('app').classList.toggle('hidden', !next);
  $('header-right').classList.toggle('hidden', !next);

  if (!next) {
    userId = null;
    loadId++;

    assets = [];
    valuations = [];
    categories = [];
    ownership = [];
    plans = [];
    overrides = [];

    if (chart) {
      chart.destroy();
      chart = null;
    }

    if ($('dialog').open) {
      $('dialog').close();
    }

    return;
  }

  $('header-email').textContent =
    session.user.email ?? '';

  if (next !== userId) {
    userId = next;
    setTimeout(load, 0);
  }
});

async function authenticate(mode) {
  const email = $('email').value.trim();
  const password = $('password').value;

  $('auth-error').textContent = '';

  if (!email || !password) {
    $('auth-error').textContent =
      'Enter your email and password.';
    return;
  }

  $('login').disabled = true;
  $('signup').disabled = true;

  try {
    const result = mode === 'signup'
      ? await db.auth.signUp({ email, password })
      : await db.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;

    if (
      mode === 'signup' &&
      !result.data.session
    ) {
      $('auth-error').textContent =
        'Check your email to confirm your account.';
    }
  } catch (error) {
    $('auth-error').textContent = error.message;
  } finally {
    $('login').disabled = false;
    $('signup').disabled = false;
  }
}

$('login').onclick = () => authenticate('login');
$('signup').onclick = () => authenticate('signup');

$('password').onkeydown = event => {
  if (event.key === 'Enter') {
    authenticate('login');
  }
};

$('logout').onclick = async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    showToast(error.message, true);
  }
};
