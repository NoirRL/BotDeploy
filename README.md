# BotDeploy 🤖

Una plataforma completa de comercio electrónico y reserva de citas, integrada directamente en **Telegram** mediante un bot conversacional y mini aplicaciones web (WebApps).

---

## 📋 Descripción

**BotDeploy** combina tres capas en un solo sistema:

| Capa | Tecnología | Rol |
|------|-----------|-----|
| **Bot de Telegram** | Python + python-telegram-bot | Interfaz conversacional para usuarios |
| **Servidor API** | Node.js + Express.js | Backend REST con gestión de datos |
| **WebApps** | HTML / CSS / JavaScript | Interfaces web embebidas en Telegram |

El sistema permite a los usuarios **registrarse**, **navegar un catálogo de productos**, **añadir artículos al carrito**, **generar pedidos** y **reservar citas**, todo sin salir de Telegram.

---

## ✨ Características principales

### 🤖 Bot de Telegram (`bot/bot_main.py`)
- **Registro guiado** paso a paso (nombre → teléfono → correo → dirección)
- **Menú principal** con botones de acceso rápido a catálogo, citas y perfil
- **Control de roles**: usuarios normales, administradores y súper administradores
- **Difusión de mensajes** a todos los usuarios registrados (solo admins)
- **Apertura de WebApps** directamente desde el chat

### 🖥️ Servidor REST (`server/server.js`)
- **Gestión de usuarios**: registro, consulta y actualización de perfiles
- **Gestión de productos**: CRUD completo con soporte de colores, tallas y stock
- **Gestión de citas**: creación, consulta y actualización de estado
- **Carrito de compras**: añadir/modificar artículos
- **Facturas / Pedidos**: generación de pedidos desde el carrito, seguimiento de estado
- **Panel de administración**: endpoints protegidos para gestión global
- Soporte para **SQLite** (desarrollo) y **PostgreSQL** (producción)

### 🌐 WebApps (Telegram Mini Apps)

| WebApp | Ruta | Descripción |
|--------|------|-------------|
| **Catálogo** | `/catalog` | Explorar productos, filtrar y añadir al carrito |
| **Citas** | `/appointments` | Ver, crear y cancelar citas |
| **Perfil** | `/edit` | Editar datos personales |
| **Registro** | `/register` | Formulario de alta de nuevos usuarios |
| **Admin** | `/admin` | Dashboard completo para administradores |

---

## 🏗️ Arquitectura

```
BotDeploy/
├── bot/
│   └── bot_main.py          # Lógica del bot de Telegram (Python)
├── server/
│   └── server.js            # API REST con Express.js (Node.js)
├── webapps/
│   ├── admin/               # Panel de administración
│   ├── register/            # Formulario de registro
│   └── user/
│       ├── appointments/    # Reserva de citas
│       ├── catalog/         # Catálogo de productos
│       └── edit/            # Editor de perfil
└── tests/                   # Suite de pruebas (pytest)
```

---

## 🛠️ Stack tecnológico

- **Python** — `python-telegram-bot`, `SQLAlchemy`, `pytest`
- **Node.js** — `Express.js`, `Sequelize`, `jsonwebtoken`, `bcrypt`
- **Base de datos** — SQLite (dev) / PostgreSQL (prod)
- **Frontend** — HTML5 + CSS3 + JavaScript vanilla + Telegram WebApp API

---

## 🚀 Inicio rápido

### Requisitos
- Python 3.10+
- Node.js 18+
- Un bot de Telegram (token de [@BotFather](https://t.me/BotFather))

### 1. Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
TELEGRAM_TOKEN=tu_token_aqui
DATABASE_URL=sqlite:///./botdeploy.db   # o URL de PostgreSQL
BASE_URL=https://tu-dominio.com          # URL pública del servidor
PORT=3000
```

### 2. Instalar dependencias

```bash
# Dependencias Node.js
npm install

# Dependencias Python
pip install -r requirements.txt
```

### 3. Migrar la base de datos

```bash
npm run migrate
```

### 4. Arrancar los servicios

```bash
# Servidor API
npm start

# Bot de Telegram (en otra terminal)
python bot/bot_main.py
```

---

## 🧪 Tests

```bash
pytest
```

La suite incluye tests unitarios, de integración y asíncronos para los handlers del bot, operaciones de base de datos y componentes de la UI.

---

## 🔒 Seguridad

- Contraseñas hasheadas con **bcrypt** / **passlib**
- Autenticación mediante **JWT**
- Secretos gestionados a través de variables de entorno (nunca en el repositorio)
- SSL habilitado cuando se usa PostgreSQL

---

## 📄 Licencia

Este proyecto es de uso privado. Todos los derechos reservados.
