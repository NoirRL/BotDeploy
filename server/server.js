const express = require('express');
const cors = require('cors');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Constantes para superusuarios (debe coincidir con el bot)
const SUPER_ADMIN_USER_IDS = [1870169979, 743216859];
const ADMIN_USER_IDS = [];

// AGREGAR headers de seguridad para WebApps de Telegram
app.use((req, res, next) => {
    // Headers específicos para Telegram WebApps
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://core.telegram.org");
    
    // Headers CORS específicos para WebApps
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-User-Id');
    
    // Headers para carga de recursos CSS/JS
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    
    // Específico para archivos CSS
    if (req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    
    // Específico para archivos JS
    if (req.url.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    
    next();
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../webapps')));

// Handle favicon.ico requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
    res.status(204).send(); // Send empty response with "No Content" status
});

// Configuración de la base de datos
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../store_bot.db'),
    logging: false
});

// Modelos de la base de datos
const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    telegram_id: { type: DataTypes.INTEGER, unique: true, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    email: { type: DataTypes.STRING(100), allowNull: false },
    address: { type: DataTypes.STRING(200), allowNull: false },
    is_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_super_admin: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

const Product = sequelize.define('Product', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.FLOAT, allowNull: false },
    image_url: { type: DataTypes.STRING(200) },
    category: { type: DataTypes.STRING(50) },
    brand: { type: DataTypes.STRING(50) },
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    colors: { type: DataTypes.JSON }, // Array de colores disponibles
    sizes: { type: DataTypes.JSON }   // Array de tallas disponibles
}, {
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

const Appointment = sequelize.define('Appointment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    time: { type: DataTypes.STRING(5), allowNull: false }, 
    reason: { type: DataTypes.STRING(100), allowNull: false },
    notes: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' }
}, {
    tableName: 'appointments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

const Cart = sequelize.define('Cart', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    color: { type: DataTypes.STRING(50) },
    size: { type: DataTypes.STRING(20) }
}, {
    tableName: 'cart',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    items: { type: DataTypes.JSON },
    total: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' }, // Agregar este campo
    date: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW } // Agregar fecha
}, {
    tableName: 'invoices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

async function getOrCreateUser(telegramData) {
    try {
        let user = await User.findOne({ where: { telegram_id: telegramData.id } });
        
        if (!user) {
            user = await User.create({
                telegram_id: telegramData.id,
                name: `${telegramData.first_name} ${telegramData.last_name || ''}`.trim(),
                phone: telegramData.phone || '',
                email: telegramData.email || '',
                address: ''
            });
        }
        
        return user;
    } catch (error) {
        throw new Error('Error al crear/obtener usuario');
    }
}

// Relaciones
User.hasMany(Appointment, { foreignKey: 'user_id' });
User.hasMany(Cart, { foreignKey: 'user_id' });
User.hasMany(Invoice, { foreignKey: 'user_id' });
Product.hasMany(Cart, { foreignKey: 'product_id' });
Appointment.belongsTo(User, { foreignKey: 'user_id' });
Cart.belongsTo(User, { foreignKey: 'user_id' });
Cart.belongsTo(Product, { foreignKey: 'product_id' });
Invoice.belongsTo(User, { foreignKey: 'user_id' });

// Middleware para verificar si el usuario está registrado
async function checkUserRegistration(req, res, next) {
    try {
        // Obtener el user_id de múltiples fuentes posibles
        const telegramUserId = req.headers['x-telegram-user-id'] || 
                              req.query.tgWebAppStartParam || 
                              req.query.user_id ||
                              req.body?.user_id;
        
        console.log('Verificando registro para user_id:', telegramUserId);
        console.log('Headers:', req.headers);
        console.log('Query params:', req.query);
        
        if (!telegramUserId) {
            console.log('No se encontró user_id, redirigiendo a registro');
            return res.redirect('/register?error=no_user_id');
        }
        
        const numericUserId = parseInt(telegramUserId);
        if (isNaN(numericUserId)) {
            console.log('user_id inválido:', telegramUserId);
            return res.redirect('/register?error=invalid_user_id');
        }
        
        // VERIFICAR SI ES SUPERUSUARIO - ACCESO DIRECTO
        if (SUPER_ADMIN_USER_IDS.includes(numericUserId)) {
            console.log(`Superusuario ${numericUserId} detectado, acceso permitido sin validación completa`);
            req.user_id = numericUserId; // Agregar a la request para uso posterior
            next();
            return;
        }
        
        // Verificar si el usuario existe en la base de datos
        const user = await User.findOne({ where: { telegram_id: numericUserId } });
        
        if (!user) {
            console.log(`Usuario ${numericUserId} no encontrado en BD`);
            return res.redirect(`/register?user_id=${numericUserId}&error=not_registered`);
        }
        
        // Verificar si es admin por base de datos - también acceso directo
        if (user.is_admin || user.is_super_admin) {
            console.log(`Admin/SuperAdmin ${numericUserId} detectado por BD, acceso permitido`);
            req.user_id = numericUserId;
            next();
            return;
        }
        
        // Para usuarios normales, verificar que tengan información completa con validaciones mejoradas
        const name = user.name ? user.name.trim() : '';
        const phone = user.phone ? user.phone.trim() : '';
        const email = user.email ? user.email.trim() : '';
        const address = user.address ? user.address.trim() : '';
        
        // Validar que los campos básicos no estén vacíos
        if (!name || !phone || !email || !address || 
            name === 'N/A' || phone === 'N/A' || email === 'N/A' || address === 'N/A') {
            console.log(`Usuario ${numericUserId} con campos faltantes o N/A`);
            return res.redirect(`/register?user_id=${numericUserId}&error=incomplete_registration`);
        }
        
        // Validaciones específicas adicionales
        // Validar longitud mínima del nombre
        if (name.length < 2) {
            console.log(`Usuario ${numericUserId} con nombre muy corto: "${name}"`);
            return res.redirect(`/register?user_id=${numericUserId}&error=incomplete_registration`);
        }
        
        // Validar teléfono (permitir números con espacios, guiones y paréntesis)
        const phoneClean = phone.replace(/\D/g, ''); // Extraer solo dígitos
        if (phoneClean.length < 8 || phoneClean.length > 15) {
            console.log(`Usuario ${numericUserId} con teléfono inválido: "${phone}"`);
            return res.redirect(`/register?user_id=${numericUserId}&error=incomplete_registration`);
        }
        
        // Validar email básico
        if (!email.includes('@') || !email.split('@')[1]?.includes('.')) {
            console.log(`Usuario ${numericUserId} con email inválido: "${email}"`);
            return res.redirect(`/register?user_id=${numericUserId}&error=incomplete_registration`);
        }
        
        // Validar longitud mínima de dirección
        if (address.length < 10) {
            console.log(`Usuario ${numericUserId} con dirección muy corta: "${address}"`);
            return res.redirect(`/register?user_id=${numericUserId}&error=incomplete_registration`);
        }
        
        // Si todo está bien, continuar
        console.log(`Usuario ${numericUserId} verificado correctamente`);
        req.user_id = numericUserId; // Agregar a la request para uso posterior
        next();
    } catch (error) {
        console.error('Error verificando registro de usuario:', error);
        res.redirect('/register?error=server_error');
    }
}

// Rutas para servir las WebApps (con verificación de registro)
app.get('/catalog', checkUserRegistration, (req, res) => {
    res.sendFile(path.join(__dirname, '../webapps/user/catalog/index.html'));
});

app.get('/appointments', checkUserRegistration, (req, res) => {
    res.sendFile(path.join(__dirname, '../webapps/user/appointments/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapps/admin/index.html'));
});

// Ruta para la página de registro
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapps/register/index.html'));
});

// Ruta para la página de edición de información de usuario
app.get('/edit', checkUserRegistration, (req, res) => {
    res.sendFile(path.join(__dirname, '../webapps/user/edit/index.html'));
});

// ========== APIs para ADMIN ==========

// Obtener todos los productos - MEJORADO para sincronización
app.get('/api/admin/products', async (req, res) => {
    try {
        const products = await Product.findAll({
            order: [['name', 'ASC']]
        });
        
        // Log para debugging
        console.log(`Admin API: Enviando ${products.length} productos`);
        
        res.json(products);
    } catch (error) {
        console.error('Error en /api/admin/products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Crear nuevo producto - MEJORADO con invalidación de cache
app.post('/api/admin/products', async (req, res) => {
    try {
        console.log('Creando nuevo producto:', req.body);
        const product = await Product.create(req.body);
        
        // Log para sincronización
        console.log(`Producto creado: ${product.name} (ID: ${product.id})`);
        
        res.status(201).json(product);
    } catch (error) {
        console.error('Error creando producto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar producto - MEJORADO con invalidación de cache
app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        console.log(`Actualizando producto ${productId}:`, req.body);
        
        await Product.update(req.body, { where: { id: productId } });
        const product = await Product.findByPk(productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        console.log(`Producto actualizado: ${product.name}`);
        res.json(product);
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar producto - MEJORADO con invalidación de cache
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Verificar que el producto existe antes de eliminarlo
        const product = await Product.findByPk(productId);
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        console.log(`Eliminando producto: ${product.name} (ID: ${productId})`);
        
        await Product.destroy({ where: { id: productId } });
        
        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener todas las citas
app.get('/api/admin/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.findAll({
            include: [User],
            order: [['date', 'ASC'], ['time', 'ASC']]
        });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar estado de cita
app.put('/api/admin/appointments/:id', async (req, res) => {
    try {
        await Appointment.update(req.body, { where: { id: req.params.id } });
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [User]
        });
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener todas las facturas
app.get('/api/admin/invoices', async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            include: [User],
            order: [['created_at', 'DESC']]
        });
        
        // Parsear los items JSON para cada factura
        const invoicesWithParsedItems = invoices.map(invoice => {
            let items = [];
            try {
                // Verificar si items es null, undefined o string vacío
                if (!invoice.items) {
                    console.warn(`Factura ${invoice.id}: items is null/undefined`);
                    items = [];
                } else if (typeof invoice.items === 'string') {
                    // Limpiar strings malformados comunes
                    let itemsString = invoice.items.trim();
                    
                    // Si contiene "[object Object]", está corrupto
                    if (itemsString.includes('[object Object]')) {
                        console.error(`Factura ${invoice.id}: items contains [object Object] - data corrupted`);
                        items = [];
                    } else {
                        items = JSON.parse(itemsString);
                    }
                } else if (Array.isArray(invoice.items)) {
                    // Ya es un array, usarlo directamente
                    items = invoice.items;
                } else {
                    console.error(`Factura ${invoice.id}: items has unexpected type:`, typeof invoice.items);
                    items = [];
                }
            } catch (error) {
                console.error(`Error parsing invoice ${invoice.id} items:`, error.message);
                console.error(`Raw items data:`, invoice.items);
                items = [];
            }
            
            return {
                ...invoice.toJSON(),
                items: items
            };
        });
        
        res.json(invoicesWithParsedItems);
    } catch (error) {
        console.error('Error al obtener facturas admin:', error);
        res.status(500).json({ error: error.message });
    }
});

// AGREGAR: Actualizar estado de factura (para admin)
app.put('/api/admin/invoices/:id', async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const { status } = req.body;
        
        if (!status || !['pending', 'paid', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({ error: 'Estado de factura inválido' });
        }
        
        // NUEVO: Obtener la factura actual antes de actualizar para manejar stock
        const currentInvoice = await Invoice.findByPk(invoiceId, {
            include: [User]
        });
        
        if (!currentInvoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        const previousStatus = currentInvoice.status;
        
        // NUEVO: Manejar restauración de stock cuando se cancela una factura
        if (status === 'cancelled' && previousStatus !== 'cancelled') {
            console.log(`Cancelando factura ${invoiceId}, restaurando stock...`);
            
            // Parsear items de la factura
            let items = [];
            try {
                if (currentInvoice.items) {
                    if (typeof currentInvoice.items === 'string') {
                        let itemsString = currentInvoice.items.trim();
                        if (!itemsString.includes('[object Object]')) {
                            items = JSON.parse(itemsString);
                        }
                    } else if (Array.isArray(currentInvoice.items)) {
                        items = currentInvoice.items;
                    }
                }
            } catch (error) {
                console.error(`Error parsing items for invoice ${invoiceId}:`, error.message);
            }
            
            // Restaurar stock para cada producto
            for (const item of items) {
                if (item.product_id && item.quantity) {
                    const product = await Product.findByPk(item.product_id);
                    if (product) {
                        const newStock = product.stock + item.quantity;
                        await Product.update(
                            { stock: newStock },
                            { where: { id: item.product_id } }
                        );
                        console.log(`Stock restaurado para ${item.product_name || 'Producto'}: ${product.stock} -> ${newStock}`);
                    }
                }
            }
        }
        
        // NUEVO: Reducir stock nuevamente si se reactiva una factura cancelada
        if (previousStatus === 'cancelled' && status !== 'cancelled') {
            console.log(`Reactivando factura ${invoiceId}, reduciendo stock...`);
            
            // Parsear items de la factura
            let items = [];
            try {
                if (currentInvoice.items) {
                    if (typeof currentInvoice.items === 'string') {
                        let itemsString = currentInvoice.items.trim();
                        if (!itemsString.includes('[object Object]')) {
                            items = JSON.parse(itemsString);
                        }
                    } else if (Array.isArray(currentInvoice.items)) {
                        items = currentInvoice.items;
                    }
                }
            } catch (error) {
                console.error(`Error parsing items for invoice ${invoiceId}:`, error.message);
            }
            
            // Verificar stock disponible antes de reactivar
            for (const item of items) {
                if (item.product_id && item.quantity) {
                    const product = await Product.findByPk(item.product_id);
                    if (product) {
                        if (product.stock < item.quantity) {
                            return res.status(400).json({ 
                                error: `No se puede reactivar: Stock insuficiente para ${item.product_name || 'Producto'}. Stock disponible: ${product.stock}, cantidad requerida: ${item.quantity}` 
                            });
                        }
                    }
                }
            }
            
            // Reducir stock para cada producto
            for (const item of items) {
                if (item.product_id && item.quantity) {
                    const product = await Product.findByPk(item.product_id);
                    if (product) {
                        const newStock = product.stock - item.quantity;
                        await Product.update(
                            { stock: newStock },
                            { where: { id: item.product_id } }
                        );
                        console.log(`Stock reducido para ${item.product_name || 'Producto'}: ${product.stock} -> ${newStock}`);
                    }
                }
            }
        }
        
        await Invoice.update({ status }, { where: { id: invoiceId } });
        
        const updatedInvoice = await Invoice.findByPk(invoiceId, {
            include: [User]
        });
        
        // Parsear items para respuesta
        let items = [];
        try {
            // Verificar si items es null, undefined o string vacío
            if (!updatedInvoice.items) {
                console.warn(`Factura ${invoiceId}: items is null/undefined`);
                items = [];
            } else if (typeof updatedInvoice.items === 'string') {
                // Limpiar strings malformados comunes
                let itemsString = updatedInvoice.items.trim();
                
                // Si contiene "[object Object]", está corrupto
                if (itemsString.includes('[object Object]')) {
                    console.error(`Factura ${invoiceId}: items contains [object Object] - data corrupted`);
                    items = [];
                } else {
                    items = JSON.parse(itemsString);
                }
            } else if (Array.isArray(updatedInvoice.items)) {
                // Ya es un array, usarlo directamente
                items = updatedInvoice.items;
            } else {
                console.error(`Factura ${invoiceId}: items has unexpected type:`, typeof updatedInvoice.items);
                items = [];
            }
        } catch (error) {
            console.error(`Error parsing invoice ${invoiceId} items:`, error.message);
            console.error(`Raw items data:`, updatedInvoice.items);
            items = [];
        }
        
        const responseInvoice = {
            ...updatedInvoice.toJSON(),
            items: items
        };
        
        console.log(`Factura ${invoiceId} actualizada a estado: ${status}`);
        res.json(responseInvoice);
    } catch (error) {
        console.error('Error al actualizar estado de factura:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== APIs para USUARIO ==========

// AGREGAR: Endpoint para obtener productos (para usuarios)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.findAll({
            order: [['name', 'ASC']]
        });
        
        console.log(`User API: Enviando ${products.length} productos`);
        res.json(products);
    } catch (error) {
        console.error('Error en /api/products:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener citas por usuario ID
app.get('/api/appointments/user/:userId', async (req, res) => {
    try {
        const telegramUserId = req.params.userId;
        console.log('Obteniendo citas para usuario con telegram_id:', telegramUserId);
        
        // CORREGIR: Buscar el usuario por telegram_id primero
        const user = await User.findOne({ where: { telegram_id: telegramUserId } });
        
        if (!user) {
            console.log(`Usuario con telegramUserId ${telegramUserId} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`Usuario encontrado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegram_id})`);
        
        // Buscar citas usando el ID interno del usuario
        const appointments = await Appointment.findAll({
            where: { user_id: user.id }, // Usar el ID interno
            order: [['date', 'DESC'], ['time', 'DESC']]
        });
        
        console.log(`Encontradas ${appointments.length} citas para usuario ${user.name}`);
        res.json(appointments);
    } catch (error) {
        console.error('Error al obtener citas del usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener todas las citas (con header de usuario para verificación) - CORREGIDO
app.get('/api/appointments', async (req, res) => {
    try {
        const { date } = req.query;
        
        // Si se especifica una fecha, devolver todas las citas para esa fecha (para verificar disponibilidad)
        if (date) {
            console.log('Consultando citas para fecha:', date);
            
            const appointments = await Appointment.findAll({
                where: {
                    date: date
                },
                include: [User],
                order: [['time', 'ASC']]
            });
            
            console.log(`Encontradas ${appointments.length} citas para la fecha ${date}`);
            return res.json(appointments);
        }
        
        // Si no se especifica fecha, usar comportamiento original (citas del usuario)
        const telegramUserId = req.headers['x-telegram-user-id'];
        if (!telegramUserId) {
            return res.status(400).json({ error: 'User ID requerido en headers o parámetro date' });
        }
        
        // CORREGIR: Buscar el usuario por telegram_id primero
        const user = await User.findOne({ where: { telegram_id: telegramUserId } });
        
        if (!user) {
            console.log(`Usuario con telegramUserId ${telegramUserId} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Buscar citas usando el ID interno del usuario
        const appointments = await Appointment.findAll({
            where: { user_id: user.id }, // Usar el ID interno
            order: [['date', 'DESC'], ['time', 'DESC']]
        });
        
        res.json(appointments);
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para registro de usuarios desde la WebApp
app.post('/api/users/register', async (req, res) => {
    try {
        const { telegram_id, name, phone, email, address } = req.body;
        
        // Validar datos requeridos
        if (!telegram_id || !name || !phone || !email || !address) {
            return res.status(400).json({ 
                error: 'Todos los campos son requeridos' 
            });
        }
        
        // Verificar si el usuario ya existe
        let user = await User.findOne({ where: { telegram_id } });
        
        if (user) {
            // Actualizar usuario existente
            await user.update({ name, phone, email, address });
            res.json({ 
                message: 'Usuario actualizado exitosamente', 
                user: { id: user.id, name: user.name, email: user.email } 
            });
        } else {
            // Crear nuevo usuario
            user = await User.create({
                telegram_id,
                name,
                phone,
                email,
                address
            });
            res.status(201).json({ 
                message: 'Usuario registrado exitosamente', 
                user: { id: user.id, name: user.name, email: user.email } 
            });
        }
    } catch (error) {
        console.error('Error en registro de usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// AGREGAR: Endpoint para obtener información de un usuario específico
app.get('/api/users/:userId', async (req, res) => {
    try {
        const telegramUserId = req.params.userId;
        console.log('Obteniendo información para usuario con telegram_id:', telegramUserId);
        
        // Buscar el usuario por telegram_id
        const user = await User.findOne({ where: { telegram_id: telegramUserId } });
        
        if (!user) {
            console.log(`Usuario con telegram_id ${telegramUserId} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`Usuario encontrado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegram_id})`);
        
        // Retornar información del usuario (sin información sensible)
        res.json({
            id: user.id,
            telegram_id: user.telegram_id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            address: user.address
        });
    } catch (error) {
        console.error('Error al obtener información del usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// AGREGAR: Endpoint para obtener información de un usuario (usando ID interno)
app.get('/api/user/:userId', async (req, res) => {
    try {
        const telegramUserId = req.params.userId;
        console.log('Obteniendo información para usuario con telegram_id:', telegramUserId);
        
        // Buscar el usuario por telegram_id
        const user = await User.findOne({ where: { telegram_id: telegramUserId } });
        
        if (!user) {
            console.log(`Usuario con telegram_id ${telegramUserId} no encontrado`);
            return res.status(404).json({ 
                success: false, 
                error: 'Usuario no encontrado' 
            });
        }
        
        console.log(`Usuario encontrado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegram_id})`);
        
        // Retornar información del usuario con formato esperado por el frontend
        res.json({
            success: true,
            user: {
                id: user.id,
                telegram_id: user.telegram_id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                address: user.address
            }
        });
    } catch (error) {
        console.error('Error al obtener información del usuario:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// AGREGAR: Endpoint para actualizar información de un usuario
app.put('/api/user/:userId', async (req, res) => {
    try {
        const telegramUserId = req.params.userId;
        const { name, phone, email, address } = req.body;
        
        console.log('Actualizando información para usuario con telegram_id:', telegramUserId);
        console.log('Datos a actualizar:', { name, phone, email, address });
        
        // Validar datos requeridos
        if (!name || !phone || !email || !address) {
            return res.status(400).json({ 
                success: false,
                error: 'Todos los campos son requeridos' 
            });
        }
        
        // Buscar el usuario por telegram_id
        const user = await User.findOne({ where: { telegram_id: telegramUserId } });
        
        if (!user) {
            console.log(`Usuario con telegram_id ${telegramUserId} no encontrado`);
            return res.status(404).json({ 
                success: false,
                error: 'Usuario no encontrado' 
            });
        }
        
        // Actualizar información del usuario
        await user.update({ 
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            address: address.trim()
        });
        
        console.log(`Usuario ${user.name} actualizado exitosamente`);
        
        // Retornar respuesta exitosa
        res.json({
            success: true,
            message: 'Información actualizada correctamente',
            user: {
                id: user.id,
                telegram_id: user.telegram_id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                address: user.address
            }
        });
    } catch (error) {
        console.error('Error al actualizar información del usuario:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// API para crear citas
app.post('/api/appointments', async (req, res) => {
    try {
        console.log('Datos recibidos para crear cita:', req.body);
        
        const { user_id, date, time, reason, notes } = req.body;
          // Validar datos requeridos
        if (!user_id || !date || !time || !reason) {
            return res.status(400).json({ 
                error: 'user_id, date, time y reason son campos requeridos' 
            });
        }
        
        // Validar formato de fecha
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({ 
                error: 'Formato de fecha inválido. Debe ser YYYY-MM-DD' 
            });
        }
        
        // Validar formato de hora
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(time)) {
            return res.status(400).json({ 
                error: 'Formato de hora inválido. Debe ser HH:MM' 
            });
        }
        
        // Validar que la fecha sea futura
        const appointmentDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (appointmentDate <= today) {
            return res.status(400).json({ 
                error: 'La fecha de la cita debe ser futura' 
            });
        }
        
        // Validar días laborables (lunes a viernes)
        const dayOfWeek = appointmentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.status(400).json({ 
                error: 'Las citas solo se pueden agendar de lunes a viernes' 
            });
        }
        
        // Validar horarios permitidos
        const allowedTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
        if (!allowedTimes.includes(time)) {
            return res.status(400).json({ 
                error: 'Horario no permitido. Los horarios disponibles son de 9:00 AM a 4:00 PM' 
            });
        }
        
        // Validar motivos permitidos
        const allowedReasons = ['toma_medidas', 'asesoria', 'otra'];
        if (!allowedReasons.includes(reason)) {
            return res.status(400).json({ 
                error: 'Motivo de cita no válido' 
            });
        }
        
        // Validar notas si es "otra" razón
        if (reason === 'otra' && (!notes || notes.trim().length < 10)) {
            return res.status(400).json({ 
                error: 'Las notas son requeridas y deben tener al menos 10 caracteres cuando se selecciona "Otra razón"' 
            });
        }
        
        // CORREGIR: Verificar que el usuario existe usando telegram_id en lugar de id
        const user = await User.findOne({ where: { telegram_id: user_id } });
        if (!user) {
            console.log(`Usuario con telegram_id ${user_id} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
          console.log(`Usuario encontrado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegram_id})`);
        
        // VALIDACIÓN: Verificar que no haya otra cita en la misma fecha y hora
        const existingAppointment = await Appointment.findOne({
            where: {
                date: date,
                time: time,
                status: { [Op.ne]: 'cancelled' } // Excluir citas canceladas
            }
        });
        
        if (existingAppointment) {
            console.log(`Ya existe una cita para la fecha ${date} a las ${time}`);
            return res.status(400).json({ 
                error: 'Ya existe una cita agendada para esa fecha y hora. Por favor, selecciona otro horario.' 
            });
        }
        
        // Crear la cita usando el ID interno del usuario
        const appointment = await Appointment.create({
            user_id: user.id, // Usar el ID interno, no el telegram_id
            date,
            time,
            reason,
            notes: notes || null,
            status: 'pending'
        });
        
        // Obtener la cita con información del usuario
        const appointmentWithUser = await Appointment.findByPk(appointment.id, {
            include: [User]
        });
        
        console.log('Cita creada exitosamente:', appointmentWithUser.id);
        res.status(201).json(appointmentWithUser);
        
    } catch (error) {
        console.error('Error al crear cita:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para eliminar citas (cancelar)
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const appointmentId = req.params.id;
        
        const appointment = await Appointment.findByPk(appointmentId);
        if (!appointment) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        
        await Appointment.destroy({ where: { id: appointmentId } });
        
        res.json({ message: 'Cita cancelada exitosamente' });
    } catch (error) {
        console.error('Error al cancelar cita:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para carrito
app.post('/api/cart/add', async (req, res) => {
    try {
        const { user_id, product_id, quantity, color, size } = req.body;
        
        if (!user_id || !product_id || !quantity) {
            return res.status(400).json({ error: 'user_id, product_id y quantity son requeridos' });
        }
        
        // CORREGIR: Buscar el usuario por telegram_id primero
        const user = await User.findOne({ where: { telegram_id: user_id } });
        if (!user) {
            console.log(`Usuario con telegram_id ${user_id} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`Usuario encontrado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegram_id})`);
        
        // Verificar que el producto existe
        const product = await Product.findByPk(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Verificar stock
        if (product.stock < quantity) {
            return res.status(400).json({ error: 'Stock insuficiente' });
        }
        
        // Buscar si ya existe un item similar en el carrito usando el ID interno del usuario
        const existingCartItem = await Cart.findOne({
            where: {
                user_id: user.id, // Usar el ID interno
                product_id,
                color: color || null,
                size: size || null
            }
        });
        
        if (existingCartItem) {
            // Actualizar cantidad (máximo 3)
            const newQuantity = Math.min(existingCartItem.quantity + quantity, 3);
            await existingCartItem.update({ quantity: newQuantity });
            res.json({ success: true, message: 'Cantidad actualizada en el carrito' });
        } else {
            // Crear nuevo item en carrito usando el ID interno del usuario
            await Cart.create({
                user_id: user.id, // Usar el ID interno, no el telegram_id
                product_id,
                quantity: Math.min(quantity, 3),
                color: color || null,
                size: size || null
            });
            res.json({ success: true, message: 'Producto agregado al carrito' });
        }
        
    } catch (error) {
        console.error('Error al agregar al carrito:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para actualizar carrito
app.put('/api/cart/update', async (req, res) => {
    try {
        const { user_id, product_id, quantity, color, size } = req.body;
        
        // CORREGIR: Buscar el usuario por telegram_id primero
        const user = await User.findOne({ where: { telegram_id: user_id } });
        if (!user) {
            console.log(`Usuario con telegram_id ${user_id} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const cartItem = await Cart.findOne({
            where: {
                user_id: user.id, // Usar el ID interno
                product_id,
                color: color || null,
                size: size || null
            }
        });
        
        if (!cartItem) {
            return res.status(404).json({ error: 'Item no encontrado en el carrito' });
        }
        
        if (quantity <= 0) {
            await cartItem.destroy();
            res.json({ success: true, message: 'Item eliminado del carrito' });
        } else {
            await cartItem.update({ quantity: Math.min(quantity, 3) });
            res.json({ success: true, message: 'Cantidad actualizada' });
        }
        
    } catch (error) {
        console.error('Error al actualizar carrito:', error);
        res.status(500).json({ error: error.message });
    }
});

// API para crear factura
app.post('/api/invoice', async (req, res) => {
    try {
        const { user_id } = req.body;
        
        if (!user_id) {
            return res.status(400).json({ error: 'user_id es requerido' });
        }
        
        // CORREGIR: Buscar el usuario por telegram_id primero
        const user = await User.findOne({ where: { telegram_id: user_id } });
        if (!user) {
            console.log(`Usuario con telegram_id ${user_id} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Obtener items del carrito usando el ID interno del usuario
        const cartItems = await Cart.findAll({
            where: { user_id: user.id }, // Usar el ID interno
            include: [Product]
        });
        
        if (cartItems.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío' });
        }
        
        // NUEVO: Verificar stock disponible antes de crear la factura
        for (const item of cartItems) {
            if (item.Product.stock < item.quantity) {
                return res.status(400).json({ 
                    error: `Stock insuficiente para ${item.Product.name}. Stock disponible: ${item.Product.stock}, cantidad solicitada: ${item.quantity}` 
                });
            }
        }
        
        // Calcular total
        let total = 0;
        const items = cartItems.map(item => {
            const itemTotal = item.Product.price * item.quantity;
            total += itemTotal;
            return {
                product_id: item.product_id,
                product_name: item.Product.name,
                quantity: item.quantity,
                price: item.Product.price,
                color: item.color,
                size: item.size,
                total: itemTotal
            };
        });
        
        // NUEVO: Reducir stock de productos cuando se crea la factura
        for (const item of cartItems) {
            const newStock = item.Product.stock - item.quantity;
            await Product.update(
                { stock: newStock },
                { where: { id: item.product_id } }
            );
            console.log(`Stock actualizado para ${item.Product.name}: ${item.Product.stock} -> ${newStock}`);
        }
        
        // Crear factura usando el ID interno del usuario
        const invoice = await Invoice.create({
            user_id: user.id, // Usar el ID interno
            total,
            items: JSON.stringify(items),
            status: 'pending'
        });
        
        // Limpiar carrito usando el ID interno del usuario
        await Cart.destroy({ where: { user_id: user.id } });
        
        console.log(`Factura ${invoice.id} creada exitosamente. Stock actualizado para ${items.length} productos.`);
        
        res.status(201).json({
            id: invoice.id,
            total: invoice.total,
            items: items,
            status: invoice.status
        });
        
    } catch (error) {
        console.error('Error al crear factura:', error);
        res.status(500).json({ error: error.message });
    }
});

// AGREGAR: API para obtener facturas por usuario
app.get('/api/invoices/user/:userId', async (req, res) => {
    try {
        const telegramUserId = req.params.userId;
        console.log('Obteniendo facturas para usuario con telegram_id:', telegramUserId);
        
        // Buscar el usuario por telegram_id primero
        const user = await User.findOne({ where: { telegram_id: telegramUserId } });
        
        if (!user) {
            console.log(`Usuario con telegram_id ${telegramUserId} no encontrado`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`Usuario encontrado: ${user.name} (ID: ${user.id}, Telegram ID: ${user.telegram_id})`);
        
        // Buscar facturas usando el ID interno del usuario
        const invoices = await Invoice.findAll({
            where: { user_id: user.id },
            order: [['created_at', 'DESC']]
        });
        
        // Parsear los items JSON para cada factura
        const invoicesWithParsedItems = invoices.map(invoice => {
            let items = [];
            try {
                // Verificar si items es null, undefined o string vacío
                if (!invoice.items) {
                    console.warn(`Factura ${invoice.id}: items is null/undefined`);
                    items = [];
                } else if (typeof invoice.items === 'string') {
                    // Limpiar strings malformados comunes
                    let itemsString = invoice.items.trim();
                    
                    // Si contiene "[object Object]", está corrupto
                    if (itemsString.includes('[object Object]')) {
                        console.error(`Factura ${invoice.id}: items contains [object Object] - data corrupted`);
                        items = [];
                    } else {
                        items = JSON.parse(itemsString);
                    }
                } else if (Array.isArray(invoice.items)) {
                    // Ya es un array, usarlo directamente
                    items = invoice.items;
                } else {
                    console.error(`Factura ${invoice.id}: items has unexpected type:`, typeof invoice.items);
                    items = [];
                }
            } catch (error) {
                console.error(`Error parsing invoice ${invoice.id} items:`, error.message);
                console.error(`Raw items data:`, invoice.items);
                items = [];
            }
            
            return {
                ...invoice.toJSON(),
                items: items
            };
        });
        
        console.log(`Encontradas ${invoices.length} facturas para usuario ${user.name}`);
        res.json(invoicesWithParsedItems);
    } catch (error) {
        console.error('Error al obtener facturas del usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// AGREGAR: Endpoint para contar productos (para polling inteligente)
app.get('/api/products/count', async (req, res) => {
    try {
        const count = await Product.count();
        res.json({ count });
    } catch (error) {
        console.error('Error al contar productos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== APIs para GESTIÓN DE ADMINISTRADORES ==========

// NUEVO: Función para sincronizar admins hardcodeados del bot
async function syncHardcodedAdmins() {
    try {
        console.log('Sincronizando administradores hardcodeados...');
        
        // IDs de administradores hardcodeados (deben coincidir exactamente con el bot)
        const hardcodedSuperAdmins = [1870169979, 743216859];
        const hardcodedAdmins = [1870169979, 5338637494, 743216859];
        
        // Crear/actualizar cada admin hardcodeado
        for (const adminId of hardcodedAdmins) {
            const isSuperAdmin = hardcodedSuperAdmins.includes(adminId);
            
            // Verificar si ya existe
            let user = await User.findOne({ where: { telegram_id: adminId } });
            
            if (user) {
                // Actualizar permisos si es necesario
                if (!user.is_admin || (isSuperAdmin && !user.is_super_admin)) {
                    await user.update({
                        is_admin: true,
                        is_super_admin: isSuperAdmin
                    });
                    console.log(`Permisos actualizados para admin hardcodeado ${adminId}`);
                }
            } else {
                // Crear nuevo admin hardcodeado
                await User.create({
                    telegram_id: adminId,
                    name: isSuperAdmin ? 'SuperAdmin' : 'Admin',
                    phone: 'N/A',
                    email: 'admin@sistema.com',
                    address: 'N/A',
                    is_admin: true,
                    is_super_admin: isSuperAdmin
                });
                console.log(`Nuevo admin hardcodeado creado: ${adminId}`);
            }
        }
        
        console.log('Sincronización de admins hardcodeados completada');
    } catch (error) {
        console.error('Error sincronizando admins hardcodeados:', error);
    }
}

// NUEVO: Función para migrar datos de administradores existentes
async function migrateExistingAdmins() {
    try {
        console.log('🔄 Iniciando migración de administradores existentes...');
        
        // Buscar todos los usuarios que podrían ser admins pero no tienen los flags correctos
        const allUsers = await User.findAll();
        let migratedCount = 0;
        
        for (const user of allUsers) {
            const isHardcodedSuperAdmin = SUPER_ADMIN_USER_IDS.includes(user.telegram_id);
            const isHardcodedAdmin = ADMIN_USER_IDS.includes(user.telegram_id);
            
            // Si es hardcodeado pero no tiene los permisos correctos, corregir
            if (isHardcodedSuperAdmin && (!user.is_admin || !user.is_super_admin)) {
                await user.update({
                    is_admin: true,
                    is_super_admin: true
                });
                console.log(`✅ Migrado superadmin hardcodeado: ${user.name} (${user.telegram_id})`);
                migratedCount++;
            } else if (isHardcodedAdmin && !isHardcodedSuperAdmin && (!user.is_admin || user.is_super_admin)) {
                await user.update({
                    is_admin: true,
                    is_super_admin: false
                });
                console.log(`✅ Migrado admin hardcodeado: ${user.name} (${user.telegram_id})`);
                migratedCount++;
            }
            
            // NUEVO: Buscar administradores que fueron creados manualmente antes
            // (tienen permisos pero pueden estar mal configurados)
            if ((user.is_admin || user.is_super_admin) && !isHardcodedAdmin && !isHardcodedSuperAdmin) {
                // Estos son admins creados manualmente - asegurar que estén bien configurados
                if (!user.is_admin) {
                    await user.update({ is_admin: true });
                    console.log(`✅ Corregido admin manual: ${user.name} (${user.telegram_id})`);
                    migratedCount++;
                }
            }
        }
        
        console.log(`🎉 Migración completada. ${migratedCount} administradores actualizados.`);
        
    } catch (error) {
        console.error('❌ Error en migración de admins:', error);
    }
}

// Obtener todos los administradores - MEJORADO
app.get('/api/admin/admins', async (req, res) => {
    try {
        console.log('Admin API: Obteniendo lista de administradores...');
        
        // NUEVO: Ejecutar migración y sincronización
        await migrateExistingAdmins();
        await syncHardcodedAdmins();
        
        const admins = await User.findAll({
            where: {
                [Op.or]: [
                    { is_admin: true },
                    { is_super_admin: true }
                ]
            },
            attributes: ['id', 'telegram_id', 'name', 'is_admin', 'is_super_admin', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        
        // MEJORADO: Convertir a formato esperado por el frontend con lógica corregida
        const formattedAdmins = admins.map(admin => {
            const isHardcodedSuperAdmin = SUPER_ADMIN_USER_IDS.includes(admin.telegram_id);
            const isHardcodedAdmin = ADMIN_USER_IDS.includes(admin.telegram_id);
            const isHardcoded = isHardcodedSuperAdmin || isHardcodedAdmin;
            
            return {
                id: admin.id,
                username: admin.name,
                telegram_id: admin.telegram_id,
                local: 'Tienda Principal', // Valor por defecto
                role: admin.is_super_admin ? 'Super Administrador' : 'Administrador',
                permission: admin.is_super_admin ? 'superadmin' : 'admin',
                created_at: admin.created_at,
                is_hardcoded: isHardcoded // CORREGIDO: basado en constantes reales
            };
        });
        
        console.log(`Admin API: Enviando ${formattedAdmins.length} administradores`);
        console.log('Desglose de admins:', {
            total: formattedAdmins.length,
            hardcoded: formattedAdmins.filter(a => a.is_hardcoded).length,
            manual: formattedAdmins.filter(a => !a.is_hardcoded).length,
            superadmins: formattedAdmins.filter(a => a.permission === 'superadmin').length
        });
        
        res.json(formattedAdmins);
        
    } catch (error) {
        console.error('Error en /api/admin/admins:', error);
        res.status(500).json({ error: error.message });
    }
});

// Crear nuevo administrador
app.post('/api/admin/admins', async (req, res) => {
    try {
        const { local, role, telegram_id } = req.body; // CORREGIDO: sin permission
        
        console.log('Creando nuevo administrador:', req.body);
        
        // Validar datos requeridos - CORREGIDO: sin permission
        if (!telegram_id || !local || !role) {
            return res.status(400).json({ 
                error: 'telegram_id, local y role son campos requeridos' 
            });
        }
        
        // VALIDAR: Verificar que el usuario existe en la base de datos (está registrado en el bot)
        const existingUser = await User.findOne({ where: { telegram_id } });
        if (!existingUser) {
            return res.status(400).json({ 
                error: `El usuario con ID ${telegram_id} no está registrado en el bot. El usuario debe usar el bot primero para registrarse.` 
            });
        }
        
        // Verificar que no sea ya un administrador
        if (existingUser.is_admin || existingUser.is_super_admin) {
            return res.status(400).json({ 
                error: 'Este usuario ya es administrador del sistema' 
            });
        }
        
        // Actualizar el usuario existente para convertirlo en admin regular (no super admin)
        const adminData = {
            is_admin: true,
            is_super_admin: false // CORREGIDO: siempre admin regular
        };
        
        await existingUser.update(adminData);
        
        // Retornar en formato esperado por el frontend usando el nombre real del usuario
        const formattedAdmin = {
            id: existingUser.id,
            username: existingUser.name, // Usar el nombre real del usuario registrado
            telegram_id: existingUser.telegram_id,
            local: local,
            role: role,
            permission: 'admin', // CORREGIDO: siempre admin
            created_at: existingUser.created_at,
            is_hardcoded: false
        };
        
        console.log(`Administrador creado: ${existingUser.name} (ID: ${existingUser.id})`);
        res.status(201).json(formattedAdmin);
        
    } catch (error) {
        console.error('Error creando administrador:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar administrador
app.put('/api/admin/admins/:id', async (req, res) => {
    try {
        const adminId = req.params.id;
        const { username, local, role, telegram_id, permission } = req.body;
        
        console.log(`Actualizando administrador ${adminId}:`, req.body);
        
        const admin = await User.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }
        
        // Verificar que no exista otro usuario con ese telegram_id
        if (telegram_id && telegram_id !== admin.telegram_id) {
            const existingUser = await User.findOne({ 
                where: { 
                    telegram_id,
                    id: { [sequelize.Op.ne]: adminId }
                }
            });
            if (existingUser) {
                return res.status(400).json({ 
                    error: 'Ya existe otro usuario con ese ID de Telegram' 
                });
            }
        }
        
        // Actualizar datos del administrador
        const updateData = {
            name: username || admin.name,
            telegram_id: telegram_id ? parseInt(telegram_id) : admin.telegram_id,
            is_admin: true,
            is_super_admin: permission === 'superadmin'
        };
        
        await admin.update(updateData);
        
        // Retornar en formato esperado por el frontend
        const formattedAdmin = {
            id: admin.id,
            username: admin.name,
            telegram_id: admin.telegram_id,
            local: local || 'Tienda Principal',
            role: role || (permission === 'superadmin' ? 'Super Administrador' : 'Administrador'),
            permission: permission || (admin.is_super_admin ? 'superadmin' : 'admin'),
            created_at: admin.created_at
        };
        
        console.log(`Administrador actualizado: ${admin.name}`);
        res.json(formattedAdmin);
        
    } catch (error) {
        console.error('Error actualizando administrador:', error);
        res.status(500).json({ error: error.message });
    }
});

// NUEVO: Endpoint para verificar si un usuario es administrador
app.post('/api/admin/verify', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        
        if (!telegram_id) {
            return res.status(400).json({ 
                isAdmin: false, 
                error: 'telegram_id es requerido' 
            });
        }
        
        // Verificar si es admin hardcodeado
        if (SUPER_ADMIN_USER_IDS.includes(telegram_id)) {
            return res.json({ 
                isAdmin: true, 
                isSuperAdmin: true,
                source: 'hardcoded'
            });
        }
        
        if (ADMIN_USER_IDS.includes(telegram_id)) {
            return res.json({ 
                isAdmin: true, 
                isSuperAdmin: false,
                source: 'hardcoded'
            });
        }
        
        // Verificar en base de datos
        const user = await User.findOne({ where: { telegram_id } });
        
        if (!user) {
            return res.status(401).json({ 
                isAdmin: false, 
                error: 'Usuario no encontrado' 
            });
        }
        
        if (user.is_admin || user.is_super_admin) {
            return res.json({ 
                isAdmin: true, 
                isSuperAdmin: user.is_super_admin,
                source: 'database',
                user: {
                    id: user.id,
                    name: user.name,
                    telegram_id: user.telegram_id
                }
            });
        }
        
        return res.status(401).json({ 
            isAdmin: false, 
            error: 'Usuario no tiene permisos de administrador' 
        });
        
    } catch (error) {
        console.error('Error verificando admin:', error);
        res.status(500).json({ 
            isAdmin: false, 
            error: 'Error del servidor' 
        });
    }
});

// Eliminar administrador - CORREGIDO: eliminar rol, no usuario
app.delete('/api/admin/admins/:id', async (req, res) => {
    try {
        const adminId = req.params.id;
        
        console.log(`Eliminando rol de administrador ${adminId}`);
        
        const admin = await User.findByPk(adminId);
        if (!admin) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }
        
        // CORREGIDO: Verificar si es un admin hardcodeado del SISTEMA (no añadido manualmente)
        // Solo bloquear eliminación si el admin fue creado automáticamente por sincronización
        const isSystemSuperAdmin = SUPER_ADMIN_USER_IDS.includes(admin.telegram_id);
        const isSystemAdmin = ADMIN_USER_IDS.includes(admin.telegram_id);
        
        // NUEVO: Verificar si es un admin del sistema (campos específicos que indican creación automática)
        const isSystemCreated = (admin.phone === 'N/A' || admin.phone === 'Sistema') && 
                               (admin.email === 'admin@sistema.com' || admin.email.includes('@sistema.com')) &&
                               (admin.address === 'N/A' || admin.address === 'Sistema');
        
        // Solo bloquear eliminación si es TANTO hardcodeado COMO creado por el sistema
        if (isSystemSuperAdmin && isSystemCreated) {
            return res.status(400).json({ 
                error: 'No se puede eliminar un super administrador del sistema' 
            });
        }
        
        if (isSystemAdmin && !isSystemSuperAdmin && isSystemCreated) {
            return res.status(400).json({ 
                error: 'No se puede eliminar un administrador del sistema' 
            });
        }
        
        console.log(`Eliminando rol de administrador para: ${admin.name} (ID: ${admin.id})`);
        console.log(`- Es hardcodeado: ${isSystemAdmin || isSystemSuperAdmin}`);
        console.log(`- Es del sistema: ${isSystemCreated}`);
        console.log(`- Permitir eliminación: ${!(isSystemCreated && (isSystemAdmin || isSystemSuperAdmin))}`);
        
        // CORREGIDO: Solo remover permisos de admin, no eliminar el usuario
        await admin.update({
            is_admin: false,
            is_super_admin: false
        });
        
        console.log(`Rol de administrador eliminado para ${admin.name}. El usuario se mantiene registrado.`);
        
        res.json({ 
            message: 'Rol de administrador eliminado exitosamente. El usuario se mantiene registrado en el sistema.' 
        });
    } catch (error) {
        console.error('Error eliminando rol de administrador:', error);
        res.status(500).json({ error: error.message });
    }
});

// Middleware de manejo de errores globales
app.use((err, req, res, next) => {
    console.error('Error capturado:', err);
    
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ 
            error: 'Error de restricción en la base de datos',
            details: err.message 
        });
    }
    
    if (err.code === 'ENOENT') {
        return res.status(404).json({ 
            error: 'Archivo no encontrado',
            details: err.message 
        });
    }
    
    res.status(500).json({ 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Contacte al administrador'
    });
});

// Middleware para capturar rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        details: `${req.method} ${req.originalUrl}`
    });
});

// Sincronizar base de datos y iniciar servidor
sequelize.sync({ force: false }).then(() => {
    console.log('Base de datos sincronizada');
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
}).catch(error => {
    console.error('Error al sincronizar la base de datos:', error);
});

module.exports = app;