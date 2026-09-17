// ClothBill — SPA Core Logical Client Module
document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. GLOBAL STATE DEFINITIONS
  // ==========================================
  let STATE = {
    token: localStorage.getItem('clothbill_token') || null,
    user: JSON.parse(localStorage.getItem('clothbill_user')) || null,
    activeView: 'dashboardView',
    cart: [], // { product, name, code, price, quantity, maxStock }
    currentCustomer: null, // associated customer details
    products: [],
    categories: [],
    brands: [],
    dashboardChart: null
  };

  const API_HEADERS = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${STATE.token}`
  });

  // Helper: Format Currency (INR)
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  // Helper: Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ==========================================
  // 2. AUTHENTICATION CONTROLLER FLOW
  // ==========================================
  const checkAuthStatus = () => {
    if (STATE.token && STATE.user) {
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('mainContainer').style.display = 'flex';
      
      // Set User UI labels
      document.getElementById('displayUserName').innerText = STATE.user.name;
      document.getElementById('displayUserRole').innerText = STATE.user.role;

      // Enable staff registration UI only for Admin if available
      const navItemUser = document.getElementById('navItemUserManagement');
      const staffCreation = document.getElementById('staffCreationContainer');
      if (navItemUser) navItemUser.style.display = STATE.user.role === 'admin' ? 'block' : 'none';
      if (staffCreation) staffCreation.style.display = STATE.user.role === 'admin' ? 'block' : 'none';

      // Load initial layout data
      switchView('dashboardView');
      loadAllLookups();
    } else {
      document.getElementById('loginOverlay').style.display = 'flex';
      document.getElementById('mainContainer').style.display = 'none';
    }
  };

  // Handle Login submission
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        STATE.token = data.token;
        STATE.user = data.user;
        localStorage.setItem('clothbill_token', data.token);
        localStorage.setItem('clothbill_user', JSON.stringify(data.user));
        
        // Reset login form fields
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';

        Swal.fire({
          icon: 'success',
          title: `Welcome, ${data.user.name}`,
          text: 'Authorization granted successfully.',
          timer: 1500,
          showConfirmButton: false
        });

        checkAuthStatus();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: data.message || 'Invalid credentials'
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Connection Error',
        text: 'Could not connect to the authentication server.'
      });
    }
  });

  // Handle Log out
  document.getElementById('btnLogout').addEventListener('click', () => {
    STATE.token = null;
    STATE.user = null;
    STATE.cart = [];
    STATE.currentCustomer = null;
    localStorage.removeItem('clothbill_token');
    localStorage.removeItem('clothbill_user');
    
    Swal.fire({
      icon: 'info',
      title: 'Logged Out',
      text: 'You have been successfully signed out.',
      timer: 1500,
      showConfirmButton: false
    });

    checkAuthStatus();
  });

  // ==========================================
  // 3. SPA ROUTING ENGINE
  // ==========================================
  const navItems = document.querySelectorAll('.nav-menu .nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  const switchView = (viewId) => {
    // Deactivate all panels & menus
    viewPanels.forEach(panel => panel.classList.remove('active'));
    navItems.forEach(item => item.classList.remove('active'));

    // Activate specific panel & corresponding navigation
    const targetPanel = document.getElementById(viewId);
    if (targetPanel) targetPanel.classList.add('active');

    const targetNav = document.querySelector(`.nav-menu [data-view="${viewId}"]`);
    if (targetNav) targetNav.classList.add('active');

    STATE.activeView = viewId;

    // Trigger View Specific Data load
    if (viewId === 'dashboardView') loadDashboardData();
    else if (viewId === 'billingView') loadBillingPOS();
    else if (viewId === 'productsView') loadProductsGrid();
    else if (viewId === 'inventoryView') loadInventoryLogs();
    else if (viewId === 'customersView') loadCustomersList();
    else if (viewId === 'reportsView') loadReportsModule();
    else if (viewId === 'usersView') loadUsersModule();
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // ==========================================
  // 4. LOOKUP & DATA LOADER WRAPPERS
  // ==========================================
  const loadAllLookups = async () => {
    try {
      // Categories lookup
      let res = await fetch('/api/products/categories', { headers: API_HEADERS() });
      let data = await res.json();
      if (data.success) STATE.categories = data.categories;

      // Brands lookup
      res = await fetch('/api/products/brands', { headers: API_HEADERS() });
      data = await res.json();
      if (data.success) STATE.brands = data.brands;

      // Populate filter dropdowns
      populateLookupDropdowns();
    } catch (err) {
      console.error('Error loading lookup configurations:', err);
    }
  };

  const populateLookupDropdowns = () => {
    const catSelectors = ['productFilterCategory', 'prodCategory'];
    const brandSelectors = ['productFilterBrand', 'prodBrand'];

    // Categories
    catSelectors.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = id === 'productFilterCategory' 
        ? '<option value="">All Categories</option>' 
        : '<option value="" disabled selected>Select Category</option>';
      STATE.categories.forEach(cat => {
        select.innerHTML += `<option value="${cat._id}">${cat.name}</option>`;
      });
    });

    // Brands
    brandSelectors.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = id === 'productFilterBrand' 
        ? '<option value="">All Brands</option>' 
        : '<option value="" disabled selected>Select Brand</option>';
      STATE.brands.forEach(br => {
        select.innerHTML += `<option value="${br._id}">${br.name}</option>`;
      });
    });
  };

  // ==========================================
  // 5. DASHBOARD CONTROLLER ACTIONS
  // ==========================================
  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/reports/dashboard', { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        const stats = data.data;
        document.getElementById('widgetTodaySales').innerText = stats.todaySalesCount;
        document.getElementById('widgetTodayRevenue').innerText = formatCurrency(stats.todayRevenue);
        document.getElementById('widgetTotalProducts').innerText = stats.totalStockUnits;
        document.getElementById('widgetLowStockCount').innerText = stats.lowStockCount;

        // Set Live status date
        document.getElementById('dashboardTimestamp').innerText = `Last Refreshed: ${new Date().toLocaleTimeString()}`;

        // Populate Recent Transactions
        const tBody = document.querySelector('#dashboardTransactionsTable tbody');
        tBody.innerHTML = '';
        if (stats.recentTransactions && stats.recentTransactions.length > 0) {
          stats.recentTransactions.forEach(sale => {
            tBody.innerHTML += `
              <tr>
                <td><strong class="font-monospace text-uppercase small">${sale.invoiceNo}</strong></td>
                <td>${formatDate(sale.date)}</td>
                <td>${sale.customerPhone}</td>
                <td class="fw-bold">${formatCurrency(sale.grandTotal)}</td>
                <td><span class="badge text-uppercase bg-secondary">${sale.paymentMode}</span></td>
                <td>
                  <button class="btn btn-sm btn-dark btn-view-invoice" data-invoice="${sale.invoiceNo}">
                    <i class="fa-solid fa-file-invoice"></i> View
                  </button>
                </td>
              </tr>
            `;
          });
          
          // Add click handlers for invoice modals
          document.querySelectorAll('.btn-view-invoice').forEach(btn => {
            btn.addEventListener('click', () => {
              const inv = btn.getAttribute('data-invoice');
              fetchAndShowInvoice(inv);
            });
          });

        } else {
          tBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No transactions found today</td></tr>';
        }

        // Populate Low Stock Alerts
        const alertList = document.getElementById('lowStockDashboardList');
        alertList.innerHTML = '';
        if (stats.lowStockProducts && stats.lowStockProducts.length > 0) {
          stats.lowStockProducts.forEach(prod => {
            alertList.innerHTML += `
              <div class="list-group-item d-flex justify-content-between align-items-center py-2 px-1">
                <div>
                  <div class="fw-bold small text-dark">${prod.name}</div>
                  <span class="text-muted text-uppercase font-monospace" style="font-size: 0.75rem;">Code: ${prod.code} | Size: ${prod.size}</span>
                </div>
                <span class="badge rounded-pill bg-danger">${prod.stock} Units</span>
              </div>
            `;
          });
        } else {
          alertList.innerHTML = '<div class="text-center py-4 text-muted small">No items below critical threshold</div>';
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // 6. PRODUCT DIRECTORY CONTROLLER
  // ==========================================
  const loadProductsGrid = async () => {
    try {
      const search = document.getElementById('productSearchQuery').value.trim();
      const category = document.getElementById('productFilterCategory').value;
      const brand = document.getElementById('productFilterBrand').value;
      const stock = document.getElementById('productFilterStock').value;
      
      let queryParams = `?search=${encodeURIComponent(search)}&category=${category}&brand=${brand}`;
      if (stock === 'low') queryParams += `&lowStock=true`;

      const res = await fetch(`/api/products${queryParams}`, { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        STATE.products = data.products;
        const tBody = document.querySelector('#productsTable tbody');
        tBody.innerHTML = '';

        if (STATE.products.length > 0) {
          STATE.products.forEach(p => {
            const isLowStock = p.stock <= p.lowStockThreshold;
            tBody.innerHTML += `
              <tr>
                <td class="font-monospace text-uppercase fw-bold">${p.code}</td>
                <td><strong class="text-dark">${p.name}</strong></td>
                <td>${p.color}</td>
                <td><span class="badge bg-secondary">${p.size}</span></td>
                <td>
                  <span class="badge ${isLowStock ? 'bg-danger' : 'bg-success'} rounded-pill">
                    ${p.stock} Units
                  </span>
                </td>
                <td class="fw-bold">${formatCurrency(p.price)}</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-outline-dark btn-edit-product" data-id="${p._id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p._id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            `;
          });

          // Edit product triggers
          document.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              openProductModal(id);
            });
          });

          // Delete product triggers
          document.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              deleteProductSubmit(id);
            });
          });

        } else {
          tBody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No products match the criteria.</td></tr>';
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter button triggers
  document.getElementById('btnProductFilterSearch').addEventListener('click', loadProductsGrid);
  document.getElementById('productSearchQuery').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') loadProductsGrid();
  });

  // Manage Categories Trigger Modal
  const categoryModalEl = new bootstrap.Modal(document.getElementById('categoryModal'));
  document.getElementById('btnManageCategories').addEventListener('click', () => {
    categoryModalEl.show();
    loadCategoryModalList();
  });

  const loadCategoryModalList = async () => {
    const listGroup = document.getElementById('modalCategoryList');
    listGroup.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-muted"></span></div>';
    
    try {
      const res = await fetch('/api/products/categories', { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        listGroup.innerHTML = '';
        if (data.categories.length > 0) {
          data.categories.forEach(cat => {
            listGroup.innerHTML += `
              <div class="list-group-item d-flex justify-content-between align-items-center py-2">
                <span>${cat.name}</span>
                <button class="btn btn-xs btn-outline-danger btn-delete-cat" data-id="${cat._id}"><i class="fa-solid fa-trash-can"></i></button>
              </div>
            `;
          });

          document.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              try {
                const dRes = await fetch(`/api/products/categories/${id}`, {
                  method: 'DELETE',
                  headers: API_HEADERS()
                });
                const dData = await dRes.json();
                if (dData.success) {
                  Swal.fire('Deleted!', 'Category removed.', 'success');
                  loadCategoryModalList();
                  loadAllLookups();
                } else {
                  Swal.fire('Error', dData.message, 'error');
                }
              } catch (err) {
                console.error(err);
              }
            });
          });

        } else {
          listGroup.innerHTML = '<div class="text-center py-3 text-muted small">No categories registered</div>';
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('addCategoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('catName').value.trim();
    try {
      const res = await fetch('/api/products/categories', {
        method: 'POST',
        headers: API_HEADERS(),
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('catName').value = '';
        loadCategoryModalList();
        loadAllLookups();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Manage Brands Trigger Modal
  const brandModalEl = new bootstrap.Modal(document.getElementById('brandModal'));
  document.getElementById('btnManageBrands').addEventListener('click', () => {
    brandModalEl.show();
    loadBrandModalList();
  });

  const loadBrandModalList = async () => {
    const listGroup = document.getElementById('modalBrandList');
    listGroup.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm text-muted"></span></div>';
    
    try {
      const res = await fetch('/api/products/brands', { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        listGroup.innerHTML = '';
        if (data.brands.length > 0) {
          data.brands.forEach(br => {
            listGroup.innerHTML += `
              <div class="list-group-item d-flex justify-content-between align-items-center py-2">
                <span>${br.name}</span>
                <button class="btn btn-xs btn-outline-danger btn-delete-brand" data-id="${br._id}"><i class="fa-solid fa-trash-can"></i></button>
              </div>
            `;
          });

          document.querySelectorAll('.btn-delete-brand').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              try {
                const dRes = await fetch(`/api/products/brands/${id}`, {
                  method: 'DELETE',
                  headers: API_HEADERS()
                });
                const dData = await dRes.json();
                if (dData.success) {
                  Swal.fire('Deleted!', 'Brand removed.', 'success');
                  loadBrandModalList();
                  loadAllLookups();
                } else {
                  Swal.fire('Error', dData.message, 'error');
                }
              } catch (err) {
                console.error(err);
              }
            });
          });

        } else {
          listGroup.innerHTML = '<div class="text-center py-3 text-muted small">No brands registered</div>';
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('addBrandForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('brandName').value.trim();
    try {
      const res = await fetch('/api/products/brands', {
        method: 'POST',
        headers: API_HEADERS(),
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('brandName').value = '';
        loadBrandModalList();
        loadAllLookups();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Product Add / Update Modal Controls
  const productFormModalEl = new bootstrap.Modal(document.getElementById('productFormModal'));
  
  document.getElementById('btnAddNewProductModal').addEventListener('click', () => {
    openProductModal();
  });

  const openProductModal = (productId = null) => {
    const form = document.getElementById('productDetailsForm');
    form.reset();
    document.getElementById('productModalId').value = '';

    if (productId) {
      document.getElementById('productModalTitle').innerText = 'Edit Product Details';
      const prod = STATE.products.find(p => p._id === productId);
      if (prod) {
        document.getElementById('productModalId').value = prod._id;
        document.getElementById('prodCode').value = prod.code;
        document.getElementById('prodName').value = prod.name;
        document.getElementById('prodCategory').value = prod.category ? prod.category._id : '';
        document.getElementById('prodBrand').value = prod.brand ? prod.brand._id : '';
        document.getElementById('prodSize').value = prod.size;
        document.getElementById('prodColor').value = prod.color;
        document.getElementById('prodPrice').value = prod.price;
        document.getElementById('prodCost').value = prod.costPrice;
        document.getElementById('prodStock').value = prod.stock;
        document.getElementById('prodThreshold').value = prod.lowStockThreshold;
      }
    } else {
      document.getElementById('productModalTitle').innerText = 'Add New Apparel Product';
    }
    
    productFormModalEl.show();
  };

  document.getElementById('productDetailsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('productModalId').value;
    const isEdit = id !== '';

    const payload = {
      code: document.getElementById('prodCode').value.trim(),
      name: document.getElementById('prodName').value.trim(),
      category: document.getElementById('prodCategory').value,
      brand: document.getElementById('prodBrand').value,
      size: document.getElementById('prodSize').value.trim(),
      color: document.getElementById('prodColor').value.trim(),
      price: parseFloat(document.getElementById('prodPrice').value),
      costPrice: parseFloat(document.getElementById('prodCost').value),
      stock: parseInt(document.getElementById('prodStock').value) || 0,
      lowStockThreshold: parseInt(document.getElementById('prodThreshold').value) || 5
    };

    try {
      const url = isEdit ? `/api/products/${id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: API_HEADERS(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: `Product Saved`,
          text: isEdit ? 'Product profile updated.' : 'New apparel item created.',
          timer: 1500,
          showConfirmButton: false
        });
        productFormModalEl.hide();
        loadProductsGrid();
      } else {
        Swal.fire('Error saving product', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  const deleteProductSubmit = (productId) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this! All logs related to this product code remain active.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#111111',
      cancelButtonColor: '#ff3b30',
      confirmButtonText: 'Yes, delete!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: API_HEADERS()
          });
          const data = await res.json();
          if (data.success) {
            Swal.fire('Deleted!', 'Product deleted.', 'success');
            loadProductsGrid();
          } else {
            Swal.fire('Error', data.message, 'error');
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // ==========================================
  // 7. BILLING POS CONTROLLER
  // ==========================================
  const loadBillingPOS = () => {
    document.getElementById('posSearchInput').value = '';
    document.getElementById('posCustomerPhone').value = '';
    document.getElementById('posCustomerDetails').style.display = 'none';
    STATE.currentCustomer = null;
    
    // Clear discounts dropdown
    document.getElementById('posDiscountType').value = 'none';
    document.getElementById('posDiscountValue').value = '0';
    document.getElementById('posDiscountValue').disabled = true;

    renderPOSCart();
  };

  // Discount configuration changes
  document.getElementById('posDiscountType').addEventListener('change', (e) => {
    const type = e.target.value;
    const valInput = document.getElementById('posDiscountValue');
    if (type === 'none') {
      valInput.value = '0';
      valInput.disabled = true;
    } else {
      valInput.disabled = false;
    }
    recalculatePOSCart();
  });

  document.getElementById('posDiscountValue').addEventListener('input', recalculatePOSCart);

  // Show all products in the search dropdown (default view)
  const showAllPOSProducts = async () => {
    const dropdown = document.getElementById('posSearchResults');
    try {
      const res = await fetch('/api/products', { headers: API_HEADERS() });
      const data = await res.json();
      if (data.success && data.products.length > 0) {
        dropdown.innerHTML = '';
        data.products.forEach(p => {
          dropdown.innerHTML += `
            <div class="search-item" data-id="${p._id}">
              <div class="item-details">
                <span class="fw-bold">${p.name} (${p.size}/${p.color})</span>
                <span class="item-code">SKU: ${p.code} | Price: ₹${p.price.toFixed(2)}</span>
              </div>
              <span class="badge ${p.stock > 0 ? 'stock-good' : 'stock-warning'}">
                Stock: ${p.stock}
              </span>
            </div>
          `;
        });
        dropdown.style.display = 'block';

        // Add selection listener to dropdown items
        document.querySelectorAll('.search-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = item.getAttribute('data-id');
            const selectedProd = data.products.find(p => p._id === id);
            addPOSCartItem(selectedProd);
            dropdown.style.display = 'none';
            document.getElementById('posSearchInput').value = '';
          });
        });
      } else {
        dropdown.innerHTML = '<div class="p-3 text-center text-muted small">No products registered in system</div>';
        dropdown.style.display = 'block';
      }
    } catch (err) {
      console.error('Error fetching products for dropdown:', err);
    }
  };

  // Trigger dropdown display on focus or click
  document.getElementById('posSearchInput').addEventListener('focus', () => {
    const q = document.getElementById('posSearchInput').value.trim();
    if (q.length === 0) {
      showAllPOSProducts();
    }
  });

  document.getElementById('posSearchInput').addEventListener('click', (e) => {
    e.stopPropagation();
    const q = document.getElementById('posSearchInput').value.trim();
    if (q.length === 0) {
      showAllPOSProducts();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('posSearchResults');
    const input = document.getElementById('posSearchInput');
    if (dropdown && e.target !== input && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Auto Product Search by SKU/Barcode or Name (when typing)
  document.getElementById('posSearchInput').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    const dropdown = document.getElementById('posSearchResults');

    if (q.length < 1) {
      showAllPOSProducts();
      return;
    }

    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}`, { headers: API_HEADERS() });
      const data = await res.json();
      if (data.success && data.products.length > 0) {
        dropdown.innerHTML = '';
        data.products.forEach(p => {
          dropdown.innerHTML += `
            <div class="search-item" data-id="${p._id}">
              <div class="item-details">
                <span class="fw-bold">${p.name} (${p.size}/${p.color})</span>
                <span class="item-code">SKU: ${p.code} | Price: ₹${p.price.toFixed(2)}</span>
              </div>
              <span class="badge ${p.stock > 0 ? 'stock-good' : 'stock-warning'}">
                Stock: ${p.stock}
              </span>
            </div>
          `;
        });
        dropdown.style.display = 'block';

        // Add selection listener to drop downs
        document.querySelectorAll('.search-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = item.getAttribute('data-id');
            const selectedProd = data.products.find(p => p._id === id);
            addPOSCartItem(selectedProd);
            dropdown.style.display = 'none';
            document.getElementById('posSearchInput').value = '';
          });
        });

      } else {
        dropdown.innerHTML = '<div class="p-3 text-center text-muted small">No products matching query</div>';
        dropdown.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Quick Clear Search button
  document.getElementById('btnClearPosSearch').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('posSearchInput').value = '';
    document.getElementById('posSearchResults').style.display = 'none';
  });


  // Add Item to POS shopping cart
  function addPOSCartItem(product) {
    if (product.stock <= 0) {
      Swal.fire('Out of Stock', 'Cannot add out of stock items to billing cart.', 'warning');
      return;
    }

    const existing = STATE.cart.find(item => item.product === product._id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        Swal.fire('Stock Limit Reached', `Only ${product.stock} units available in inventory.`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      STATE.cart.push({
        product: product._id,
        name: product.name,
        code: product.code,
        price: product.price,
        size: product.size,
        color: product.color,
        quantity: 1,
        maxStock: product.stock
      });
    }

    renderPOSCart();
  }

  function renderPOSCart() {
    const tBody = document.querySelector('#posCartTable tbody');
    tBody.innerHTML = '';

    if (STATE.cart.length === 0) {
      tBody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">Cart is empty. Scan or search items to populate.</td></tr>';
      recalculatePOSCart();
      return;
    }

    STATE.cart.forEach((item, index) => {
      // 12% inclusive GST calculation for display: base = price / 1.12, gst = price - base
      const itemTotal = item.price * item.quantity;
      const gstAmount = itemTotal - (itemTotal / 1.12);

      tBody.innerHTML += `
        <tr>
          <td><strong class="text-dark">${item.name}</strong></td>
          <td class="font-monospace text-uppercase small">${item.code}</td>
          <td><span class="badge bg-light text-dark border">${item.size} / ${item.color}</span></td>
          <td>${formatCurrency(item.price)}</td>
          <td>
            <div class="input-group input-group-sm" style="width: 100px;">
              <button class="btn btn-outline-secondary btn-qty-minus" data-idx="${index}">-</button>
              <input type="number" class="form-control text-center py-0 px-1 input-qty-val" data-idx="${index}" value="${item.quantity}" min="1" max="${item.maxStock}">
              <button class="btn btn-outline-secondary btn-qty-plus" data-idx="${index}">+</button>
            </div>
          </td>
          <td class="text-muted small">${formatCurrency(gstAmount)}</td>
          <td class="fw-bold">${formatCurrency(itemTotal)}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger btn-remove-cart" data-idx="${index}"><i class="fa-solid fa-xmark"></i></button>
          </td>
        </tr>
      `;
    });

    // POS Quantity buttons event listeners
    document.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        if (STATE.cart[idx].quantity > 1) {
          STATE.cart[idx].quantity -= 1;
          renderPOSCart();
        }
      });
    });

    document.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        if (STATE.cart[idx].quantity < STATE.cart[idx].maxStock) {
          STATE.cart[idx].quantity += 1;
          renderPOSCart();
        } else {
          Swal.fire('Stock Limit', `Only ${STATE.cart[idx].maxStock} units of this item are available.`, 'warning');
        }
      });
    });

    document.querySelectorAll('.input-qty-val').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.getAttribute('data-idx'));
        let val = parseInt(input.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > STATE.cart[idx].maxStock) {
          Swal.fire('Stock Limit', `Only ${STATE.cart[idx].maxStock} units of this item are available.`, 'warning');
          val = STATE.cart[idx].maxStock;
        }
        STATE.cart[idx].quantity = val;
        renderPOSCart();
      });
    });

    document.querySelectorAll('.btn-remove-cart').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        STATE.cart.splice(idx, 1);
        renderPOSCart();
      });
    });

    recalculatePOSCart();
  }

  function recalculatePOSCart() {
    let subtotal = 0;
    
    STATE.cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    const gstTotal = subtotal - (subtotal / 1.12);

    // Apply Discount
    const discType = document.getElementById('posDiscountType').value;
    const discVal = parseFloat(document.getElementById('posDiscountValue').value) || 0;
    let discountAmount = 0;

    if (discType === 'percentage') {
      discountAmount = subtotal * (discVal / 100);
    } else if (discType === 'amount') {
      discountAmount = discVal;
    }

    const grandTotal = Math.max(0, subtotal - discountAmount);

    // Update DOM totals
    document.getElementById('posSubtotal').innerText = formatCurrency(subtotal);
    document.getElementById('posGstTotal').innerText = formatCurrency(gstTotal);
    document.getElementById('posDiscountAmount').innerText = `-${formatCurrency(discountAmount)}`;
    document.getElementById('posGrandTotal').innerText = formatCurrency(grandTotal);
  }


  // Clear Cart trigger
  document.getElementById('btnClearCart').addEventListener('click', () => {
    STATE.cart = [];
    renderPOSCart();
  });

  // Lookup customer details via API
  document.getElementById('btnLookupCustomer').addEventListener('click', async () => {
    const phone = document.getElementById('posCustomerPhone').value.trim();
    if (phone.length !== 10 || isNaN(phone)) {
      Swal.fire('Invalid Phone', 'Please enter a valid 10-digit mobile number.', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/customers/${phone}`, { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        STATE.currentCustomer = data.customer;
        document.getElementById('posCustomerNameDisplay').innerText = data.customer.name;
        document.getElementById('posCustomerLoyaltyDisplay').innerText = data.customer.loyaltyPoints;
        document.getElementById('posCustomerDetails').style.display = 'block';
        Swal.fire('Linked!', `Customer ${data.customer.name} linked.`, 'success');
      } else {
        // Offer to register customer
        Swal.fire({
          title: 'Customer Not Found',
          text: `Mobile ${phone} is not registered. Would you like to register them?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#111111',
          confirmButtonText: 'Yes, Register!'
        }).then(result => {
          if (result.isConfirmed) {
            const registerModal = new bootstrap.Modal(document.getElementById('customerCreateModal'));
            document.getElementById('custPhone').value = phone;
            document.getElementById('custName').value = '';
            registerModal.show();
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Handle POS Checkout Submission
  document.getElementById('btnCheckoutSubmit').addEventListener('click', async () => {
    if (STATE.cart.length === 0) {
      Swal.fire('Empty Cart', 'Please add items to cart before checkout.', 'warning');
      return;
    }

    const payload = {
      customerPhone: STATE.currentCustomer ? STATE.currentCustomer.phone : 'Walk-in',
      items: STATE.cart.map(item => ({
        product: item.product,
        name: item.name,
        code: item.code,
        price: item.price,
        quantity: item.quantity
      })),
      discountType: document.getElementById('posDiscountType').value,
      discountValue: parseFloat(document.getElementById('posDiscountValue').value) || 0,
      paymentMode: document.querySelector('input[name="paymentMode"]:checked').value
    };

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: API_HEADERS(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Transaction Successful',
          text: `Invoice ${data.sale.invoiceNo} generated.`,
          timer: 1500,
          showConfirmButton: false
        });

        // Load thermal receipt bill and trigger display modal
        printReceipt(data.sale);

        // Reset cart and states
        STATE.cart = [];
        STATE.currentCustomer = null;
        renderPOSCart();
        
        // Reset POS fields
        document.getElementById('posCustomerPhone').value = '';
        document.getElementById('posCustomerDetails').style.display = 'none';

      } else {
        Swal.fire('Checkout Refused', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Load and show thermal invoice details
  const fetchAndShowInvoice = async (invoiceNo) => {
    try {
      const res = await fetch(`/api/billing/invoice/${invoiceNo}`, { headers: API_HEADERS() });
      const data = await res.json();
      if (data.success) {
        printReceipt(data.sale);
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Compile thermal layout bill inside printing modal
  const invoicePrintModalEl = new bootstrap.Modal(document.getElementById('invoicePrintModal'));
  
  const printReceipt = (sale) => {
    const container = document.getElementById('invoicePrintModalContent');
    
    const formatReceiptNum = (num) => {
      if (!num && num !== 0) return '0';
      return Number(num).toLocaleString('en-IN', {
        minimumFractionDigits: (num % 1 === 0) ? 0 : 2,
        maximumFractionDigits: 2
      });
    };

    const dObj = new Date(sale.date || Date.now());
    const day = String(dObj.getDate()).padStart(2, '0');
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const year = dObj.getFullYear();
    const dateFormatted = `${day}-${month}-${year}`;

    let itemRows = '';
    sale.items.forEach(item => {
      const priceVal = item.subtotal || (item.price * item.quantity);
      itemRows += `
        <tr>
          <td style="text-align: left; padding: 5px 0; font-size: 11px; font-weight: 700; text-transform: uppercase;">${item.name || item.code}</td>
          <td style="text-align: center; padding: 5px 0; font-size: 11px; font-weight: 700;">${item.quantity}</td>
          <td style="text-align: right; padding: 5px 0; font-size: 11px; font-weight: 700;">${formatReceiptNum(priceVal)}</td>
        </tr>
      `;
    });

    const hasDiscount = (sale.discountAmount && sale.discountAmount > 0) || (sale.discountValue && sale.discountValue > 0);
    const isPercentage = sale.discountType === 'percentage';
    const discLabel = isPercentage ? `${sale.discountValue}%` : formatReceiptNum(sale.discountAmount);

    container.innerHTML = `
      <div style="font-family: 'Courier New', Courier, monospace; color: #000; padding: 5px; width: 100%; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-family: 'Times New Roman', Times, serif; font-size: 22px; font-weight: normal; letter-spacing: 3px; margin-bottom: 2px;">LITTLE &nbsp; AURA</div>
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Kids Boutique • Korean Fashion</div>
          <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">Salem, Tamil Nadu</div>
          <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; margin-bottom: 3px;">206,CHERRY ROAD,VINCENT SALEM-636007</div>
          <div style="font-size: 10px; font-weight: 700;">Ph: 6383834943 , 8838045745</div>
        </div>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <table style="width: 100%; border-collapse: collapse; font-family: 'Courier New', Courier, monospace;">
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left; padding: 4px 0; font-size: 12px; font-weight: 700;">ITEM</th>
              <th style="text-align: center; padding: 4px 0; font-size: 12px; font-weight: 700;">QTY</th>
              <th style="text-align: right; padding: 4px 0; font-size: 12px; font-weight: 700;">PRICE</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; padding: 3px 0;">
          <span>Sub Total</span>
          <span>${formatReceiptNum(sale.subtotal)}</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        ${hasDiscount ? `
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; padding: 3px 0;">
          <span>discount</span>
          <span>${discLabel}</span>
        </div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
          <span style="font-size: 13px; font-weight: 900; line-height: 1.1;">GRAND<br>TOTAL</span>
          <span style="font-size: 16px; font-weight: 900;">${formatReceiptNum(sale.grandTotal)}</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <div style="font-size: 11px; font-weight: 700; margin-top: 10px; margin-bottom: 12px;">
          DATE : ${dateFormatted}
        </div>

        <div style="text-align: center; font-size: 10px; font-weight: 700; line-height: 1.4; letter-spacing: 0.3px; border-bottom: 1px solid #000; padding-bottom: 6px;">
          <div>"WITH LOVE,PACKED WITH STYLE"</div>
          <div>"THANK YOU FOR BEING</div>
          <div>PART OF LITTLE AURA"</div>
        </div>
      </div>
    `;

    // Store sale instance to modal buttons for downloads
    document.getElementById('btnDownloadInvoicePDF').onclick = () => downloadInvoiceAsPDF(sale.invoiceNo);
    document.getElementById('btnExecuteInvoicePrint').onclick = () => window.print();

    invoicePrintModalEl.show();
  };

  // PDF Downloader for invoice thermal layout using html2pdf
  const downloadInvoiceAsPDF = (invoiceNo) => {
    const element = document.getElementById('invoicePrintModalContent');
    const opt = {
      margin: 5,
      filename: `${invoiceNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: 'mm', format: [90, 200], orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
  };

  // ==========================================
  // 8. STOCK & INVENTORY LOGS CONTROLLER
  // ==========================================
  const loadInventoryLogs = async () => {
    try {
      // 1. Fetch current valuations
      const pRes = await fetch('/api/products', { headers: API_HEADERS() });
      const pData = await pRes.json();
      if (pData.success) {
        let retailVal = 0;
        let costVal = 0;
        let lowStockItemsCount = 0;

        pData.products.forEach(p => {
          retailVal += p.price * p.stock;
          costVal += p.costPrice * p.stock;
          if (p.stock <= p.lowStockThreshold) lowStockItemsCount += 1;
        });

        document.getElementById('statInventoryValuationRetail').innerText = formatCurrency(retailVal);
        document.getElementById('statInventoryValuationCost').innerText = formatCurrency(costVal);
        document.getElementById('statInventoryLowStockCount').innerText = `${lowStockItemsCount} Items`;
      }

      // 2. Fetch log history
      const res = await fetch('/api/inventory/logs', { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        const tBody = document.querySelector('#inventoryLogsTable tbody');
        tBody.innerHTML = '';
        
        if (data.logs.length > 0) {
          data.logs.forEach(log => {
            const isStockIn = log.type === 'in';
            tBody.innerHTML += `
              <tr>
                <td class="small text-muted">${formatDate(log.date)}</td>
                <td>
                  <strong class="text-dark">${log.product ? log.product.name : 'Unknown Product'}</strong>
                  <span class="badge bg-light text-dark border ms-1">${log.product ? `${log.product.size}/${log.product.color}` : ''}</span>
                </td>
                <td class="font-monospace text-uppercase small">${log.productCode}</td>
                <td>
                  <span class="badge ${isStockIn ? 'bg-success' : 'bg-danger'} text-uppercase">
                    Stock ${isStockIn ? 'In' : 'Out'}
                  </span>
                </td>
                <td class="fw-bold ${isStockIn ? 'text-success' : 'text-danger'}">${isStockIn ? '+' : '-'}${log.quantity}</td>
                <td>${log.reason}</td>
                <td><i class="fa-solid fa-user me-1 small text-muted"></i> ${log.user ? log.user.name : 'Cashier'}</td>
              </tr>
            `;
          });
        } else {
          tBody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No stock logs found</td></tr>';
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Stock Adjustment triggering modal
  const stockAdjustmentModalEl = new bootstrap.Modal(document.getElementById('stockAdjustmentModal'));
  document.getElementById('btnStockAdjustmentModal').addEventListener('click', async () => {
    // Populate product drop down select
    const select = document.getElementById('adjProduct');
    select.innerHTML = '<option value="" disabled selected>Select clothing product...</option>';

    try {
      const res = await fetch('/api/products', { headers: API_HEADERS() });
      const data = await res.json();
      if (data.success) {
        data.products.forEach(p => {
          select.innerHTML += `<option value="${p._id}">${p.name} [SKU: ${p.code}] (Stock: ${p.stock} | ${p.size}/${p.color})</option>`;
        });
        stockAdjustmentModalEl.show();
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Submit stock adjustment
  document.getElementById('stockAdjustmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      productId: document.getElementById('adjProduct').value,
      type: document.getElementById('adjType').value,
      quantity: parseInt(document.getElementById('adjQty').value),
      reason: document.getElementById('adjReason').value.trim()
    };

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: API_HEADERS(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire('Stock Adjusted', data.message, 'success');
        stockAdjustmentModalEl.hide();
        loadInventoryLogs();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // ==========================================
  // 9. CUSTOMERS DIRECTORY CONTROLLER
  // ==========================================
  const loadCustomersList = async () => {
    try {
      const q = document.getElementById('customerSearchQuery').value.trim();
      const queryParams = q !== '' ? `?search=${encodeURIComponent(q)}` : '';

      const res = await fetch(`/api/customers${queryParams}`, { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        const tBody = document.querySelector('#customersTable tbody');
        tBody.innerHTML = '';

        if (data.customers.length > 0) {
          data.customers.forEach(cust => {
            tBody.innerHTML += `
              <tr>
                <td><strong class="text-dark">${cust.name}</strong></td>
                <td>${cust.phone}</td>
                <td class="fw-bold text-success">${cust.loyaltyPoints} Points</td>
                <td>${cust.purchaseHistory.length} Bills registered</td>
                <td>
                  <button class="btn btn-sm btn-dark btn-customer-history" data-phone="${cust.phone}">
                    <i class="fa-solid fa-clock-rotate-left me-1"></i> Orders
                  </button>
                </td>
              </tr>
            `;
          });

          // Add history event listeners
          document.querySelectorAll('.btn-customer-history').forEach(btn => {
            btn.addEventListener('click', () => {
              const phone = btn.getAttribute('data-phone');
              openCustomerHistoryModal(phone);
            });
          });

        } else {
          tBody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No customers match search.</td></tr>';
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('btnCustomerFilterSearch').addEventListener('click', loadCustomersList);
  document.getElementById('customerSearchQuery').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') loadCustomersList();
  });

  // Customer creation modal triggers
  const customerCreateModalEl = new bootstrap.Modal(document.getElementById('customerCreateModal'));
  document.getElementById('btnAddNewCustomerModal').addEventListener('click', () => {
    document.getElementById('custPhone').value = '';
    document.getElementById('custName').value = '';
    customerCreateModalEl.show();
  });

  document.getElementById('customerCreateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('custPhone').value.trim();
    const name = document.getElementById('custName').value.trim();

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: API_HEADERS(),
        body: JSON.stringify({ phone, name })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire('Registered!', `Customer ${name} registered.`, 'success');
        customerCreateModalEl.hide();
        loadCustomersList();
        
        // Link to POS if we came from Lookup
        if (STATE.activeView === 'billingView') {
          STATE.currentCustomer = data.customer;
          document.getElementById('posCustomerPhone').value = data.customer.phone;
          document.getElementById('posCustomerNameDisplay').innerText = data.customer.name;
          document.getElementById('posCustomerLoyaltyDisplay').innerText = data.customer.loyaltyPoints;
          document.getElementById('posCustomerDetails').style.display = 'block';
          recalculatePOSCart();
        }
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Open Customer transaction history modal
  const customerHistoryModalEl = new bootstrap.Modal(document.getElementById('customerHistoryModal'));
  const openCustomerHistoryModal = async (phone) => {
    try {
      const res = await fetch(`/api/customers/${phone}`, { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        const cust = data.customer;
        document.getElementById('customerHistoryName').innerText = cust.name;
        document.getElementById('customerHistoryPhone').innerText = cust.phone;
        document.getElementById('customerHistoryPoints').innerText = `${cust.loyaltyPoints} Points`;

        const tBody = document.querySelector('#customerHistoryTable tbody');
        tBody.innerHTML = '';

        if (cust.purchaseHistory && cust.purchaseHistory.length > 0) {
          cust.purchaseHistory.forEach(sale => {
            tBody.innerHTML += `
              <tr>
                <td><strong class="font-monospace text-uppercase small">${sale.invoiceNo}</strong></td>
                <td class="small text-muted">${formatDate(sale.date)}</td>
                <td class="fw-bold">${formatCurrency(sale.grandTotal)}</td>
                <td><span class="badge text-uppercase bg-secondary">${sale.paymentMode}</span></td>
                <td>${sale.cashier ? sale.cashier.name : 'Cashier'}</td>
                <td>
                  <button class="btn btn-xs btn-outline-dark btn-cust-invoice" data-invoice="${sale.invoiceNo}">
                    View Bill
                  </button>
                </td>
              </tr>
            `;
          });

          // Add click triggers to invoices inside customer history modal
          document.querySelectorAll('.btn-cust-invoice').forEach(btn => {
            btn.addEventListener('click', () => {
              const inv = btn.getAttribute('data-invoice');
              fetchAndShowInvoice(inv);
            });
          });

        } else {
          tBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No sales invoices found.</td></tr>';
        }

        customerHistoryModalEl.show();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // 10. SALES REPORTS CONTROLLER
  // ==========================================
  const loadReportsModule = async () => {
    // Default: Set date inputs to last 30 days
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);

    document.getElementById('reportStartDate').value = monthAgo.toISOString().slice(0, 10);
    document.getElementById('reportEndDate').value = today.toISOString().slice(0, 10);

    fetchReportsData();
  };

  const fetchReportsData = async () => {
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;

    try {
      const res = await fetch(`/api/reports/sales?startDate=${start}&endDate=${end}`, { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        // 1. Populate summary blocks
        const summary = data.summary;
        document.getElementById('reportTotalRevenue').innerText = formatCurrency(summary.totalRevenue);
        document.getElementById('reportTotalTransactions').innerText = summary.totalTransactions;
        
        const avgBasket = summary.totalTransactions > 0 ? (summary.totalRevenue / summary.totalTransactions) : 0;
        document.getElementById('reportAverageBasket').innerText = formatCurrency(avgBasket);

        // 2. Populate detailed transaction log table
        const tBody = document.querySelector('#reportsSalesTable tbody');
        tBody.innerHTML = '';
        if (data.sales && data.sales.length > 0) {
          data.sales.forEach(sale => {
            tBody.innerHTML += `
              <tr>
                <td><strong class="font-monospace text-uppercase small">${sale.invoiceNo}</strong></td>
                <td>${formatDate(sale.date)}</td>
                <td>${sale.customerPhone}</td>
                <td>${formatCurrency(sale.subtotal)}</td>
                <td class="text-danger">-${formatCurrency(sale.discountAmount)}</td>
                <td class="fw-bold">${formatCurrency(sale.grandTotal)}</td>
                <td><span class="badge text-uppercase bg-secondary">${sale.paymentMode}</span></td>
                <td>${sale.cashier ? sale.cashier.name : 'Staff'}</td>
              </tr>
            `;
          });
        } else {
          tBody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No sales found in this period.</td></tr>';
        }

        // 3. Populate product wise sales rank table
        const rankBody = document.querySelector('#reportProductRankingTable tbody');
        rankBody.innerHTML = '';
        if (data.productWiseSales && data.productWiseSales.length > 0) {
          data.productWiseSales.forEach(item => {
            rankBody.innerHTML += `
              <tr>
                <td>
                  <strong class="text-dark small">${item.name}</strong><br>
                  <span class="font-monospace text-uppercase text-muted" style="font-size: 0.7rem;">Code: ${item.code}</span>
                </td>
                <td class="fw-bold">${item.quantity}</td>
                <td class="fw-bold text-success">${formatCurrency(item.revenue)}</td>
              </tr>
            `;
          });
        } else {
          rankBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted small">No product sales logged.</td></tr>';
        }

        // 4. Render payment breakdown chart using Chart.js
        renderPaymentChart(summary.paymentBreakdown);
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('btnApplyReportFilter').addEventListener('click', fetchReportsData);

  const renderPaymentChart = (paymentData) => {
    const ctx = document.getElementById('paymentChartCanvas').getContext('2d');
    
    // Destroy previous chart if exists
    if (STATE.dashboardChart) {
      STATE.dashboardChart.destroy();
    }

    const hasData = (paymentData.cash + paymentData.upi + paymentData.card) > 0;

    STATE.dashboardChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Cash', 'UPI Payments', 'Cards'],
        datasets: [{
          data: hasData ? [paymentData.cash, paymentData.upi, paymentData.card] : [0, 0, 0],
          backgroundColor: ['#c5a880', '#34c759', '#007aff'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: {
                family: 'Outfit',
                size: 13
              }
            }
          }
        }
      }
    });
  };

  // Export to Excel trigger (using SheetJS xlsx CDN)
  document.getElementById('btnExportCSV').addEventListener('click', () => {
    const table = document.getElementById('reportsSalesTable');
    const workbook = XLSX.utils.table_to_book(table, { sheet: "ClothBill Sales" });
    XLSX.writeFile(workbook, `sales_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  // Print PDF Summary
  document.getElementById('btnPrintReport').addEventListener('click', () => {
    const opt = {
      margin: 10,
      filename: `sales_report_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    const element = document.getElementById('salesReportPrintContainer');
    html2pdf().from(element).set(opt).save();
  });

  // ==========================================
  // 11. STAFF & USER MANAGEMENT CONTROLLER
  // ==========================================
  const loadUsersModule = async () => {
    loadStaffGrid();
  };

  const loadStaffGrid = async () => {
    const tBody = document.querySelector('#staffTable tbody');
    tBody.innerHTML = '<tr><td colspan="4" class="text-center py-3"><span class="spinner-border spinner-border-sm text-muted"></span></td></tr>';

    try {
      const res = await fetch('/api/auth/staff', { headers: API_HEADERS() });
      const data = await res.json();

      if (data.success) {
        tBody.innerHTML = '';
        data.staff.forEach(member => {
          const isAdmin = member.role === 'admin';
          tBody.innerHTML += `
            <tr>
              <td><strong>${member.name}</strong></td>
              <td>${member.username}</td>
              <td><span class="badge ${isAdmin ? 'bg-dark' : 'bg-secondary'} text-uppercase">${member.role}</span></td>
              <td>
                ${isAdmin ? '<span class="text-muted small">Protected</span>' : `
                  <button class="btn btn-xs btn-outline-danger btn-delete-staff" data-id="${member._id}">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                `}
              </td>
            </tr>
          `;
        });

        // Register staff deletion triggers
        document.querySelectorAll('.btn-delete-staff').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            deleteStaffSubmit(id);
          });
        });
      }
    } catch (err) {
      console.error(err);
      tBody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-danger">Error loading employee listing</td></tr>';
    }
  };

  // Register New Employee
  document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('staffName').value.trim(),
      username: document.getElementById('staffUsername').value.trim(),
      password: document.getElementById('staffPassword').value,
      role: document.getElementById('staffRole').value
    };

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: API_HEADERS(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire('Registered!', `Staff ${payload.name} created.`, 'success');
        document.getElementById('addStaffForm').reset();
        loadStaffGrid();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  const deleteStaffSubmit = (memberId) => {
    Swal.fire({
      title: 'Remove Staff?',
      text: 'This employee will immediately lose terminal POS access.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff3b30',
      cancelButtonColor: '#111111',
      confirmButtonText: 'Yes, remove!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`/api/auth/staff/${memberId}`, {
            method: 'DELETE',
            headers: API_HEADERS()
          });
          const data = await res.json();
          if (data.success) {
            Swal.fire('Removed!', 'Employee removed from system.', 'success');
            loadStaffGrid();
          } else {
            Swal.fire('Error', data.message, 'error');
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // Change Password form handler
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: API_HEADERS(),
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire('Updated!', 'Password changed successfully.', 'success');
        document.getElementById('changePasswordForm').reset();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });

  // ==========================================
  // 12. RUN INITIAL AUTHORIZATION CHECK ON LOAD
  // ==========================================
  checkAuthStatus();

});
