/* Global Smith — Admin */

async function adminAddProduct(e) {
  e.preventDefault();

  const name = document.getElementById('admin-product-name').value.trim();
  const description = document.getElementById('admin-product-desc').value.trim();
  const price = parseFloat(document.getElementById('admin-product-price').value);
  const category = document.getElementById('admin-product-category').value;
  const image = document.getElementById('admin-product-image').value.trim();
  const stockRaw = document.getElementById('admin-product-stock').value;

  if (!name || isNaN(price)) {
    showToast('Preencha nome e preço corretamente.', 'error');
    return;
  }

  const product = {
    name,
    description,
    price,
    category,
    image: image || '',
    stock: stockRaw === '' ? null : parseInt(stockRaw, 10),
    createdAt: Date.now()
  };

  try {
    await db.ref('products').push(product);
    showToast('Produto adicionado com sucesso!');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Erro ao adicionar produto.', 'error');
  }
}

async function adminAdjustBalance(e) {
  e.preventDefault();

  const input = document.getElementById('admin-user-id').value.trim();
  const newBalance = parseFloat(document.getElementById('admin-new-balance').value);

  if (isNaN(newBalance)) {
    showToast('Saldo inválido.', 'error');
    return;
  }

  try {
    let uid = input;

    // Se parece e-mail, busca o usuário
    if (input.includes('@')) {
      const snap = await db.ref('users').orderByChild('email').equalTo(input).once('value');
      const users = snap.val();
      if (!users) {
        showToast('Usuário não encontrado.', 'error');
        return;
      }
      uid = Object.keys(users)[0];
    }

    await db.ref(`users/${uid}/balance`).set(newBalance);
    showToast('Saldo atualizado!');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar saldo.', 'error');
  }
}
