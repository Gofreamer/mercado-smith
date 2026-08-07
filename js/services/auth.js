/* Global Smith — Auth Service */

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    errorEl.textContent = translateAuthError(err.code);
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('btn-register');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    // Cria o perfil no database
    await db.ref('users/' + cred.user.uid).set({
      name: name,
      email: email,
      balance: 1000.00, // saldo inicial
      isAdmin: false,
      inventory: {},
      createdAt: Date.now()
    });
  } catch (err) {
    errorEl.textContent = translateAuthError(err.code);
    btn.disabled = false;
    btn.textContent = 'Criar Conta';
  }
}

async function handleLogout() {
  await auth.signOut();
}

function translateAuthError(code) {
  const map = {
    'auth/user-not-found': 'Conta não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'Este e-mail já está em uso.',
    'auth/weak-password': 'A senha precisa ter no mínimo 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.'
  };
  return map[code] || 'Erro ao autenticar. Tente novamente.';
}
