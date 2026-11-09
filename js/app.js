const STORAGE_KEY = 'almoxarifado_state';
const USERS = {
  admin: { username: 'admin', password: 'admin123', perfil: 'ADMIN' },
  usuario: { username: 'usuario', password: 'usuario123', perfil: 'Usuário Comum' }
};

const app = document.getElementById('app');

let currentUser = null;
let currentView = 'dashboard';
let productToDeleteId = null;

const productFilters = {
  searchName: '',
  searchCode: '',
  category: 'all',
  situation: 'all',
  sortBy: 'none',
  sortDir: 'asc'
};

function defaultState() {
  return {
    produtos: [],
    movimentacoes: []
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw);
    return {
      produtos: Array.isArray(parsed.produtos) ? parsed.produtos : [],
      movimentacoes: Array.isArray(parsed.movimentacoes) ? parsed.movimentacoes : []
    };
  } catch (error) {
    console.warn('Erro ao carregar estado do localStorage:', error);
    return defaultState();
  }
}

function persistState() {
  const snapshot = {
    produtos: getProdutos(),
    movimentacoes: getMovimentacoes()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function saveState() {
  persistState();
}

function setStateData(produtos, movimentacoes) {
  window.__ALMOXARIFADO_PRODUTOS = Array.isArray(produtos) ? produtos : [];
  window.__ALMOXARIFADO_MOVIMENTOS = Array.isArray(movimentacoes) ? movimentacoes : [];
  persistState();
}

function getProdutos() {
  return Array.isArray(window.__ALMOXARIFADO_PRODUTOS) ? window.__ALMOXARIFADO_PRODUTOS : [];
}

function getMovimentacoes() {
  return Array.isArray(window.__ALMOXARIFADO_MOVIMENTOS) ? window.__ALMOXARIFADO_MOVIMENTOS : [];
}

function getPermission(permission) {
  if (!currentUser) return false;
  const profile = currentUser.perfil;
  const rules = {
    ADMIN: {
      cadastrarProdutos: true,
      editarProdutos: true,
      excluirProdutos: true,
      registrarEntradas: true,
      registrarSaidas: true,
      consultarProdutos: true,
      consultarEstoque: true,
      consultarHistorico: true
    },
    'Usuário Comum': {
      cadastrarProdutos: false,
      editarProdutos: false,
      excluirProdutos: false,
      registrarEntradas: false,
      registrarSaidas: false,
      consultarProdutos: true,
      consultarEstoque: true,
      consultarHistorico: true
    }
  };

  return !!(rules[profile] && rules[profile][permission]);
}

function getStockStatus(product) {
  const minimum = Number(product.estoqueMinimo ?? 0);
  if (product.quantidade === 0) return { label: 'Sem Estoque', cls: 'out' };
  if (product.quantidade <= minimum) return { label: 'Estoque Baixo', cls: 'low' };
  return { label: 'Em Estoque', cls: 'instock' };
}

function getLowStockProducts() {
  return getProdutos().filter((p) => Number(p.quantidade) > 0 && Number(p.quantidade) <= Number(p.estoqueMinimo || 0));
}

function getOutOfStockProducts() {
  return getProdutos().filter((p) => Number(p.quantidade) === 0);
}

function renderLogin() {
  app.innerHTML = `
    <div class="auth-container">
      <div class="login-card">
        <h1>Login</h1>
        <p class="login-subtitle">Sistema de Almoxarifado</p>

        <form id="loginForm">
          <div class="form-group">
            <label for="username">Usuário</label>
            <input type="text" id="username" placeholder="Digite o usuário" required />
          </div>

          <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" placeholder="Digite a senha" required />
          </div>

          <button type="submit" class="login-btn">Entrar</button>

          <div id="loginError" class="error-message" aria-live="polite">
            Credenciais inválidas. Verifique usuário e senha.
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    const user = Object.values(USERS).find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      document.getElementById('loginError').classList.add('show');
      return;
    }

    currentUser = user;
    document.getElementById('loginError').classList.remove('show');
    renderDashboard();
  });
}

function renderDashboard() {
  const produtos = getProdutos();
  const stats = {
    totalProdutos: produtos.length,
    totalEmEstoque: produtos.reduce((sum, p) => sum + Number(p.quantidade || 0), 0),
    produtosEstoqueBaixo: getLowStockProducts().length,
    produtosSemEstoque: getOutOfStockProducts().length
  };

  const recentMovements = getMovimentacoes().slice(-5).reverse();
  const lowProducts = getLowStockProducts();
  const outProducts = getOutOfStockProducts();

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <nav class="sidebar">
        <h3>Navegação</h3>
        <ul class="menu-list">
          <li class="menu-item"><button class="menu-btn active" data-view="dashboard">Dashboard</button></li>
          <li class="menu-item"><button class="menu-btn" data-view="consultarProdutos">Consultar Produtos</button></li>
          <li class="menu-item"><button class="menu-btn" data-view="consultarEstoque" ${getPermission('consultarEstoque') ? '' : 'disabled'}>Consultar Estoque</button></li>
          <li class="menu-item"><button class="menu-btn" data-view="consultarHistorico" ${getPermission('consultarHistorico') ? '' : 'disabled'}>Histórico</button></li>
          ${getPermission('cadastrarProdutos') ? '<li class="menu-item"><button class="menu-btn" data-view="cadastrarProdutos">Cadastrar Produto</button></li>' : ''}
          ${getPermission('registrarEntradas') ? '<li class="menu-item"><button class="menu-btn" data-view="registrarEntrada">Entrada de Estoque</button></li>' : ''}
          ${getPermission('registrarSaidas') ? '<li class="menu-item"><button class="menu-btn" data-view="registrarSaida">Saída de Estoque</button></li>' : ''}
        </ul>
      </nav>

      <main class="dashboard-content" id="mainContent">
        <div class="card">
          <h3>Dashboard - ${currentUser.username}</h3>
          <p>Perfil ativo: <strong>${currentUser.perfil}</strong></p>
        </div>

        <div class="dashboard-grid">
          <div class="stat-card primary">
            <div class="stat-label">Produtos cadastrados</div>
            <div class="stat-value">${stats.totalProdutos}</div>
          </div>
          <div class="stat-card success">
            <div class="stat-label">Total em estoque</div>
            <div class="stat-value">${stats.totalEmEstoque}</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-label">Estoque baixo</div>
            <div class="stat-value">${stats.produtosEstoqueBaixo}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-label">Sem estoque</div>
            <div class="stat-value">${stats.produtosSemEstoque}</div>
          </div>
        </div>

        <div class="card">
          <h3>Acesso rápido</h3>
          <div class="quick-access">
            ${getPermission('consultarProdutos') ? '<button class="quick-access-btn" data-action="consultarProdutos">Consultar Produtos</button>' : ''}
            ${getPermission('consultarEstoque') ? '<button class="quick-access-btn" data-action="consultarEstoque">Consultar Estoque</button>' : ''}
            ${getPermission('registrarEntradas') ? '<button class="quick-access-btn" data-action="registrarEntrada">Entrada</button>' : ''}
            ${getPermission('registrarSaidas') ? '<button class="quick-access-btn" data-action="registrarSaida">Saída</button>' : ''}
            ${getPermission('cadastrarProdutos') ? '<button class="quick-access-btn" data-action="cadastrarProdutos">Cadastrar Produto</button>' : ''}
          </div>
        </div>

        <div class="card">
          <h3>Alertas de estoque</h3>
          ${(
            outProducts.length === 0 && lowProducts.length === 0
              ? '<p>Nenhum alerta no momento.</p>'
              : `
                ${outProducts.length ? `<div><strong>Sem estoque:</strong><ul>${outProducts.map((p) => `<li>${p.nome} (${p.codigo})</li>`).join('')}</ul></div>` : ''}
                ${lowProducts.length ? `<div><strong>Estoque baixo:</strong><ul>${lowProducts.map((p) => `<li>${p.nome} (${p.codigo}) — ${p.quantidade} / mínimo ${p.estoqueMinimo}</li>`).join('')}</ul></div>` : ''}
              `
          )}
        </div>

        <div class="card">
          <h3>Movimentações recentes</h3>
          ${recentMovements.length ? recentMovements.map((m) => `
            <div style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:10px;">
              <div>
                <strong>${m.tipo}</strong> — ${m.produtoNome}<br>
                <small>${m.motivo} • ${m.usuario} • ${m.data}</small>
              </div>
              <div><strong>${m.quantidade}</strong></div>
            </div>
          `).join('') : '<p>Nenhuma movimentação registrada.</p>'}
        </div>
      </main>
    </div>

    <div id="successModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Sucesso</h2>
          <button class="modal-close" data-close-modal="successModal">&times;</button>
        </div>
        <p id="successMessage"></p>
        <button class="btn-primary" data-close-modal="successModal" style="margin-top:16px;">OK</button>
      </div>
    </div>

    <div id="deleteModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Confirmar exclusão</h2>
          <button class="modal-close" data-close-modal="deleteModal">&times;</button>
        </div>
        <p id="deleteMessage"></p>
        <div class="form-actions" style="margin-top:16px;">
          <button id="confirmDeleteBtn" class="btn-danger">Excluir</button>
          <button class="btn-secondary" data-close-modal="deleteModal">Cancelar</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    currentView = 'dashboard';
    renderLogin();
  });

  document.querySelectorAll('.menu-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const view = btn.dataset.view;
      currentView = view;
      document.querySelectorAll('.menu-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderView(view);
    });
  });

  document.querySelectorAll('.quick-access-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.action;
      currentView = view;
      renderView(view);
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.closeModal;
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('show');
    });
  });
}

function showSuccess(message) {
  const modal = document.getElementById('successModal');
  const msg = document.getElementById('successMessage');
  msg.textContent = message;
  modal.classList.add('show');
}

function showDeleteConfirm(productId, productName) {
  productToDeleteId = productId;
  const modal = document.getElementById('deleteModal');
  const msg = document.getElementById('deleteMessage');
  msg.textContent = `Deseja realmente excluir o produto "${productName}"?`;
  modal.classList.add('show');

  document.getElementById('confirmDeleteBtn').onclick = () => {
    const produtos = getProdutos();
    const saved = produtos.filter((p) => p.id !== productId);
    setStateData(saved, getMovimentacoes());
    modal.classList.remove('show');
    showSuccess('Produto excluído com sucesso!');
    setTimeout(() => renderView('consultarProdutos'), 800);
  };
}

function renderPermissionDenied() {
  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>
      <main class="dashboard-content">
        <div class="card">
          <h3>Acesso negado</h3>
          <p>Seu perfil não possui permissão para acessar esta funcionalidade.</p>
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });
}

function renderView(view) {
  if (!currentUser) {
    renderLogin();
    return;
  }

  if (view === 'dashboard') return renderDashboard();
  if (view === 'consultarProdutos') return renderProductsTable();
  if (view === 'consultarEstoque') return renderStockTable();
  if (view === 'consultarHistorico') return renderMovementHistory();
  if (view === 'cadastrarProdutos') return renderProductForm();
  if (view === 'registrarEntrada') return renderMovementForm('entrada');
  if (view === 'registrarSaida') return renderMovementForm('saida');
  renderDashboard();
}

function renderProductForm() {
  if (!getPermission('cadastrarProdutos')) return renderPermissionDenied();

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card form-container">
          <h3>Cadastrar produto</h3>
          <form id="productForm">
            <div id="productError" class="error-message" aria-live="polite"></div>
            <div class="form-group">
              <label for="codigo">Código do produto *</label>
              <input id="codigo" required>
            </div>
            <div class="form-group">
              <label for="nome">Nome *</label>
              <input id="nome" required>
            </div>
            <div class="form-group">
              <label for="categoria">Categoria *</label>
              <input id="categoria" required>
            </div>
            <div class="form-group">
              <label for="descricao">Descrição</label>
              <textarea id="descricao" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label for="quantidade">Quantidade inicial *</label>
              <input id="quantidade" type="number" min="0" value="0" required>
            </div>
            <div class="form-group">
              <label for="estoqueMinimo">Estoque mínimo *</label>
              <input id="estoqueMinimo" type="number" min="0" value="0" required>
            </div>
            <div class="form-group">
              <label for="localizacao">Localização no almoxarifado *</label>
              <input id="localizacao" required>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">Salvar</button>
              <button type="button" class="btn-secondary" id="cancelBtn">Cancelar</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });

  document.getElementById('cancelBtn').addEventListener('click', () => renderDashboard());

  document.getElementById('productForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const error = document.getElementById('productError');
    const codigo = document.getElementById('codigo').value.trim();
    const nome = document.getElementById('nome').value.trim();
    const categoria = document.getElementById('categoria').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const quantidade = Number(document.getElementById('quantidade').value || 0);
    const estoqueMinimo = Number(document.getElementById('estoqueMinimo').value || 0);
    const localizacao = document.getElementById('localizacao').value.trim();

    if (!codigo || !nome || !categoria || !localizacao) {
      error.textContent = 'Preencha todos os campos obrigatórios.';
      error.classList.add('show');
      return;
    }

    if (!Number.isInteger(quantidade) || quantidade < 0 || !Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
      error.textContent = 'Quantidade e estoque mínimo devem ser inteiros válidos.';
      error.classList.add('show');
      return;
    }

    const produtos = getProdutos();
    if (produtos.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())) {
      error.textContent = 'Já existe um produto com este código.';
      error.classList.add('show');
      return;
    }

    const novo = {
      id: Date.now(),
      codigo,
      nome,
      categoria,
      descricao,
      quantidade,
      estoqueMinimo,
      localizacao,
      dataCadastro: new Date().toLocaleDateString('pt-BR')
    };

    setStateData([...produtos, novo], getMovimentacoes());
    showSuccess('Produto cadastrado com sucesso!');
    setTimeout(() => renderView('consultarProdutos'), 800);
  });
}

function renderProductsTable() {
  if (!getPermission('consultarProdutos')) return renderPermissionDenied();

  const produtos = getProdutos();
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))];

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card">
          <h3>Consultar produtos</h3>
          <div class="filters-row">
            <input id="searchName" class="filter-input" type="text" placeholder="Pesquisar por nome..." value="${productFilters.searchName}" />
            <input id="searchCode" class="filter-input" type="text" placeholder="Pesquisar por código..." value="${productFilters.searchCode}" />
            <select id="categoryFilter" class="filter-select">
              <option value="all">Todas as categorias</option>
              ${categorias.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <select id="situationFilter" class="filter-select">
              <option value="all">Todas as situações</option>
              <option value="instock">Em estoque</option>
              <option value="low">Estoque baixo</option>
              <option value="out">Sem estoque</option>
            </select>
            <select id="sortBy" class="sort-select">
              <option value="none">Ordenar...</option>
              <option value="name">Nome</option>
              <option value="code">Código</option>
              <option value="quantity">Quantidade</option>
            </select>
            <select id="sortDir" class="sort-select">
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
            <button id="clearFilters" class="btn-secondary">Limpar filtros</button>
          </div>
          <div id="productsContainer"></div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });

  document.getElementById('categoryFilter').value = productFilters.category;
  document.getElementById('situationFilter').value = productFilters.situation;
  document.getElementById('sortBy').value = productFilters.sortBy;
  document.getElementById('sortDir').value = productFilters.sortDir;

  document.getElementById('searchName').addEventListener('input', (e) => {
    productFilters.searchName = e.target.value;
    renderProductsTableList();
  });

  document.getElementById('searchCode').addEventListener('input', (e) => {
    productFilters.searchCode = e.target.value;
    renderProductsTableList();
  });

  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    productFilters.category = e.target.value;
    renderProductsTableList();
  });

  document.getElementById('situationFilter').addEventListener('change', (e) => {
    productFilters.situation = e.target.value;
    renderProductsTableList();
  });

  document.getElementById('sortBy').addEventListener('change', (e) => {
    productFilters.sortBy = e.target.value;
    renderProductsTableList();
  });

  document.getElementById('sortDir').addEventListener('change', (e) => {
    productFilters.sortDir = e.target.value;
    renderProductsTableList();
  });

  document.getElementById('clearFilters').addEventListener('click', () => {
    productFilters.searchName = '';
    productFilters.searchCode = '';
    productFilters.category = 'all';
    productFilters.situation = 'all';
    productFilters.sortBy = 'none';
    productFilters.sortDir = 'asc';
    document.getElementById('searchName').value = '';
    document.getElementById('searchCode').value = '';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('situationFilter').value = 'all';
    document.getElementById('sortBy').value = 'none';
    document.getElementById('sortDir').value = 'asc';
    renderProductsTableList();
  });

  renderProductsTableList();
}

function renderProductsTableList() {
  const container = document.getElementById('productsContainer');
  let produtos = [...getProdutos()];

  if (productFilters.searchName) {
    produtos = produtos.filter((p) => p.nome.toLowerCase().includes(productFilters.searchName.toLowerCase()));
  }

  if (productFilters.searchCode) {
    produtos = produtos.filter((p) => p.codigo.toLowerCase().includes(productFilters.searchCode.toLowerCase()));
  }

  if (productFilters.category !== 'all') {
    produtos = produtos.filter((p) => p.categoria === productFilters.category);
  }

  if (productFilters.situation !== 'all') {
    produtos = produtos.filter((p) => getStockStatus(p).cls === productFilters.situation);
  }

  if (productFilters.sortBy !== 'none') {
    produtos.sort((a, b) => {
      const dir = productFilters.sortDir === 'asc' ? 1 : -1;
      if (productFilters.sortBy === 'name') return dir * a.nome.localeCompare(b.nome);
      if (productFilters.sortBy === 'code') return dir * a.codigo.localeCompare(b.codigo);
      if (productFilters.sortBy === 'quantity') return dir * (Number(a.quantidade) - Number(b.quantidade));
      return 0;
    });
  }

  if (!produtos.length) {
    container.innerHTML = '<div class="empty-state">Nenhum produto encontrado com os filtros aplicados.</div>';
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Quantidade</th>
            <th>Situação</th>
            <th>Localização</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${produtos.map((p) => {
            const status = getStockStatus(p);
            return `
              <tr>
                <td>${p.codigo}</td>
                <td>${p.nome}</td>
                <td>${p.categoria}</td>
                <td>${p.quantidade}</td>
                <td><span class="product-badge badge ${status.cls}">${status.label}</span></td>
                <td>${p.localizacao}</td>
                <td>
                  <div class="actions-row">
                    <button class="btn-primary" data-view-product="${p.id}">Visualizar</button>
                    ${getPermission('editarProdutos') ? `<button class="btn-edit" data-edit-product="${p.id}">Editar</button>` : ''}
                    ${getPermission('excluirProdutos') ? `<button class="btn-danger" data-delete-product="${p.id}">Excluir</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('[data-view-product]').forEach((btn) => {
    btn.addEventListener('click', () => viewProduct(Number(btn.dataset.viewProduct)));
  });

  document.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', () => editProduct(Number(btn.dataset.editProduct)));
  });

  document.querySelectorAll('[data-delete-product]').forEach((btn) => {
    btn.addEventListener('click', () => showDeleteConfirm(Number(btn.dataset.deleteProduct), produtos.find((p) => p.id === Number(btn.dataset.deleteProduct)).nome));
  });
}

function viewProduct(productId) {
  const produto = getProdutos().find((p) => p.id === productId);
  if (!produto) return;
  const status = getStockStatus(produto);

  const modal = document.getElementById('successModal');
  const message = document.getElementById('successMessage');
  message.innerHTML = `
    <div>
      <strong>${produto.nome}</strong> (${produto.codigo})<br>
      Categoria: ${produto.categoria}<br>
      Quantidade: ${produto.quantidade}<br>
      Estoque mínimo: ${produto.estoqueMinimo}<br>
      Localização: ${produto.localizacao}<br>
      Situação: <span class="product-badge badge ${status.cls}">${status.label}</span><br>
      Descrição: ${produto.descricao || 'Sem descrição'}
    </div>
  `;
  modal.classList.add('show');
}

function editProduct(productId) {
  if (!getPermission('editarProdutos')) return renderPermissionDenied();
  const produto = getProdutos().find((p) => p.id === productId);
  if (!produto) return;

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card form-container">
          <h3>Editar produto</h3>
          <form id="editForm">
            <div id="editError" class="error-message" aria-live="polite"></div>
            <div class="form-group">
              <label for="editCodigo">Código *</label>
              <input id="editCodigo" value="${produto.codigo}" required>
            </div>
            <div class="form-group">
              <label for="editNome">Nome *</label>
              <input id="editNome" value="${produto.nome}" required>
            </div>
            <div class="form-group">
              <label for="editCategoria">Categoria *</label>
              <input id="editCategoria" value="${produto.categoria}" required>
            </div>
            <div class="form-group">
              <label for="editDescricao">Descrição</label>
              <textarea id="editDescricao" rows="3">${produto.descricao || ''}</textarea>
            </div>
            <div class="form-group">
              <label for="editQuantidade">Quantidade *</label>
              <input id="editQuantidade" type="number" min="0" value="${produto.quantidade}" required>
            </div>
            <div class="form-group">
              <label for="editEstoqueMinimo">Estoque mínimo *</label>
              <input id="editEstoqueMinimo" type="number" min="0" value="${produto.estoqueMinimo}" required>
            </div>
            <div class="form-group">
              <label for="editLocalizacao">Localização *</label>
              <input id="editLocalizacao" value="${produto.localizacao}" required>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">Salvar</button>
              <button type="button" class="btn-secondary" id="cancelEditBtn">Cancelar</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });

  document.getElementById('cancelEditBtn').addEventListener('click', () => renderView('consultarProdutos'));

  document.getElementById('editForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const error = document.getElementById('editError');
    const codigo = document.getElementById('editCodigo').value.trim();
    const nome = document.getElementById('editNome').value.trim();
    const categoria = document.getElementById('editCategoria').value.trim();
    const quantidade = Number(document.getElementById('editQuantidade').value || 0);
    const estoqueMinimo = Number(document.getElementById('editEstoqueMinimo').value || 0);
    const localizacao = document.getElementById('editLocalizacao').value.trim();

    if (!codigo || !nome || !categoria || !localizacao) {
      error.textContent = 'Preencha os campos obrigatórios.';
      error.classList.add('show');
      return;
    }

    if (!Number.isInteger(quantidade) || quantidade < 0 || !Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
      error.textContent = 'Quantidade e estoque mínimo devem ser inteiros válidos.';
      error.classList.add('show');
      return;
    }

    const produtos = getProdutos();
    if (produtos.some((p) => p.id !== productId && p.codigo.toLowerCase() === codigo.toLowerCase())) {
      error.textContent = 'Já existe outro produto com este código.';
      error.classList.add('show');
      return;
    }

    const updated = produtos.map((p) => {
      if (p.id !== productId) return p;
      return {
        ...p,
        codigo,
        nome,
        categoria,
        descricao: document.getElementById('editDescricao').value.trim(),
        quantidade,
        estoqueMinimo,
        localizacao
      };
    });

    setStateData(updated, getMovimentacoes());
    showSuccess('Produto atualizado com sucesso!');
    setTimeout(() => renderView('consultarProdutos'), 800);
  });
}

function renderStockTable() {
  if (!getPermission('consultarEstoque')) return renderPermissionDenied();
  const produtos = getProdutos();

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card">
          <h3>Consulta de estoque</h3>
          ${produtos.length ? `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Produto</th>
                    <th>Quantidade</th>
                    <th>Estoque mínimo</th>
                    <th>Situação</th>
                    <th>Localização</th>
                  </tr>
                </thead>
                <tbody>
                  ${produtos.map((p) => {
                    const status = getStockStatus(p);
                    return `
                      <tr>
                        <td>${p.codigo}</td>
                        <td>${p.nome}</td>
                        <td>${p.quantidade}</td>
                        <td>${p.estoqueMinimo}</td>
                        <td><span class="product-badge badge ${status.cls}">${status.label}</span></td>
                        <td>${p.localizacao}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state">Nenhum produto cadastrado.</div>'}
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });
}

function renderMovementHistory() {
  if (!getPermission('consultarHistorico')) return renderPermissionDenied();
  const movimentacoes = getMovimentacoes();

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card">
          <h3>Histórico de movimentações</h3>
          <div class="filters-row" style="margin-bottom:16px;">
            <input id="movFilterProduto" class="filter-input" placeholder="Filtrar por produto" />
            <select id="movFilterTipo" class="filter-select">
              <option value="all">Todos</option>
              <option value="Entrada">Entrada</option>
              <option value="Saída">Saída</option>
            </select>
          </div>
          <div id="historyContainer"></div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });

  const build = () => {
    const termo = document.getElementById('movFilterProduto').value.trim().toLowerCase();
    const tipo = document.getElementById('movFilterTipo').value;

    const filtered = movimentacoes.filter((m) => {
      const matchesText = !termo || m.produtoNome.toLowerCase().includes(termo);
      const matchesTipo = tipo === 'all' || m.tipo === tipo;
      return matchesText && matchesTipo;
    });

    const container = document.getElementById('historyContainer');
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma movimentação encontrada.</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Data e hora</th>
              <th>Usuário</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((m) => `
              <tr>
                <td>${m.produtoNome}</td>
                <td>${m.tipo}</td>
                <td>${m.quantidade}</td>
                <td>${m.data}</td>
                <td>${m.usuario}</td>
                <td>${m.motivo}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  document.getElementById('movFilterProduto').addEventListener('input', build);
  document.getElementById('movFilterTipo').addEventListener('change', build);
  build();
}

function renderMovementForm(type) {
  if (type === 'entrada' && !getPermission('registrarEntradas')) return renderPermissionDenied();
  if (type === 'saida' && !getPermission('registrarSaidas')) return renderPermissionDenied();

  const produtos = getProdutos();
  if (!produtos.length) {
    app.innerHTML = `
      <div class="dashboard">
        <header class="app-header">
          <h2>Almoxarifado</h2>
          <div class="user-info">
            <span class="profile-badge">${currentUser.perfil}</span>
            <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
          </div>
        </header>
        <main class="dashboard-content">
          <div class="card">
            <h3>${type === 'entrada' ? 'Entrada de estoque' : 'Saída de estoque'}</h3>
            <p>Não existe nenhum produto cadastrado para movimentar.</p>
          </div>
        </main>
      </div>
    `;
    document.getElementById('logoutBtn').addEventListener('click', () => {
      currentUser = null;
      renderLogin();
    });
    return;
  }

  const title = type === 'entrada' ? 'Registrar entrada de estoque' : 'Registrar saída de estoque';
  const actionText = type === 'entrada' ? 'Entrada' : 'Saída';

  app.innerHTML = `
    <div class="dashboard">
      <header class="app-header">
        <h2>Almoxarifado</h2>
        <div class="user-info">
          <span class="profile-badge">${currentUser.perfil}</span>
          <button id="logoutBtn" class="logout-btn" type="button">Logout</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card form-container">
          <h3>${title}</h3>
          <form id="movementForm">
            <div id="movementError" class="error-message" aria-live="polite"></div>
            <div class="form-group">
              <label for="produtoMov">Produto *</label>
              <select id="produtoMov" required>
                <option value="">Selecione um produto</option>
                ${produtos.map((p) => `<option value="${p.id}">${p.codigo} - ${p.nome} (${p.quantidade} em estoque)</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="quantidadeMov">Quantidade *</label>
              <input id="quantidadeMov" type="number" min="1" value="1" required>
            </div>
            <div class="form-group">
              <label for="motivoMov">Motivo *</label>
              <input id="motivoMov" placeholder="Ex: Compra, Devolução, Venda" required>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">Registrar ${actionText}</button>
              <button type="button" class="btn-secondary" id="cancelMovementBtn">Cancelar</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    renderLogin();
  });

  document.getElementById('cancelMovementBtn').addEventListener('click', () => renderDashboard());

  document.getElementById('movementForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const error = document.getElementById('movementError');
    const produtoId = Number(document.getElementById('produtoMov').value);
    const quantidade = Number(document.getElementById('quantidadeMov').value || 0);
    const motivo = document.getElementById('motivoMov').value.trim();

    if (!produtoId || !Number.isInteger(quantidade) || quantidade <= 0 || !motivo) {
      error.textContent = 'Informe produto, quantidade válida e motivo.';
      error.classList.add('show');
      return;
    }

    const produto = getProdutos().find((p) => p.id === produtoId);
    if (!produto) {
      error.textContent = 'Produto não encontrado.';
      error.classList.add('show');
      return;
    }

    if (type === 'saida' && produto.quantidade < quantidade) {
      error.textContent = `Quantidade indisponível. Estoque atual: ${produto.quantidade}.`;
      error.classList.add('show');
      return;
    }

    const oldQty = produto.quantidade;
    const newQty = type === 'entrada' ? produto.quantidade + quantidade : produto.quantidade - quantidade;

    const updatedProdutos = getProdutos().map((p) => {
      if (p.id !== produtoId) return p;
      return { ...p, quantidade: newQty };
    });

    const novaMov = {
      id: Date.now(),
      produtoId,
      produtoNome: produto.nome,
      tipo: type === 'entrada' ? 'Entrada' : 'Saída',
      quantidade,
      motivo,
      data: new Date().toLocaleString('pt-BR'),
      usuario: currentUser.username
    };

    const updatedMov = [...getMovimentacoes(), novaMov];
    setStateData(updatedProdutos, updatedMov);

    const statusOld = getStockStatus(produto);
    const statusNew = getStockStatus({ ...produto, quantidade: newQty });
    if (statusOld.cls !== statusNew.cls) {
      showSuccess(type === 'entrada' ? 'Movimentação de entrada registrada com sucesso!' : 'Movimentação de saída registrada com sucesso!');
    } else {
      showSuccess('Movimentação registrada com sucesso!');
    }

    setTimeout(() => renderDashboard(), 900);
  });
}

function init() {
  const saved = loadState();
  setStateData(saved.produtos || [], saved.movimentacoes || []);
  window.addEventListener('beforeunload', persistState);
  renderLogin();
}

init();
