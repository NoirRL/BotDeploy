// Variables globales
let products = [];
let filteredProducts = [];
let cart = [];
let currentProduct = null;
const API_BASE = window.location.origin + '/api';

// MEJORAR: Inicialización de Telegram WebApp con validación
const tg = window.Telegram?.WebApp;
let telegramInitialized = false;

function initializeTelegram() {
    if (tg) {
        console.log('Telegram WebApp detected, initializing...');
        tg.ready();
        tg.expand();
        telegramInitialized = true;
        
        // Configuraciones específicas de Telegram
        tg.MainButton.hide();
        tg.BackButton.hide();
        
        console.log('Telegram WebApp initialized successfully');
        console.log('User data:', tg.initDataUnsafe?.user);
    } else {
        console.warn('Telegram WebApp not available - running in browser mode');
        telegramInitialized = false;
    }
}

// Inicializar Telegram inmediatamente
initializeTelegram();

// Función mejorada para obtener el user_id correcto
function getUserId() {
    // Prioridad 1: Datos de Telegram WebApp
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const userId = tg.initDataUnsafe.user.id;
        console.log('User ID obtenido de Telegram WebApp:', userId);
        return userId;
    }
    
    // Prioridad 2: URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('user_id')) {
        const userId = urlParams.get('user_id');
        console.log('User ID obtenido de URL params:', userId);
        return parseInt(userId);
    }
    
    // Prioridad 3: localStorage como fallback
    const storedUserId = localStorage.getItem('telegram_user_id');
    if (storedUserId) {
        console.log('User ID obtenido de localStorage:', storedUserId);
        return parseInt(storedUserId);
    }
    
    // Si no hay user_id disponible
    console.warn('No se pudo obtener user_id de ninguna fuente');
    return null;
}

// DOM Elements - Verificación mejorada
const productsGrid = document.getElementById('productsGrid');
const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartSidebar = document.getElementById('cartSidebar');
const closeCart = document.getElementById('closeCart');
const cartContent = document.getElementById('cartContent');
const cartFooter = document.getElementById('cartFooter');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const overlay = document.getElementById('overlay');

// Product Modal Elements
const productModal = document.getElementById('productModal');
const closeModal = document.getElementById('closeModal');
const modalProductName = document.getElementById('modalProductName');
const modalProductBrand = document.getElementById('modalProductBrand');
const modalProductPrice = document.getElementById('modalProductPrice');
const modalProductDescription = document.getElementById('modalProductDescription');
const modalProductStock = document.getElementById('modalProductStock');
const modalProductImage = document.getElementById('modalProductImage');
const modalImagePlaceholder = document.getElementById('modalImagePlaceholder');
const quantityInput = document.getElementById('quantity');
const decreaseQtyBtn = document.getElementById('decreaseQty');
const increaseQtyBtn = document.getElementById('increaseQty');
const addToCartBtn = document.getElementById('addToCartBtn');
const colorSelection = document.getElementById('colorSelection');
const sizeSelection = document.getElementById('sizeSelection');
const colorOptions = document.getElementById('colorOptions');
const sizeOptions = document.getElementById('sizeOptions');

// Invoices Modal Elements
const invoicesBtn = document.getElementById('invoicesBtn');
const invoicesModal = document.getElementById('invoicesModal');
const closeInvoicesModal = document.getElementById('closeInvoicesModal');
const invoicesList = document.getElementById('invoicesList');

// Botón flotante
const scrollToTopBtn = document.getElementById('scrollToTopBtn');

// MEJORAR: Verificación de conexión
async function checkConnection() {
    try {
        console.log('Verificando conexión con el servidor...');
        const response = await fetch(`${API_BASE}/products/count`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Conexión exitosa. Productos disponibles:', data.count);
        return true;
    } catch (error) {
        console.error('Error de conexión:', error);
        console.error('URL intentada:', `${API_BASE}/products/count`);
        console.error('Origin actual:', window.location.origin);
        return false;
    }
}

// Inicialización mejorada
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM cargado, inicializando aplicación...');
    console.log('URL actual:', window.location.href);
    console.log('API Base:', API_BASE);
    
    // AGREGAR: Verificar conexión primero
    const connectionOk = await checkConnection();
    if (!connectionOk) {
        showMessage('Error de conexión con el servidor. Verifica tu conexión de red.', 'error');
        
        // Mostrar mensaje de diagnóstico
        if (productsGrid) {
            productsGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error de Conexión</h3>
                    <p>No se puede conectar con el servidor</p>
                    <div style="font-size: 0.9rem; color: #666; margin-top: 1rem;">
                        <p><strong>URL del servidor:</strong> ${API_BASE}</p>
                        <p><strong>Navegador:</strong> ${navigator.userAgent}</p>
                        <p><strong>Telegram:</strong> ${telegramInitialized ? 'Sí' : 'No'}</p>
                    </div>
                    <button onclick="location.reload()" class="btn btn-primary retry-btn">
                        <i class="fas fa-redo"></i> Recargar Página
                    </button>
                </div>
            `;
        }
        return;
    }
    
    // Verificar elementos críticos
    const criticalElements = {
        productsGrid,
        categoryFilter,
        searchInput,
        cartBtn,
        overlay
    };
    
    const missingElements = Object.entries(criticalElements)
        .filter(([name, element]) => !element)
        .map(([name]) => name);
    
    if (missingElements.length > 0) {
        console.error('Elementos DOM faltantes:', missingElements);
        showMessage('Error: Elementos de la página no encontrados', 'error');
        return;
    }
    
    setupEventListeners();
    loadCart();
    loadProducts();
    
    // AGREGAR: Sincronización automática con admin MEJORADA
    // Recargar productos cada 30 segundos
    setInterval(() => {
        console.log('Sincronización automática: verificando productos...');
        loadProducts(true); // Pasar true para indicar que es recarga automática
    }, 30000);
    
    // AGREGAR: Detectar cambios usando localStorage como canal de comunicación
    window.addEventListener('storage', function(e) {
        if (e.key === 'admin_products_updated') {
            console.log('Detectado cambio en productos desde admin, recargando...');
            loadProducts(true);
            // Limpiar la señal
            localStorage.removeItem('admin_products_updated');
        }
    });
    
    // AGREGAR: Detectar cuando regresamos a la pestaña/ventana
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('Webapp catalog visible: recargando datos...');
            loadProducts(true);
            loadCart();
        }
    });
});

// Función corregida de carga de productos
async function loadProducts(isAutoReload = false) {
    console.log('Iniciando carga de productos...', isAutoReload ? '(recarga automática)' : '');
    
    if (!productsGrid) {
        console.error('productsGrid no encontrado');
        return;
    }
    
    try {
        // Solo mostrar loading si no es recarga automática
        if (!isAutoReload) {
            productsGrid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</div>';
        }
        
        const response = await fetch(`${API_BASE}/products`);
        console.log('Respuesta del servidor:', response.status);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('Datos recibidos:', responseData);
        
        // Validar que es un array
        if (Array.isArray(responseData)) {
            // Solo actualizar si realmente hay cambios (para evitar parpadeo)
            if (isAutoReload && JSON.stringify(products) === JSON.stringify(responseData)) {
                console.log('No hay cambios en productos, manteniendo interfaz actual');
                return;
            }
            
            products = responseData;
        } else {
            console.error('Formato de respuesta inesperado:', responseData);
            throw new Error('Formato de respuesta inválido del servidor');
        }
        
        filteredProducts = [...products];
        
        console.log(`${products.length} productos cargados exitosamente`);
        
        renderProducts();
        populateCategories();
        
    } catch (error) {
        console.error('Error loading products:', error);
        // Solo mostrar error en UI si no es recarga automática
        if (!isAutoReload) {
            productsGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error al cargar productos</h3>
                    <p>${error.message}</p>
                    <button onclick="loadProducts()" class="btn btn-primary retry-btn">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>
            `;
            showMessage('Error al cargar productos. Verifica tu conexión.', 'error');
        } else {
            console.log('Error en recarga automática, ignorando para no molestar al usuario');
        }
    }
}

function populateCategories() {
    if (!categoryFilter) return;
    
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(option);
    });
}

// AGREGAR: Función de filtrado de productos que faltaba
function filterProducts() {
    if (!products || products.length === 0) {
        console.log('No hay productos para filtrar');
        return;
    }

    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const selectedCategory = categoryFilter?.value || '';

    filteredProducts = products.filter(product => {
        const matchesSearch = !searchTerm || 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.brand && product.brand.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !selectedCategory || product.category === selectedCategory;
        
        return matchesSearch && matchesCategory;
    });

    console.log(`Filtrados ${filteredProducts.length} productos de ${products.length}`);
    renderProducts();
}

// Función mejorada de renderizado de productos
function renderProducts() {
    if (!productsGrid) return;
    
    console.log(`Renderizando ${filteredProducts.length} productos`);
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No se encontraron productos</h3>
                <p>Intenta cambiar los filtros de búsqueda</p>
            </div>
        `;
        return;
    }
    
    const productsHTML = filteredProducts.map(product => `
        <div class="product-card" onclick="openProductModal(${product.id})">
            <div class="product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" 
                         onerror="this.style.display='none'; this.parentNode.querySelector('.image-placeholder').style.display='flex';"
                         onload="this.parentNode.querySelector('.image-placeholder').style.display='none';">
                     <div class="image-placeholder" style="display: flex;">
                        <i class="fas fa-image"></i>
                     </div>` :
                    `<div class="image-placeholder">
                        <i class="fas fa-image"></i>
                     </div>`
                }
                ${product.stock <= 0 ? '<div class="stock-badge out-of-stock">Agotado</div>' : 
                  product.stock <= 5 ? '<div class="stock-badge low-stock">Pocas unidades</div>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                ${product.brand ? `<p class="product-brand">${product.brand}</p>` : ''}
                <div class="product-price-section">
                    <span class="product-price">$${parseFloat(product.price).toFixed(2)}</span>
                    <span class="product-stock">Stock: ${product.stock}</span>
                </div>
                ${product.category ? `<span class="product-category">${product.category}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    productsGrid.innerHTML = productsHTML;
}

// Event Listeners mejorados
function setupEventListeners() {
    // Búsqueda y filtros
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterProducts, 300));
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProducts);
    }

    // Carrito
    if (cartBtn) {
        cartBtn.addEventListener('click', openCartSidebar);
    }
    if (closeCart) {
        closeCart.addEventListener('click', closeCartSidebar);
    }
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }

    // Product Modal
    if (closeModal) {
        closeModal.addEventListener('click', closeProductModal);
    }
    if (decreaseQtyBtn) {
        decreaseQtyBtn.addEventListener('click', () => {
            const currentQty = parseInt(quantityInput.value);
            if (currentQty > 1) {
                quantityInput.value = currentQty - 1;
            }
        });
    }
    if (increaseQtyBtn) {
        increaseQtyBtn.addEventListener('click', () => {
            const currentQty = parseInt(quantityInput.value);
            const maxQty = Math.min(3, currentProduct?.stock || 3);
            if (currentQty < maxQty) {
                quantityInput.value = currentQty + 1;
            }
        });
    }
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', addToCart);
    }

    // Invoices
    if (invoicesBtn) {
        invoicesBtn.addEventListener('click', openInvoicesModal);
    }
    if (closeInvoicesModal) {
        closeInvoicesModal.addEventListener('click', closeInvoicesModalFunc);
    }

    // Botón flotante de scroll
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Mostrar/ocultar botón flotante según el scroll
    window.addEventListener('scroll', () => {
        if (scrollToTopBtn) {
            if (window.scrollY > 300) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        }
    });

    // Close modals on overlay click
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeProductModal();
            closeInvoicesModalFunc();
        });
    }

    // Prevent modal close when clicking inside modal
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    if (invoicesModal) {
        invoicesModal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Product Modal Management mejorado
function openProductModal(productId) {
    currentProduct = products.find(p => p.id === productId);
    if (!currentProduct) {
        console.error('Producto no encontrado:', productId);
        showMessage('Producto no encontrado', 'error');
        return;
    }

    if (!productModal) {
        console.error('Modal de producto no encontrado');
        return;
    }

    // Populate modal content
    if (modalProductName) modalProductName.textContent = currentProduct.name;
    if (modalProductBrand) {
        modalProductBrand.textContent = currentProduct.brand || '';
        modalProductBrand.style.display = currentProduct.brand ? 'block' : 'none';
    }
    if (modalProductPrice) modalProductPrice.textContent = `$${parseFloat(currentProduct.price).toFixed(2)}`;
    if (modalProductDescription) {
        modalProductDescription.textContent = currentProduct.description || '';
        modalProductDescription.style.display = currentProduct.description ? 'block' : 'none';
    }
    if (modalProductStock) modalProductStock.textContent = `Stock disponible: ${currentProduct.stock}`;

    // Handle product image
    if (modalProductImage && modalImagePlaceholder) {
        if (currentProduct.image_url) {
            modalProductImage.src = currentProduct.image_url;
            modalProductImage.style.display = 'block';
            modalImagePlaceholder.style.display = 'none';
            modalProductImage.onerror = () => {
                modalProductImage.style.display = 'none';
                modalImagePlaceholder.style.display = 'flex';
            };
        } else {
            modalProductImage.style.display = 'none';
            modalImagePlaceholder.style.display = 'flex';
        }
    }

    // Reset quantity
    if (quantityInput) quantityInput.value = 1;

    // Setup variants
    setupVariants();
    updateAddToCartButton();

    // Show modal
    productModal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    
    // Prevenir scroll del body
    document.body.classList.add('modal-open');
}

function setupVariants() {
    // Colors
    if (colorSelection && colorOptions) {
        let colors = [];
        
        // Handle colors properly
        if (currentProduct.colors) {
            if (Array.isArray(currentProduct.colors)) {
                colors = currentProduct.colors;
            } else if (typeof currentProduct.colors === 'string') {
                try {
                    // Try to parse as JSON first
                    colors = JSON.parse(currentProduct.colors);
                } catch (e) {
                    // If not JSON, split by comma
                    colors = currentProduct.colors.split(',').map(c => c.trim()).filter(c => c);
                }
            }
        }
        
        console.log('Colores encontrados:', colors);
        
        if (colors.length > 0) {
            colorSelection.style.display = 'block';
            colorOptions.innerHTML = colors.map(color => 
                `<button class="color-option" onclick="selectColor('${color}', this)">${color}</button>`
            ).join('');
        } else {
            colorSelection.style.display = 'none';
        }
    }

    // Sizes
    if (sizeSelection && sizeOptions) {
        let sizes = [];
        
        // Handle sizes properly
        if (currentProduct.sizes) {
            if (Array.isArray(currentProduct.sizes)) {
                sizes = currentProduct.sizes;
            } else if (typeof currentProduct.sizes === 'string') {
                try {
                    // Try to parse as JSON first
                    sizes = JSON.parse(currentProduct.sizes);
                } catch (e) {
                    // If not JSON, split by comma
                    sizes = currentProduct.sizes.split(',').map(s => s.trim()).filter(s => s);
                }
            }
        }
        
        console.log('Tallas encontradas:', sizes);
        
        if (sizes.length > 0) {
            sizeSelection.style.display = 'block';
            sizeOptions.innerHTML = sizes.map(size => 
                `<button class="size-option" onclick="selectSize('${size}', this)">${size}</button>`
            ).join('');
        } else {
            sizeSelection.style.display = 'none';
        }
    }

    // Reset selections
    currentProduct.selectedColor = null;
    currentProduct.selectedSize = null;
}

function selectColor(color, element) {
    // Remove previous selection
    document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected'));
    
    // Add selection to clicked element
    element.classList.add('selected');
    currentProduct.selectedColor = color;
    
    updateAddToCartButton();
}

function selectSize(size, element) {
    // Remove previous selection
    document.querySelectorAll('.size-option').forEach(btn => btn.classList.remove('selected'));
    
    // Add selection to clicked element
    element.classList.add('selected');
    currentProduct.selectedSize = size;
    
    updateAddToCartButton();
}

function updateAddToCartButton() {
    if (!addToCartBtn) return;
    
    const hasRequiredVariants = (!currentProduct.colors || currentProduct.colors.length === 0 || currentProduct.selectedColor) &&
                               (!currentProduct.sizes || currentProduct.sizes.length === 0 || currentProduct.selectedSize);
    
    const hasStock = currentProduct.stock > 0;
    
    if (hasStock && hasRequiredVariants) {
        addToCartBtn.disabled = false;
        addToCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Agregar al Carrito';
        addToCartBtn.className = 'btn btn-primary btn-full';
    } else if (!hasStock) {
        addToCartBtn.disabled = true;
        addToCartBtn.innerHTML = '<i class="fas fa-times"></i> Sin Stock';
        addToCartBtn.className = 'btn btn-danger btn-full';
    } else {
        addToCartBtn.disabled = true;
        addToCartBtn.innerHTML = '<i class="fas fa-hand-pointer"></i> Selecciona opciones';
        addToCartBtn.className = 'btn btn-secondary btn-full';
    }
}

function closeProductModal() {
    if (productModal) productModal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    currentProduct = null;
    
    // Restaurar scroll del body
    document.body.classList.remove('modal-open');
}

// Cart Management corregido
function loadCart() {
    const savedCart = localStorage.getItem('catalog_cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
            console.log('Carrito cargado desde localStorage:', cart.length, 'items');
        } catch (error) {
            console.error('Error parsing cart from localStorage:', error);
            cart = [];
        }
    }
    updateCartUI();
}

function saveCart() {
    try {
        localStorage.setItem('catalog_cart', JSON.stringify(cart));
        console.log('Carrito guardado en localStorage');
    } catch (error) {
        console.error('Error saving cart to localStorage:', error);
    }
}

// Función corregida de agregar al carrito
async function addToCart() {
    if (!currentProduct) {
        showMessage('Error: No hay producto seleccionado', 'error');
        return;
    }

    const quantity = parseInt(quantityInput?.value || 1);
    const color = currentProduct.selectedColor || null;
    const size = currentProduct.selectedSize || null;
    const userId = getUserId();

    if (!userId) {
        showMessage('Error: No se pudo identificar el usuario', 'error');
        return;
    }

    // Validar límite de 3 productos
    if (quantity > 3) {
        showMessage('Máximo 3 unidades por producto', 'error');
        return;
    }

    try {
        showMessage('Agregando producto...', 'info');
        
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                product_id: currentProduct.id,
                quantity: quantity,
                color: color,
                size: size
            })
        });

        const responseData = await response.json();
        console.log('Respuesta del servidor (add to cart):', responseData);

        if (response.ok) {
            // Actualizar carrito local también
            const existingItem = cart.find(item => 
                item.id === currentProduct.id &&
                item.color === color &&
                item.size === size
            );

            if (existingItem) {
                // Verificar límite antes de actualizar localmente
                const newQuantity = existingItem.quantity + quantity;
                if (newQuantity <= 3) {
                    existingItem.quantity = newQuantity;
                }
            } else {
                cart.push({
                    id: currentProduct.id,
                    name: currentProduct.name,
                    brand: currentProduct.brand,
                    price: currentProduct.price,
                    image_url: currentProduct.image_url,
                    quantity: quantity,
                    color: color,
                    size: size
                });
            }

            saveCart();
            updateCartUI();
            closeProductModal();
            showMessage('Producto agregado al carrito', 'success');
        } else {
            const errorMessage = responseData.error || 'Error al agregar producto';
            showMessage(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error de conexión al agregar producto', 'error');
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
    showMessage('Producto eliminado del carrito', 'info');
}

function updateCartItemQuantity(index, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(index);
        return;
    }

    // Validar límite máximo de 3 productos
    if (newQuantity > 3) {
        showMessage('Máximo 3 unidades por producto', 'error');
        return;
    }

    const item = cart[index];
    const userId = getUserId();

    // Actualizar en el servidor
    fetch(`${API_BASE}/cart/update`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: userId,
            product_id: item.id,
            quantity: newQuantity,
            color: item.color,
            size: item.size
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            cart[index].quantity = newQuantity;
            saveCart();
            updateCartUI();
        } else {
            showMessage(data.error || 'Error al actualizar cantidad', 'error');
        }
    })
    .catch(error => {
        console.error('Error updating cart:', error);
        showMessage('Error de conexión al actualizar carrito', 'error');
    });
}

function openCartSidebar() {
    if (cartSidebar) {
        cartSidebar.classList.add('open');
    }
    if (overlay) {
        overlay.style.display = 'block';
    }
    
    // Prevenir scroll del body
    document.body.classList.add('modal-open');
}

function closeCartSidebar() {
    if (cartSidebar) {
        cartSidebar.classList.remove('open');
    }
    if (overlay) {
        overlay.style.display = 'none';
    }
    
    // Restaurar scroll del body
    document.body.classList.remove('modal-open');
}

function updateCartUI() {
    // Update cart count
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'block' : 'none';
    }

    // Update cart content
    if (cartContent) {
        if (cart.length === 0) {
            cartContent.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Tu carrito está vacío</p>
                </div>
            `;
            if (cartFooter) cartFooter.style.display = 'none';
        } else {
            const cartItemsHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <div class="item-image">
                        ${item.image_url ? 
                            `<img src="${item.image_url}" alt="${item.name}">` :
                            `<div class="image-placeholder"><i class="fas fa-image"></i></div>`
                        }
                    </div>
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        ${item.brand ? `<p class="brand">${item.brand}</p>` : ''}
                        ${item.color ? `<p class="variant">Color: ${item.color}</p>` : ''}
                        ${item.size ? `<p class="variant">Talla: ${item.size}</p>` : ''}
                        <p class="price">$${parseFloat(item.price).toFixed(2)}</p>
                    </div>
                    <div class="item-controls">
                        <div class="quantity-controls">
                            <button onclick="updateCartItemQuantity(${index}, ${item.quantity - 1})" class="qty-btn">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button onclick="updateCartItemQuantity(${index}, ${item.quantity + 1})" class="qty-btn">+</button>
                        </div>
                        <button onclick="removeFromCart(${index})" class="remove-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            cartContent.innerHTML = cartItemsHTML;
            
            if (cartFooter) cartFooter.style.display = 'block';
        }
    }

    // Update cart total
    if (cartTotal) {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = total.toFixed(2);
    }
}

async function checkout() {
    if (cart.length === 0) {
        showMessage('El carrito está vacío', 'error');
        return;
    }

    const userId = getUserId();
    if (!userId) {
        showMessage('Error: No se pudo identificar el usuario', 'error');
        return;
    }

    try {
        showMessage('Procesando factura...', 'info');

        const orderData = {
            user_id: userId,
        };

        const response = await fetch(`${API_BASE}/invoice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        const responseData = await response.json();
        console.log('Respuesta del checkout:', responseData);

        if (response.ok) {
            cart = [];
            saveCart();
            updateCartUI();
            closeCartSidebar();
            
            // Calcular fecha límite (3 días a partir de hoy)
            const currentDate = new Date();
            const deadlineDate = new Date(currentDate);
            deadlineDate.setDate(currentDate.getDate() + 3);
            
            const formattedDeadline = deadlineDate.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Mostrar mensaje de éxito con fecha límite
            showMessage('Factura generada exitosamente', 'success');
            
            // Mostrar modal de confirmación con fecha límite
            setTimeout(() => {
                showInvoiceConfirmation(responseData.id, responseData.total, formattedDeadline);
            }, 1000);
            
            // Send data to Telegram Bot if available
            if (tg) {
                tg.sendData(JSON.stringify({
                    action: 'invoice_created',
                    invoice_id: responseData.id,
                    total: responseData.total,
                    deadline: formattedDeadline
                }));
            }
        } else {
            const errorMessage = responseData.error || 'Error al procesar el pedido';
            showMessage(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        showMessage('Error al procesar el pedido', 'error');
    }
}

// Nueva función para mostrar confirmación de factura con fecha límite
function showInvoiceConfirmation(invoiceId, total, deadline) {
    // Crear modal de confirmación
    const confirmationModal = document.createElement('div');
    confirmationModal.className = 'modal';
    confirmationModal.style.display = 'block';
    confirmationModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Factura Generada</h3>
            </div>
            <div class="modal-body">
                <div class="invoice-confirmation">
                    <div class="success-icon">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <h4>¡Factura #${invoiceId} creada exitosamente!</h4>
                    <p class="total-amount">Total: $${parseFloat(total).toFixed(2)}</p>
                    
                    <div class="invoice-deadline">
                        <i class="fas fa-clock"></i>
                        <div class="invoice-deadline-text">
                            <strong>Fecha límite para recoger:</strong>
                            <div class="invoice-deadline-date">${deadline}</div>
                            <p class="invoice-deadline-message">
                                Tienes 3 días para acudir a la tienda y completar tu compra.
                                Después de esta fecha, la factura será cancelada automáticamente.
                            </p>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem;">
                        <button class="btn btn-primary btn-full" onclick="closeInvoiceConfirmation()">
                            <i class="fas fa-check"></i> Entendido
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmationModal);
    
    // Prevenir scroll del body
    document.body.classList.add('modal-open');
    
    // Cerrar al hacer clic fuera del modal
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeInvoiceConfirmation();
        }
    });
}

// Función para cerrar el modal de confirmación
function closeInvoiceConfirmation() {
    const confirmationModal = document.querySelector('.modal:last-of-type');
    if (confirmationModal) {
        confirmationModal.remove();
    }
    
    // Restaurar scroll del body
    document.body.classList.remove('modal-open');
}

// Invoices Modal Management corregido
async function openInvoicesModal() {
    if (!invoicesModal) {
        console.error('Modal de facturas no encontrado');
        return;
    }

    invoicesModal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
    
    // Prevenir scroll del body
    document.body.classList.add('modal-open');
    
    await loadInvoices();
}

function closeInvoicesModalFunc() {
    if (invoicesModal) invoicesModal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    
    // Restaurar scroll del body
    document.body.classList.remove('modal-open');
}

async function loadInvoices() {
    if (!invoicesList) return;

    const userId = getUserId();
    if (!userId) {
        invoicesList.innerHTML = '<div class="error">No se pudo identificar el usuario</div>';
        return;
    }

    try {
        invoicesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Cargando facturas...</div>';

        const response = await fetch(`${API_BASE}/invoices/user/${userId}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const invoices = await response.json();
        console.log('Facturas cargadas:', invoices);

        if (invoices.length === 0) {
            invoicesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No tienes facturas</h3>
                    <p>Realiza tu primera compra para ver tus facturas aquí</p>
                </div>
            `;
            return;
        }

        const invoicesHTML = invoices.map(invoice => {
            const date = new Date(invoice.created_at);
            const formattedDate = date.toLocaleDateString('es-ES');
            
            return `
                <div class="invoice-item">
                    <div class="invoice-header">
                        <h4>Factura #${invoice.id}</h4>
                        <span class="invoice-status ${invoice.status}">${getStatusText(invoice.status)}</span>
                    </div>
                    <div class="invoice-details">
                        <p class="date">Fecha: ${formattedDate}</p>
                        <p class="total">Total: $${parseFloat(invoice.total).toFixed(2)}</p>
                        <p class="items">${invoice.items ? invoice.items.length : 0} productos</p>
                    </div>
                </div>
            `;
        }).join('');

        invoicesList.innerHTML = invoicesHTML;

    } catch (error) {
        console.error('Error loading invoices:', error);
        invoicesList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar facturas: ${error.message}</p>
                <button onclick="loadInvoices()" class="btn btn-primary">Reintentar</button>
            </div>
        `;
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'paid': 'Pagada',
        'cancelled': 'Cancelada',
        'completed': 'Completada'
    };
    return statusMap[status] || status;
}

// Utility Functions
function showMessage(message, type = 'info', duration = 3000) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message-toast');
    existingMessages.forEach(msg => msg.remove());

    const messageEl = document.createElement('div');
    messageEl.className = `message-toast ${type}`;
    messageEl.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(messageEl);

    // Auto remove after specified duration
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.remove();
        }
    }, duration);
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Error handling for missing elements
window.addEventListener('error', function(e) {
    console.error('Error global en catalog:', e.error);
    if (e.error && e.error.message && e.error.message.includes('Cannot read property')) {
        console.log('Posible error de elemento DOM faltante, verificando elementos...');
        
        // Re-verificar elementos críticos
        const criticalElements = ['productsGrid', 'categoryFilter', 'searchInput'];
        criticalElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(`Elemento crítico faltante: ${elementId}`);
            }
        });
    }
});

// Prevent default behavior for certain events
document.addEventListener('click', function(e) {
    // Prevent closing modals when clicking inside them
    if (e.target.closest('.modal-content')) {
        e.stopPropagation();
    }
});

// Handle page visibility change
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Page became visible, refresh cart
        loadCart();
    }
});

console.log('Script de catálogo cargado completamente');