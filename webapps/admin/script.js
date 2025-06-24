// Variables globales
const API_BASE = window.location.origin + '/api';
let currentEditingProduct = null;
let currentEditingAdmin = null;
let allAppointments = [];
let allInvoices = [];
let allAdmins = [];
let currentUserPermission = 'admin'; // This would be set based on logged-in user
let isAdminVerified = false; // NUEVO: Estado de verificación de admin

// Elementos del DOM - Declaraciones sin asignación inicial
let tabButtons, tabContents, addProductBtn, productModal, productForm, closeBtn, cancelBtn;
let productsList, appointmentsList, invoicesList, adminsList;
let addAdminBtn, adminModal, adminForm, cancelAdminBtn;
let refreshProductsBtn, refreshAppointmentsBtn, refreshInvoicesBtn, refreshAdminsBtn;
let appointmentFilter, appointmentDateFilter, invoiceStatusFilter, scrollToTopBtn;

// Inicialización de Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // NUEVO: Verificar permisos de admin antes de inicializar
    verifyAdminAccess().then((result) => {
        // CORREGIDO: Usar los permisos reales obtenidos del servidor
        const userPermission = result.isSuperAdmin ? 'superadmin' : 'admin';
        setCurrentUserPermission(userPermission);
        console.log('✅ Admin verificado - inicializando con permisos:', userPermission);
    }).catch((error) => {
        // CORREGIDO: Inicializar aunque falle la verificación
        console.warn('⚠️ Error en verificación de admin:', error.message);
        console.log('🔄 Inicializando con permisos básicos de admin...');
        setCurrentUserPermission('admin'); // Permisos básicos como fallback
    }).finally(() => {
        // CORREGIDO: Siempre inicializar la aplicación
        console.log('🚀 Inicializando aplicación...');
        initializeApp();
        setupEventListeners();
        loadProducts();
        loadAppointments();
        loadInvoices();
    });
});

function initializeApp() {
    // Configurar temas para Telegram WebApp
    if (tg && tg.themeParams) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
    }
    
    // MEJORAR: Recargar datos cada 30 segundos para mantener sincronización
    setInterval(() => {
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        console.log('Sincronización automática admin - tab activa:', activeTab);
        
        if (activeTab === 'products') {
            loadProducts();
        } else if (activeTab === 'appointments') {
            loadAppointments();
        } else if (activeTab === 'invoices') {
            loadInvoices();
        }
    }, 30000);
    
    // AGREGAR: Detectar cuando la ventana admin vuelve a ser visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('Admin webapp visible: recargando datos...');
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            
            if (activeTab === 'products') {
                loadProducts();
            } else if (activeTab === 'appointments') {
                loadAppointments();
            } else if (activeTab === 'invoices') {
                loadInvoices();
            }
        }
    });
}

function setupEventListeners() {
    // CORREGIDO: Obtener elementos del DOM aquí, cuando ya existen
    console.log('🔧 Inicializando elementos del DOM...');
    
    // Tab navigation elements
    tabButtons = document.querySelectorAll('.tab-btn');
    tabContents = document.querySelectorAll('.tab-content');
    
    // Product elements
    addProductBtn = document.getElementById('addProductBtn');
    productModal = document.getElementById('productModal');
    productForm = document.getElementById('productForm');
    closeBtn = document.querySelector('.close');
    cancelBtn = document.getElementById('cancelBtn');
    productsList = document.getElementById('productsList');
    
    // Other list elements
    appointmentsList = document.getElementById('appointmentsList');
    invoicesList = document.getElementById('invoicesList');
    adminsList = document.getElementById('adminsList');
    
    // Admin elements - CRÍTICO: Obtener aquí cuando el DOM ya existe
    addAdminBtn = document.getElementById('addAdminBtn');
    adminModal = document.getElementById('adminModal');
    adminForm = document.getElementById('adminForm');
    cancelAdminBtn = document.getElementById('cancelAdminBtn');
    
    // Refresh buttons
    refreshProductsBtn = document.getElementById('refreshProductsBtn');
    refreshAppointmentsBtn = document.getElementById('refreshAppointmentsBtn');
    refreshInvoicesBtn = document.getElementById('refreshInvoicesBtn');
    refreshAdminsBtn = document.getElementById('refreshAdminsBtn');
    
    // Filter elements
    appointmentFilter = document.getElementById('appointmentFilter');
    appointmentDateFilter = document.getElementById('appointmentDateFilter');
    invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
    
    // Scroll button
    scrollToTopBtn = document.getElementById('scrollToTopBtn');
    
    console.log('✅ Elementos DOM obtenidos:');
    console.log('- addAdminBtn:', !!addAdminBtn, addAdminBtn);
    console.log('- adminModal:', !!adminModal, adminModal);
    console.log('- adminForm:', !!adminForm, adminForm);
    console.log('- cancelAdminBtn:', !!cancelAdminBtn, cancelAdminBtn);

    // Tab navigation
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });    // Product modal events
    addProductBtn?.addEventListener('click', openAddProductModal);
    cancelBtn?.addEventListener('click', closeProductModal);
    closeBtn?.addEventListener('click', closeProductModal);
    productForm?.addEventListener('submit', handleProductSubmit);

    // Validación en tiempo real para campos obligatorios
    const colorsInput = document.getElementById('colorsInput');
    const sizesInput = document.getElementById('sizesInput');
    
    if (colorsInput) {
        colorsInput.addEventListener('input', function() {
            const value = this.value.trim();
            if (value === '') {
                this.setCustomValidity('Debes ingresar al menos un color');
            } else {
                this.setCustomValidity('');
            }
        });
        
        colorsInput.addEventListener('blur', function() {
            const value = this.value.trim();
            if (value === '') {
                showNotification('Recuerda: Debes ingresar al menos un color para el producto', 'warning');
            }
        });
    }
    
    if (sizesInput) {
        sizesInput.addEventListener('input', function() {
            const value = this.value.trim();
            if (value === '') {
                this.setCustomValidity('Debes ingresar al menos una talla');
            } else {
                this.setCustomValidity('');
            }
        });
        
        sizesInput.addEventListener('blur', function() {
            const value = this.value.trim();
            if (value === '') {
                showNotification('Recuerda: Debes ingresar al menos una talla para el producto', 'warning');
            }
        });
    }

    // Close modal when clicking outside
    productModal?.addEventListener('click', (e) => {
        if (e.target === productModal) {
            closeProductModal();
        }
    });

    // Refresh buttons
    refreshProductsBtn?.addEventListener('click', () => {
        console.log('Refrescando productos...');
        refreshProductsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        loadProducts().finally(() => {
            refreshProductsBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        });
    });

    refreshAppointmentsBtn?.addEventListener('click', () => {
        console.log('Refrescando citas...');
        refreshAppointmentsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        loadAppointments().finally(() => {
            refreshAppointmentsBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        });
    });

    refreshInvoicesBtn?.addEventListener('click', () => {
        console.log('Refrescando facturas...');
        refreshInvoicesBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        loadInvoices().finally(() => {
            refreshInvoicesBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        });
    });

    // Admin modal events - CORREGIDO: Verificar y agregar event listeners de forma más robusta
    console.log('🔧 Configurando event listeners para admin...');
    
    if (addAdminBtn) {
        console.log('✅ addAdminBtn encontrado, agregando event listener');
        addAdminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🎯 Botón Agregar Admin clickeado');
            console.log('adminModal antes de abrir:', adminModal);
            openAddAdminModal();
        });
        console.log('✅ Event listener agregado para addAdminBtn');
    } else {
        console.error('❌ addAdminBtn NO ENCONTRADO en el DOM');
        console.log('🔍 Intentando encontrar el elemento con diferentes métodos...');
        
        // Debugging adicional
        const btnCheck = document.querySelector('#addAdminBtn');
        const btnByClass = document.querySelector('[id="addAdminBtn"]');
        const allBtns = document.querySelectorAll('button');
        
        console.log('querySelector #addAdminBtn:', btnCheck);
        console.log('querySelector [id="addAdminBtn"]:', btnByClass);
        console.log('Todos los botones encontrados:', allBtns.length);
        
        // Buscar botón por texto
        Array.from(allBtns).forEach((btn, index) => {
            if (btn.textContent.includes('Agregar Admin')) {
                console.log(`Botón con texto "Agregar Admin" encontrado en índice ${index}:`, btn);
            }
        });
        
        // Intentar agregar listener de forma alternativa después de un delay
        setTimeout(() => {
            const delayedBtn = document.getElementById('addAdminBtn');
            if (delayedBtn) {
                console.log('✅ addAdminBtn encontrado después del delay');
                delayedBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🎯 Botón Agregar Admin clickeado (delayed)');
                    openAddAdminModal();
                });
            }
        }, 1000);
    }
    
    if (cancelAdminBtn) {
        cancelAdminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🎯 Botón Cancelar Admin clickeado');
            closeAdminModal();
        });
        console.log('✅ Event listener agregado para cancelAdminBtn');
    } else {
        console.error('❌ cancelAdminBtn NO ENCONTRADO');
    }
    
    // AGREGAR: Event listener para el botón X del modal de admins
    if (adminModal) {
        const adminModalCloseBtn = adminModal.querySelector('.close');
        if (adminModalCloseBtn) {
            adminModalCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🎯 Botón X del modal admin clickeado');
                closeAdminModal();
            });
            console.log('✅ Event listener agregado para botón X del modal admin');
        } else {
            console.error('❌ Botón X del modal admin NO ENCONTRADO');
        }
    }
    
    // Close admin modal when clicking outside
    adminModal?.addEventListener('click', (e) => {
        if (e.target === adminModal) {
            console.log('🎯 Click fuera del modal admin detectado');
            closeAdminModal();
        }
    });
    
    if (adminForm) {
        adminForm.addEventListener('submit', handleAdminSubmit);
        console.log('✅ Event listener agregado para adminForm submit');
    } else {
        console.error('❌ adminForm NO ENCONTRADO');
    }

    // Admin refresh button
    refreshAdminsBtn?.addEventListener('click', () => {
        console.log('Refrescando admins...');
        refreshAdminsBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        loadAdmins().finally(() => {
            refreshAdminsBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        });
    });

    // Filter events
    appointmentFilter?.addEventListener('change', filterAppointments);
    appointmentDateFilter?.addEventListener('change', filterAppointments);
    invoiceStatusFilter?.addEventListener('change', filterInvoices);
    
    // Scroll functionality
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.style.display = 'block';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// Función para mostrar animación de refresh
function showRefreshAnimation(button) {
    const icon = button.querySelector('i');
    icon.classList.add('fa-spin');
    setTimeout(() => {
        icon.classList.remove('fa-spin');
    }, 1000);
}

// Tab Management
function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // Load data for specific tabs
    switch(tabName) {
        case 'products':
            loadProducts();
            break;
        case 'appointments':
            loadAppointments();
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'admins':
            loadAdmins();
            break;
    }
}

// Product Management - MEJORADO
function openAddProductModal() {
    currentEditingProduct = null;
    document.getElementById('modalTitle').textContent = 'Agregar Producto';
    productForm.reset();
    
    // Limpiar validaciones personalizadas
    clearCustomValidations();
    
    productModal.classList.add('show');
    document.body.classList.add('modal-open'); // Prevenir scroll del body
}

function openEditProductModal(product) {
    currentEditingProduct = product;
    document.getElementById('modalTitle').textContent = 'Editar Producto';
    
    // Fill form with product data
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productBrand').value = product.brand || '';
    document.getElementById('productCategory').value = product.category || '';
    document.getElementById('productPrice').value = product.price || '';
    document.getElementById('productStock').value = product.stock || '';
    document.getElementById('productImage').value = product.image_url || '';
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('colorsInput').value = Array.isArray(product.colors) ? product.colors.join(', ') : '';
    document.getElementById('sizesInput').value = Array.isArray(product.sizes) ? product.sizes.join(', ') : '';
    
    // Limpiar validaciones personalizadas
    clearCustomValidations();
    
    productModal.classList.add('show');
    document.body.classList.add('modal-open'); // Prevenir scroll del body
}

function closeProductModal() {
    productModal.classList.remove('show');
    document.body.classList.remove('modal-open'); // Restaurar scroll del body
    currentEditingProduct = null;
    productForm.reset();
    
    // Limpiar validaciones personalizadas
    clearCustomValidations();
}

// Función para limpiar validaciones personalizadas
function clearCustomValidations() {
    const colorsInput = document.getElementById('colorsInput');
    const sizesInput = document.getElementById('sizesInput');
    
    if (colorsInput) {
        colorsInput.setCustomValidity('');
    }
    if (sizesInput) {
        sizesInput.setCustomValidity('');
    }
}

// MEJORAR el manejo de envío de productos
async function handleProductSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(productForm);
    const colorsValue = document.getElementById('colorsInput').value.trim();
    const sizesValue = document.getElementById('sizesInput').value.trim();
    
    // Validación: Verificar que se haya ingresado al menos un color
    if (!colorsValue) {
        showNotification('Error: Debes ingresar al menos un color para el producto', 'error');
        document.getElementById('colorsInput').focus();
        return;
    }
    
    // Validación: Verificar que se haya ingresado al menos una talla
    if (!sizesValue) {
        showNotification('Error: Debes ingresar al menos una talla para el producto', 'error');
        document.getElementById('sizesInput').focus();
        return;
    }
    
    const colors = colorsValue.split(',').map(c => c.trim()).filter(c => c);
    const sizes = sizesValue.split(',').map(s => s.trim()).filter(s => s);
    
    // Validación adicional: Verificar que después del procesamiento aún hay colores y tallas
    if (colors.length === 0) {
        showNotification('Error: Debes ingresar al menos un color válido para el producto', 'error');
        document.getElementById('colorsInput').focus();
        return;
    }
    
    if (sizes.length === 0) {
        showNotification('Error: Debes ingresar al menos una talla válida para el producto', 'error');
        document.getElementById('sizesInput').focus();
        return;
    }
    
    const productData = {
        name: formData.get('name'),
        brand: formData.get('brand'),
        category: formData.get('category'),
        price: parseFloat(formData.get('price')) || 0,
        stock: parseInt(formData.get('stock')) || 0,
        image_url: formData.get('image_url'),
        description: formData.get('description'),
        colors: colors,
        sizes: sizes
    };

    try {
        const url = currentEditingProduct 
            ? `${API_BASE}/admin/products/${currentEditingProduct.id}`
            : `${API_BASE}/admin/products`;
        
        const method = currentEditingProduct ? 'PUT' : 'POST';
        
        console.log(`${method} producto:`, productData);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData)
        });

        const responseData = await response.json();
        console.log('Respuesta del servidor:', responseData);

        if (response.ok) {
            closeProductModal();
            
            // Recargar productos inmediatamente
            await loadProducts();
            
            const action = currentEditingProduct ? 'actualizado' : 'creado';
            showNotification(`Producto ${action} exitosamente`, 'success');
            
            // AGREGAR: Notificar que los datos han cambiado para sincronización
            console.log('Producto modificado - datos actualizados para sincronización');
            
            // NUEVO: Señalizar cambio a otras páginas usando localStorage
            localStorage.setItem('admin_products_updated', Date.now().toString());
            
            // NUEVO: Broadcast del cambio para comunicación inmediata
            const event = new CustomEvent('adminProductsUpdated', {
                detail: { action: currentEditingProduct ? 'updated' : 'created', productId: responseData.id }
            });
            window.dispatchEvent(event);
        } else {
            const error = responseData.error || 'Error al guardar producto';
            console.error('Error del servidor:', error);
            showNotification(error, 'error');
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        showNotification('Error al conectar con el servidor', 'error');
    }
}

// MEJORAR la carga de productos con mejor manejo de errores
async function loadProducts() {
    try {
        console.log('Admin: Cargando productos...');
        
        // Mostrar loading state
        if (productsList) {
            productsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</div>';
        }
        
        const response = await fetch(`${API_BASE}/admin/products`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const products = await response.json();
        console.log(`Admin: ${products.length} productos cargados`);
        
        renderProducts(products);
        
    } catch (error) {
        console.error('Error loading products:', error);
        if (productsList) {
            productsList.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar productos: ${error.message}</p>
                    <button onclick="loadProducts()" class="btn btn-primary">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>
            `;
        }
        showNotification('Error al cargar productos', 'error');
    }
}

function renderProducts(products) {
    if (products.length === 0) {
        productsList.innerHTML = '<div class="empty-state">No hay productos registrados</div>';
        return;
    }

    productsList.innerHTML = products.map(product => {
        // Ensure colors and sizes are arrays and format them properly
        let colors = [];
        let sizes = [];
        
        // Handle colors
        if (product.colors) {
            if (Array.isArray(product.colors)) {
                colors = product.colors;
            } else if (typeof product.colors === 'string') {
                try {
                    // Try to parse as JSON first
                    colors = JSON.parse(product.colors);
                } catch (e) {
                    // If not JSON, split by comma
                    colors = product.colors.split(',').map(c => c.trim()).filter(c => c);
                }
            }
        }
        
        // Handle sizes
        if (product.sizes) {
            if (Array.isArray(product.sizes)) {
                sizes = product.sizes;
            } else if (typeof product.sizes === 'string') {
                try {
                    // Try to parse as JSON first
                    sizes = JSON.parse(product.sizes);
                } catch (e) {
                    // If not JSON, split by comma
                    sizes = product.sizes.split(',').map(s => s.trim()).filter(s => s);
                }
            }
        }

        return `
            <div class="product-card">
                ${product.image_url 
                    ? `<img src="${product.image_url}" alt="${product.name}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="product-image" style="display:none;"><i class="fas fa-image"></i></div>`
                    : `<div class="product-image"><i class="fas fa-image"></i></div>`
                }
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-brand">${product.brand || 'Sin marca'}</div>
                    <div class="product-price">$${product.price}</div>
                    <div class="product-stock ${getStockClass(product.stock)}">
                        Stock: ${product.stock} unidades
                    </div>
                    ${colors.length > 0 ? `
                        <div class="product-tags">
                            ${colors.map(color => `<span class="tag">${color}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${sizes.length > 0 ? `
                        <div class="product-tags">
                            ${sizes.map(size => `<span class="tag">${size}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="product-actions">
                        <button class="btn btn-sm btn-primary" onclick="openEditProductModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStockClass(stock) {
    if (stock > 10) return 'stock-high';
    if (stock > 5) return 'stock-medium';
    return 'stock-low';
}

async function deleteProduct(productId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/products/${productId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadProducts();
            showNotification('Producto eliminado exitosamente', 'success');
            
            // NUEVO: Notificar eliminación a otras páginas
            localStorage.setItem('admin_products_updated', Date.now().toString());
            
            // NUEVO: Broadcast del cambio para comunicación inmediata
            const event = new CustomEvent('adminProductsUpdated', {
                detail: { action: 'deleted', productId: productId }
            });
            window.dispatchEvent(event);
        } else {
            showNotification('Error al eliminar producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al conectar con el servidor', 'error');
    }
}

// Appointments Management
async function loadAppointments() {
    try {
        const response = await fetch(`${API_BASE}/admin/appointments`);
        const appointments = await response.json();
        
        // Ordenar por fecha más reciente primero
        allAppointments = appointments.sort((a, b) => {
            const dateA = new Date(a.date + ' ' + a.time);
            const dateB = new Date(b.date + ' ' + b.time);
            return dateB - dateA;
        });
        
        renderAppointments(allAppointments);
    } catch (error) {
        console.error('Error loading appointments:', error);
        appointmentsList.innerHTML = '<div class="error">Error al cargar citas</div>';
    }
}

function renderAppointments(appointments) {
    if (appointments.length === 0) {
        appointmentsList.innerHTML = '<div class="empty-state">No hay citas registradas</div>';
        return;
    }

    appointmentsList.innerHTML = appointments.map(appointment => `
        <div class="appointment-card ${appointment.status}">
            <div class="appointment-header">
                <div class="appointment-info">
                    <h3>${appointment.User ? appointment.User.name : `Usuario ${appointment.user_id}`}</h3>
                    <div class="appointment-datetime">
                        <i class="fas fa-calendar"></i> ${formatDate(appointment.date)} 
                        <i class="fas fa-clock"></i> ${appointment.time}
                    </div>
                    <div class="appointment-reason">
                        <i class="fas fa-clipboard"></i> ${getReasonText(appointment.reason)}
                    </div>
                    ${appointment.notes ? `
                        <div class="appointment-notes">
                            <i class="fas fa-note-sticky"></i> ${appointment.notes}
                        </div>
                    ` : ''}
                </div>
                <div class="appointment-meta">
                    <span class="appointment-status status-${appointment.status}">
                        ${getStatusText(appointment.status)}
                    </span>
                </div>
            </div>
            <div class="appointment-actions">
                ${appointment.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="updateAppointmentStatus(${appointment.id}, 'confirmed')">
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="updateAppointmentStatus(${appointment.id}, 'attended')">
                        <i class="fas fa-user-check"></i> Marcar Atendida
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus(${appointment.id}, 'cancelled')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                ` : appointment.status === 'confirmed' ? `
                    <button class="btn btn-sm btn-success" onclick="updateAppointmentStatus(${appointment.id}, 'attended')">
                        <i class="fas fa-user-check"></i> Marcar como Atendida
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="updateAppointmentStatus(${appointment.id}, 'cancelled')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                ` : appointment.status === 'attended' ? `
                    <button class="btn btn-sm btn-warning" onclick="updateAppointmentStatus(${appointment.id}, 'pending')">
                        <i class="fas fa-undo"></i> Marcar como Pendiente
                    </button>
                ` : `
                    <button class="btn btn-sm btn-warning" onclick="updateAppointmentStatus(${appointment.id}, 'pending')">
                        <i class="fas fa-undo"></i> Reactivar
                    </button>
                `}
            </div>
        </div>
    `).join('');
}

function filterAppointments() {
    const statusFilter = appointmentFilter.value;
    const dateFilter = appointmentDateFilter.value;
    
    let filteredAppointments = allAppointments.filter(appointment => {
        // Filtro por estado
        const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
        
        // Filtro por fecha
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const appointmentDate = new Date(appointment.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            switch (dateFilter) {
                case 'today':
                    const todayStr = today.toISOString().split('T')[0];
                    matchesDate = appointment.date === todayStr;
                    break;
                case 'tomorrow':
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    matchesDate = appointment.date === tomorrowStr;
                    break;
                case 'week':
                    const weekFromNow = new Date(today);
                    weekFromNow.setDate(weekFromNow.getDate() + 7);
                    matchesDate = appointmentDate >= today && appointmentDate <= weekFromNow;
                    break;
                case 'month':
                    const monthFromNow = new Date(today);
                    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
                    matchesDate = appointmentDate >= today && appointmentDate <= monthFromNow;
                    break;
            }
        }
        
        return matchesStatus && matchesDate;
    });
    
    renderAppointments(filteredAppointments);
}

// Invoices Management
async function loadInvoices() {
    try {
        const response = await fetch(`${API_BASE}/admin/invoices`);
        const invoices = await response.json();
        
        // Ordenar por fecha más reciente primero
        allInvoices = invoices.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        renderInvoices(allInvoices);
    } catch (error) {
        console.error('Error loading invoices:', error);
        invoicesList.innerHTML = '<div class="error">Error al cargar facturas</div>';
    }
}

function renderInvoices(invoices) {
    if (invoices.length === 0) {
        invoicesList.innerHTML = '<div class="empty-state">No hay facturas registradas</div>';
        return;
    }

    invoicesList.innerHTML = invoices.map(invoice => `
        <div class="invoice-card">
            <div class="invoice-header">
                <div class="invoice-info">
                    <div class="invoice-number">Factura #${invoice.id}</div>
                    <div class="invoice-date">${formatDate(invoice.created_at)}</div>
                    <div class="invoice-customer">
                        <i class="fas fa-user"></i> 
                        <strong>${invoice.User ? invoice.User.name : 'Usuario desconocido'}</strong>
                        ${invoice.User ? `
                            <div class="customer-details">
                                <small><i class="fas fa-phone"></i> ${invoice.User.phone || 'Sin teléfono'}</small>
                                <small><i class="fas fa-envelope"></i> ${invoice.User.email || 'Sin email'}</small>
                                <small><i class="fas fa-map-marker-alt"></i> ${invoice.User.address || 'Sin dirección'}</small>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="invoice-total">$${parseFloat(invoice.total).toFixed(2)}</div>
            </div>
            <div class="invoice-status-section">
                <span class="invoice-status status-${invoice.status}">
                    ${getInvoiceStatusText(invoice.status)}
                </span>
            </div>
            <div class="invoice-items">
                <h4>Productos (${invoice.items ? invoice.items.length : 0} items):</h4>
                ${invoice.items && invoice.items.length > 0 ? invoice.items.map(item => `
                    <div class="invoice-item">
                        <span class="item-name">${item.product_name}</span>
                        <span class="item-details">
                            ${item.color ? `Color: ${item.color}` : ''} 
                            ${item.size ? `Talla: ${item.size}` : ''} 
                            x${item.quantity}
                        </span>
                        <span class="item-price">$${parseFloat(item.total || (item.price * item.quantity)).toFixed(2)}</span>
                    </div>
                `).join('') : '<div class="no-items">Sin productos</div>'}
            </div>
            <div class="invoice-actions">
                ${invoice.status === 'pending' ? `
                    <button class="btn btn-sm btn-success" onclick="updateInvoiceStatus(${invoice.id}, 'completed')" title="Marcar como completada">
                        <i class="fas fa-check"></i> Completar
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="updateInvoiceStatus(${invoice.id}, 'paid')" title="Marcar como pagada">
                        <i class="fas fa-money-bill"></i> Pagada
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="updateInvoiceStatus(${invoice.id}, 'cancelled')" title="Cancelar factura">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                ` : invoice.status === 'paid' ? `
                    <button class="btn btn-sm btn-success" onclick="updateInvoiceStatus(${invoice.id}, 'completed')" title="Marcar como completada">
                        <i class="fas fa-check"></i> Completar
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="updateInvoiceStatus(${invoice.id}, 'pending')" title="Volver a pendiente">
                        <i class="fas fa-undo"></i> Pendiente
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="updateInvoiceStatus(${invoice.id}, 'cancelled')" title="Cancelar factura">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                ` : invoice.status === 'completed' ? `
                    <button class="btn btn-sm btn-info" onclick="updateInvoiceStatus(${invoice.id}, 'paid')" title="Marcar como pagada">
                        <i class="fas fa-money-bill"></i> Pagada
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="updateInvoiceStatus(${invoice.id}, 'pending')" title="Volver a pendiente">
                        <i class="fas fa-undo"></i> Pendiente
                    </button>
                ` : `
                    <button class="btn btn-sm btn-secondary" onclick="updateInvoiceStatus(${invoice.id}, 'pending')" title="Reactivar factura">
                        <i class="fas fa-undo"></i> Reactivar
                    </button>
                `}
            </div>
        </div>
    `).join('');
}

// AGREGAR: Función para actualizar estado de factura
async function updateInvoiceStatus(invoiceId, newStatus) {
    // Removed confirmation dialog for immediate action
    try {
        const response = await fetch(`${API_BASE}/admin/invoices/${invoiceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            loadInvoices();
            
            // NUEVO: Mostrar mensajes específicos según el cambio de estado
            let message = `Factura ${getInvoiceStatusText(newStatus).toLowerCase()} exitosamente`;
            if (newStatus === 'cancelled') {
                message += ' - Stock restaurado automáticamente';
            } else if (newStatus === 'pending' || newStatus === 'paid' || newStatus === 'completed') {
                message += ' - Stock actualizado si es necesario';
            }
            
            showNotification(message, 'success');
            
            // NUEVO: Recargar productos para mostrar cambios de stock actualizados
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            if (activeTab === 'products') {
                loadProducts();
            }
            
            // NUEVO: Notificar cambio de facturas a otras páginas
            localStorage.setItem('admin_invoices_updated', Date.now().toString());
            localStorage.setItem('admin_products_updated', Date.now().toString()); // También notificar cambios de productos
            
            // NUEVO: Broadcast del cambio para comunicación inmediata
            const event = new CustomEvent('adminInvoicesUpdated', {
                detail: { action: 'status_updated', invoiceId: invoiceId, newStatus: newStatus }
            });
            window.dispatchEvent(event);
            
            // NUEVO: Broadcast cambios de productos también
            const productEvent = new CustomEvent('adminProductsUpdated', {
                detail: { action: 'stock_updated', reason: 'invoice_status_change' }
            });
            window.dispatchEvent(productEvent);
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error al actualizar estado de la factura', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al conectar con el servidor', 'error');
    }
}

// AGREGAR: Función para obtener texto de estado de factura
function getInvoiceStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'paid': 'Pagada',
        'completed': 'Completada',
        'cancelled': 'Cancelada'
    };
    return statusMap[status] || status;
}

// Add missing function for filtering invoices
function filterInvoices() {
    const statusFilter = invoiceStatusFilter.value;
    
    let filteredInvoices = allInvoices.filter(invoice => {
        return statusFilter === 'all' || invoice.status === statusFilter;
    });
    
    renderInvoices(filteredInvoices);
}

// Función para actualizar estado de cita
async function updateAppointmentStatus(appointmentId, newStatus) {
    // Removed confirmation dialog for immediate action
    try {
        const response = await fetch(`${API_BASE}/admin/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            loadAppointments();
            showNotification(`Cita ${getStatusText(newStatus).toLowerCase()} exitosamente`, 'success');
            
            // Notify appointment changes to other pages
            localStorage.setItem('admin_appointments_updated', Date.now().toString());
        } else {
            showNotification('Error al actualizar estado de la cita', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al conectar con el servidor', 'error');
    }
}

// Admin Management Functions
function openAddAdminModal() {
    console.log('🎯 openAddAdminModal() llamada');
    console.log('adminModal:', adminModal);
    console.log('adminForm:', adminForm);
    
    currentEditingAdmin = null;
    
    // Verificar que el modal existe antes de proceder
    if (!adminModal) {
        console.error('❌ adminModal no encontrado, intentando obtenerlo nuevamente');
        adminModal = document.getElementById('adminModal');
        if (!adminModal) {
            console.error('❌ No se pudo encontrar el modal de admin');
            showNotification('Error: Modal de admin no encontrado', 'error');
            return;
        }
    }
    
    // Verificar que el formulario existe
    if (!adminForm) {
        console.error('❌ adminForm no encontrado, intentando obtenerlo nuevamente');
        adminForm = document.getElementById('adminForm');
        if (!adminForm) {
            console.error('❌ No se pudo encontrar el formulario de admin');
            showNotification('Error: Formulario de admin no encontrado', 'error');
            return;
        }
    }
    
    // Verificar que el título del modal existe
    const adminModalTitle = document.getElementById('adminModalTitle');
    if (adminModalTitle) {
        adminModalTitle.textContent = 'Agregar Admin';
        console.log('✅ Título del modal actualizado');
    } else {
        console.error('❌ adminModalTitle no encontrado');
    }
    
    // Reset del formulario
    try {
        adminForm.reset();
        console.log('✅ Formulario reseteado');
    } catch (error) {
        console.error('❌ Error al resetear formulario:', error);
    }
    
    // Show/hide superadmin option based on current user permission
    const superadminOption = document.getElementById('superadminOption');
    if (superadminOption) {
        if (currentUserPermission === 'superadmin') {
            superadminOption.style.display = 'block';
        } else {
            superadminOption.style.display = 'none';
        }
        console.log('✅ Opciones de superadmin configuradas');
    } else {
        console.log('⚠️ superadminOption no encontrado (normal si no existe en HTML)');
    }
    
    // Mostrar el modal
    try {
        adminModal.classList.add('show');
        document.body.classList.add('modal-open');
        console.log('✅ Modal de admin mostrado exitosamente');
        
        // Enfocar el primer campo del formulario
        setTimeout(() => {
            const firstInput = adminForm.querySelector('input');
            if (firstInput) {
                firstInput.focus();
                console.log('✅ Primer campo enfocado');
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Error al mostrar modal:', error);
        showNotification('Error al abrir modal de admin', 'error');
    }
}

function closeAdminModal() {
    adminModal.classList.remove('show');
    document.body.classList.remove('modal-open');
    currentEditingAdmin = null;
    adminForm.reset();
}

async function handleAdminSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(adminForm);
    const telegramId = parseInt(formData.get('telegram_id'));
    
    // VALIDAR: Verificar que el usuario esté registrado en el bot
    if (!telegramId || isNaN(telegramId)) {
        showNotification('El ID de Telegram debe ser un número válido', 'error');
        return;
    }
    
    // NUEVO: Mostrar pantalla de carga
    showLoadingModal('Verificando usuario y creando administrador...');
    
    try {
        // Primero verificar si el usuario existe en la base de datos
        console.log('Verificando si el usuario existe:', telegramId);
        const userCheckResponse = await fetch(`${API_BASE}/users/${telegramId}`);
        
        if (!userCheckResponse.ok) {
            hideLoadingModal();
            showNotification(`El usuario con ID ${telegramId} no está registrado en el bot. El usuario debe usar el bot primero para registrarse.`, 'error');
            return;
        }
        
        const userData = await userCheckResponse.json();
        console.log('Usuario encontrado:', userData);
        
        // Preparar datos del admin - CORREGIDO: solo admin regular, sin campo permission
        const adminData = {
            local: formData.get('local'),
            role: formData.get('role'),
            telegram_id: telegramId
            // permission eliminado - todos serán admin regulares
        };

        const url = currentEditingAdmin 
            ? `${API_BASE}/admin/admins/${currentEditingAdmin.id}`
            : `${API_BASE}/admin/admins`;
        
        const method = currentEditingAdmin ? 'PUT' : 'POST';
        
        console.log(`${method} admin:`, adminData);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(adminData)
        });

        const responseData = await response.json();
        console.log('Respuesta del servidor:', responseData);

        hideLoadingModal();

        if (response.ok) {
            closeAdminModal();
            await loadAdmins();
            
            const action = currentEditingAdmin ? 'actualizado' : 'creado';
            showSuccessAlert(`Admin ${action} exitosamente`, `El usuario ${userData.name} ahora tiene permisos de administrador.`);
        } else {
            const error = responseData.error || 'Error al guardar admin';
            console.error('Error del servidor:', error);
            showErrorAlert('Error al guardar admin', error);
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        hideLoadingModal();
        showErrorAlert('Error de conexión', 'No se pudo conectar con el servidor. Por favor, intenta nuevamente.');
    }
}

async function loadAdmins() {
    try {
        console.log('Admin: Cargando admins...');
        
        if (adminsList) {
            adminsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando admins...</div>';
        }
        
        const response = await fetch(`${API_BASE}/admin/admins`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const admins = await response.json();
        console.log(`Admin: ${admins.length} admins cargados`);
        
        allAdmins = admins;
        renderAdmins(admins);
        
    } catch (error) {
        console.error('Error loading admins:', error);
        if (adminsList) {
            adminsList.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar admins: ${error.message}</p>
                    <button onclick="loadAdmins()" class="btn btn-primary">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>
            `;
        }
        showNotification('Error al cargar admins', 'error');
    }
}

function renderAdmins(admins) {
    if (admins.length === 0) {
        adminsList.innerHTML = '<div class="empty-state"><i class="fas fa-users-cog"></i><br>No hay admins registrados</div>';
        return;
    }

    adminsList.innerHTML = admins.map(admin => `
        <div class="admin-card ${admin.is_hardcoded ? 'admin-hardcoded' : ''}">
            <div class="admin-role-badge ${admin.permission === 'superadmin' ? 'role-superadmin' : 'role-admin'}">
                ${admin.permission === 'superadmin' ? 'Super Admin' : 'Admin'}
                ${admin.is_hardcoded ? '<i class="fas fa-lock" title="Administrador del sistema"></i>' : ''}
            </div>
            <div class="admin-header">
                <div class="admin-info">
                    <div class="admin-name">
                        <i class="fas fa-user"></i> ${admin.username}
                        ${admin.is_hardcoded ? '<span class="hardcoded-badge">Sistema</span>' : ''}
                    </div>
                    <div class="admin-role">${admin.role}</div>
                    <div class="admin-local">
                        <i class="fas fa-store"></i> ${admin.local}
                    </div>
                    <div class="admin-telegram">
                        <i class="fab fa-telegram"></i> ID: ${admin.telegram_id}
                    </div>
                    ${admin.is_hardcoded ? `
                        <div class="admin-system-note">
                            <i class="fas fa-info-circle"></i> Administrador del sistema (no se puede eliminar)
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="admin-actions">
                ${!admin.is_hardcoded && currentUserPermission === 'superadmin' ? `
                    <button class="btn btn-sm btn-warning" onclick="openEditAdminModal(${JSON.stringify(admin).replace(/"/g, '&quot;')})" title="Editar admin">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAdmin(${admin.id}, '${admin.username}')" title="Eliminar admin">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                ` : admin.is_hardcoded ? `
                    <div class="admin-info-text">
                        <small><i class="fas fa-shield-alt"></i> Administrador protegido del sistema</small>
                    </div>
                ` : `
                    <div class="admin-info-text">
                        <small><i class="fas fa-info-circle"></i> Solo los Super Admins pueden gestionar administradores</small>
                    </div>
                `}
            </div>
        </div>
    `).join('');
}

// NUEVO: Función para abrir modal de edición de admin
function openEditAdminModal(admin) {
    if (admin.is_hardcoded) {
        showNotification('No se pueden editar administradores del sistema', 'error');
        return;
    }
    
    currentEditingAdmin = admin;
    document.getElementById('adminModalTitle').textContent = 'Editar Admin';
    
    // Llenar formulario con datos del admin - CORREGIDO: sin campo de permisos
    document.getElementById('adminTelegramId').value = admin.telegram_id || '';
    document.getElementById('adminLocal').value = admin.local || '';
    document.getElementById('adminRole').value = admin.role || '';
    
    adminModal.classList.add('show');
    document.body.classList.add('modal-open');
}

// MEJORAR: Función para eliminar admin con verificaciones adicionales
async function deleteAdmin(adminId, adminUsername) {
    if (currentUserPermission !== 'superadmin') {
        showNotification('Solo los Super Admins pueden eliminar administradores', 'error');
        return;
    }

    // Verificar si es admin hardcodeado
    const admin = allAdmins.find(a => a.id === adminId);
    if (admin && admin.is_hardcoded) {
        showNotification('No se pueden eliminar administradores del sistema', 'error');
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar al admin "${adminUsername}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/admins/${adminId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadAdmins();
            showNotification('Admin eliminado exitosamente', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error al eliminar admin', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al conectar con el servidor', 'error');
    }
}

// Function to check and set current user permissions (this would be called during initialization)
function setCurrentUserPermission(permission) {
    currentUserPermission = permission;
    
    // Update UI based on permissions
    const superadminOption = document.getElementById('superadminOption');
    if (permission === 'superadmin') {
        superadminOption.style.display = 'block';
    } else {
        superadminOption.style.display = 'none';
    }
    
    // Refresh admin list if it's already loaded to update delete buttons
    if (allAdmins.length > 0) {
        renderAdmins(allAdmins);
    }
}

// NUEVO: Función para verificar acceso de administrador
async function verifyAdminAccess() {
    try {
        console.log('=== INICIANDO VERIFICACIÓN DE ADMIN ===');
        
        // Obtener ID de usuario de Telegram WebApp con más debugging
        const tg = window.Telegram?.WebApp;
        let userId = null;
        
        console.log('Telegram WebApp disponible:', !!tg);
        console.log('URL actual:', window.location.href);
        console.log('Hostname:', window.location.hostname);
        
        // MEJORADO: Múltiples métodos para obtener el user ID
        if (tg) {
            console.log('initDataUnsafe:', tg.initDataUnsafe);
            console.log('initData (raw):', tg.initData);
            
            // Método 1: initDataUnsafe.user
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                userId = tg.initDataUnsafe.user.id;
                console.log('✓ Usuario obtenido de initDataUnsafe.user:', userId);
            }
            // Método 2: Parsear initData manualmente
            else if (tg.initData) {
                try {
                    const urlParams = new URLSearchParams(tg.initData);
                    const userParam = urlParams.get('user');
                    if (userParam) {
                        const userData = JSON.parse(decodeURIComponent(userParam));
                        userId = userData.id;
                        console.log('✓ Usuario obtenido de initData parseado:', userId);
                    }
                } catch (e) {
                    console.log('Error parseando initData:', e.message);
                }
            }
        }
        
        // Método 3: Parámetros de URL como fallback
        if (!userId) {
            const urlParams = new URLSearchParams(window.location.search);
            const userIdFromUrl = urlParams.get('user_id') || 
                                urlParams.get('tgWebAppStartParam') ||
                                urlParams.get('start_param');
            
            if (userIdFromUrl) {
                userId = parseInt(userIdFromUrl);
                console.log('✓ Usuario obtenido de URL params:', userId);
            }
        }
        
        // Método 4: Hash de URL (caso especial de Telegram)
        if (!userId && window.location.hash) {
            try {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const userIdFromHash = hashParams.get('user_id') || hashParams.get('tgWebAppStartParam');
                if (userIdFromHash) {
                    userId = parseInt(userIdFromHash);
                    console.log('✓ Usuario obtenido de hash URL:', userId);
                }
            } catch (e) {
                console.log('Error parseando hash URL:', e.message);
            }
        }
        
        // Método 5: localStorage como backup (si se guardó previamente)
        if (!userId) {
            const storedUserId = localStorage.getItem('telegram_user_id');
            if (storedUserId) {
                userId = parseInt(storedUserId);
                console.log('✓ Usuario obtenido de localStorage:', userId);
            }
        }
        
        // Método 6: En modo desarrollo o localhost
        if (!userId && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            userId = 1870169979; // ID de superadmin para pruebas
            console.log('✓ Modo desarrollo detectado, usando ID de prueba:', userId);
        }
        
        // Método 7: Prompt al usuario como último recurso (solo en desarrollo)
        if (!userId && window.location.hostname === 'localhost') {
            const promptUserId = prompt('ID de Telegram para pruebas:');
            if (promptUserId && !isNaN(promptUserId)) {
                userId = parseInt(promptUserId);
                console.log('✓ Usuario obtenido de prompt:', userId);
                // Guardar para la próxima vez
                localStorage.setItem('telegram_user_id', userId.toString());
            }
        }
        
        if (!userId) {
            console.error('❌ No se pudo obtener ID de usuario de ninguna fuente');
            console.log('Sources checked:');
            console.log('- Telegram WebApp initDataUnsafe:', tg?.initDataUnsafe);
            console.log('- Telegram WebApp initData:', tg?.initData);
            console.log('- URL search params:', window.location.search);
            console.log('- URL hash:', window.location.hash);
            console.log('- localStorage telegram_user_id:', localStorage.getItem('telegram_user_id'));
            throw new Error('No se pudo obtener ID de usuario. Asegúrate de abrir desde Telegram.');
        }
        
        // Guardar el ID de usuario para futuras referencias
        localStorage.setItem('telegram_user_id', userId.toString());
        
        console.log('🔍 Verificando permisos para usuario:', userId);
        
        // MEJORADO: Verificar en el servidor si el usuario es admin con más logging
        const response = await fetch(`${API_BASE}/admin/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ telegram_id: userId })
        });
        
        console.log('Respuesta del servidor - Status:', response.status);
        console.log('Respuesta del servidor - Headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
            console.error('❌ Error del servidor:', errorData);
            throw new Error(errorData.error || 'Usuario no autorizado');
        }
        
        const result = await response.json();
        console.log('✓ Respuesta del servidor:', result);
        
        if (!result.isAdmin) {
            console.error('❌ Usuario sin permisos de admin');
            throw new Error('No tienes permisos de administrador');
        }
        
        isAdminVerified = true;
        currentUserPermission = result.isSuperAdmin ? 'superadmin' : 'admin';
        
        console.log('✅ Admin verificado exitosamente!');
        console.log('- Es Admin:', result.isAdmin);
        console.log('- Es SuperAdmin:', result.isSuperAdmin);
        console.log('- Fuente:', result.source);
        console.log('- Permiso asignado:', currentUserPermission);
        
        return result;
        
    } catch (error) {
        console.error('💥 ERROR EN VERIFICACIÓN:', error);
        console.log('Stack trace:', error.stack);
        isAdminVerified = false;
        throw error;
    }
}

// NUEVO: Función para mostrar modal de carga
function showLoadingModal(message) {
    const loadingModal = document.createElement('div');
    loadingModal.id = 'loadingModal';
    loadingModal.className = 'loading-modal';
    loadingModal.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(loadingModal);
    
    // Agregar estilos si no existen
    if (!document.getElementById('loadingModalStyles')) {
        const styles = document.createElement('style');
        styles.id = 'loadingModalStyles';
        styles.textContent = `
            .loading-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(3px);
            }
            .loading-content {
                background: white;
                padding: 30px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 300px;
            }
            .loading-spinner {
                font-size: 2rem;
                color: #3498db;
                margin-bottom: 15px;
            }
            .loading-content p {
                margin: 0;
                color: #333;
                font-weight: 500;
            }
        `;
        document.head.appendChild(styles);
    }
}

// NUEVO: Función para ocultar modal de carga
function hideLoadingModal() {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.remove();
    }
}

// NUEVO: Función para mostrar alerta de éxito
function showSuccessAlert(title, message) {
    const alert = document.createElement('div');
    alert.className = 'custom-alert success-alert';
    alert.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <div class="alert-text">
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    // Auto eliminar después de 5 segundos
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
    
    // Agregar estilos si no existen
    addAlertStyles();
}

// NUEVO: Función para mostrar alerta de error
function showErrorAlert(title, message) {
    const alert = document.createElement('div');
    alert.className = 'custom-alert error-alert';
    alert.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="alert-text">
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    // Auto eliminar después de 7 segundos (más tiempo para errores)
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 7000);
    
    addAlertStyles();
}

// NUEVO: Función para agregar estilos de alertas
function addAlertStyles() {
    if (!document.getElementById('alertStyles')) {
        const styles = document.createElement('style');
        styles.id = 'alertStyles';
        styles.textContent = `
            .custom-alert {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 300px;
                max-width: 400px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease-out;
            }
            .success-alert {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            .error-alert {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            .alert-content {
                display: flex;
                align-items: flex-start;
                padding: 15px;
                gap: 12px;
            }
            .alert-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }
            .success-alert .alert-icon {
                color: #28a745;
            }
            .error-alert .alert-icon {
                color: #dc3545;
            }
            .alert-text {
                flex: 1;
            }
            .alert-text h3 {
                margin: 0 0 5px 0;
                font-size: 1rem;
                font-weight: 600;
            }
            .alert-text p {
                margin: 0;
                font-size: 0.9rem;
                opacity: 0.8;
            }
            .alert-close {
                background: none;
                border: none;
                font-size: 1rem;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }
            .alert-close:hover {
                opacity: 1;
            }
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Utility Functions
function formatDate(dateString) {
    // CORREGIR: Formatear fecha sin problemas de zona horaria
    if (!dateString) return 'Fecha no disponible';
    
    // Si ya es un objeto Date válido, usarlo directamente
    if (dateString instanceof Date) {
        return dateString.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // Si es string de fecha en formato YYYY-MM-DD, parsearlo manualmente
    if (typeof dateString === 'string' && dateString.includes('-')) {
        const dateParts = dateString.split('T')[0].split('-'); // Tomar solo la parte de fecha
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        
        const date = new Date(year, month, day);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // Fallback para otros formatos
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch (e) {
        console.warn('Error parseando fecha:', dateString, e);
    }
    
    return dateString; // Devolver el string original si no se puede parsear
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'confirmed': 'Confirmada',
        'attended': 'Atendida',
        'cancelled': 'Cancelada'
    };
    return statusMap[status] || status;
}

function getReasonText(reason) {
    const reasonMap = {
        'consultation': 'Consulta',
        'fitting': 'Prueba de ropa',
        'pickup': 'Recoger pedido',
        'return': 'Devolución',
        'other': 'Otro'
    };
    return reasonMap[reason] || reason;
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
    
    // Add styles if they don't exist
    if (!document.getElementById('notificationStyles')) {
        const styles = document.createElement('style');
        styles.id = 'notificationStyles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                min-width: 300px;
                max-width: 400px;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease-out;
            }
            .notification-success {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            .notification-error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            .notification-info {
                background: #d1ecf1;
                border: 1px solid #bee5eb;
                color: #0c5460;
            }
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 10px;
            }
            .notification-message {
                flex: 1;
                font-weight: 500;
            }
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }
            .notification-close:hover {
                opacity: 1;
            }
        `;
        document.head.appendChild(styles);
    }
}