import os
import logging
import datetime
from typing import Dict, Any

# Configuración de logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Importaciones para Telegram
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, MessageHandler, 
    ConversationHandler, ContextTypes, filters
)

# Importaciones para base de datos
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, scoped_session
from dotenv import load_dotenv
from datetime import datetime, timezone

###########################################
# CONFIGURACIÓN
###########################################

# Cargar variables de entorno
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
dotenv_path = os.path.join(project_root, '.env.local')

print(f"Buscando .env.local en: {dotenv_path}")
if os.path.exists(dotenv_path):
    print(".env.local existe!")
else:
    print("¡ADVERTENCIA! .env.local NO existe en esa ruta")

load_dotenv(dotenv_path)

# Token de Telegram
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

# Lista de IDs de administradores (DEBE COINCIDIR EXACTAMENTE CON server.js)
SUPER_ADMIN_USER_IDS = [1870169979, 743216859]
ADMIN_USER_IDS = []

# URLs de las WebApps
BASE_URL = "https://f930-185-107-56-135.ngrok-free.app"
CATALOG_WEBAPP_URL = f"{BASE_URL}/catalog"
APPOINTMENTS_WEBAPP_URL = f"{BASE_URL}/appointments"
ADMIN_WEBAPP_URL = f"{BASE_URL}/admin"
WEBAPP_BASE_URL = BASE_URL  # Agregado para mayor claridad

# URL de la encuesta de calificación
RATING_SURVEY_URL = "https://tally.so/r/mYKroq"

# Configuración de la base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///store_bot.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"} if DATABASE_URL.startswith("postgresql") else {},
    echo=False
)

###########################################
# FUNCIONES AUXILIARES PARA FECHAS
###########################################

def get_current_datetime():
    """Retorna la fecha y hora actual en formato consistente sin timezone"""
    from datetime import datetime
    # Retornar objeto datetime directamente para SQLAlchemy
    return datetime.utcnow()

###########################################
# MODELOS DE BASE DE DATOS
###########################################

Base = declarative_base()

class User(Base):
    """Modelo para almacenar información de los usuarios"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(Integer, unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(100), nullable=False)
    address = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=get_current_datetime)
    is_admin = Column(Boolean, default=False)
    is_super_admin = Column(Boolean, default=False)
    
    appointments = relationship("Appointment", back_populates="user")

class Product(Base):
    """Modelo para almacenar productos"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    image_url = Column(String(200))
    category = Column(String(50))
    brand = Column(String(50))  # Add missing brand column
    stock = Column(Integer, default=0)
    colors = Column(Text)  # Add missing colors column (stored as JSON text)
    sizes = Column(Text)   # Add missing sizes column (stored as JSON text)
    created_at = Column(DateTime, default=get_current_datetime)

class Appointment(Base):
    """Modelo para almacenar citas"""
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    date = Column(String(10), nullable=False)
    time = Column(String(5), nullable=False)
    reason = Column(String(100), nullable=False)
    notes = Column(Text)
    status = Column(String(20), default='pending')
    created_at = Column(DateTime, default=get_current_datetime)
    updated_at = Column(DateTime, default=get_current_datetime)  # Add missing updated_at column

    user = relationship("User", back_populates="appointments")

###########################################
# ADMINISTRACIÓN DE BASE DE DATOS
###########################################

Session = scoped_session(sessionmaker(bind=engine))

def init_db():
    """Inicializa la base de datos creando todas las tablas"""
    try:
        Base.metadata.create_all(engine)
        logger.info("Base de datos inicializada correctamente")
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos: {e}")

def get_session():
    """Obtiene una sesión de la base de datos"""
    return Session()

# NUEVO: Funciones mejoradas para manejo de administradores híbridos
def get_all_admin_ids():
    """Obtiene todos los IDs de administradores (hardcodeados + base de datos)"""
    admin_ids = set(ADMIN_USER_IDS + SUPER_ADMIN_USER_IDS)
    
    try:
        session = get_session()
        db_admins = session.query(User).filter(
            (User.is_admin == True) | (User.is_super_admin == True)
        ).all()
        
        for admin in db_admins:
            admin_ids.add(admin.telegram_id)
        
        session.close()
        return list(admin_ids)
    except Exception as e:
        logger.error(f"Error al obtener admins de la base de datos: {e}")
        return list(admin_ids)

def is_admin(user_id):
    """Verifica si un usuario es administrador (hardcodeado O base de datos)"""
    # Primero verificar administradores hardcodeados
    if user_id in ADMIN_USER_IDS or user_id in SUPER_ADMIN_USER_IDS:
        return True
    
    # Luego verificar en la base de datos
    try:
        user_data = get_user(user_id)
        if user_data:
            return user_data.get('is_admin', False) or user_data.get('is_super_admin', False)
        return False
    except Exception as e:
        logger.error(f"Error al verificar si es admin: {e}")
        return False

def is_super_admin(user_id):
    """Verifica si un usuario es superadministrador (hardcodeado O base de datos)"""
    # Primero verificar superadmins hardcodeados
    if user_id in SUPER_ADMIN_USER_IDS:
        return True
    
    # Luego verificar en la base de datos
    try:
        user_data = get_user(user_id)
        if user_data:
            return user_data.get('is_super_admin', False)
        return False
    except Exception as e:
        logger.error(f"Error al verificar si es super admin: {e}")
        return False

def sync_hardcoded_admins_to_db():
    """Sincroniza administradores hardcodeados con la base de datos"""
    session = get_session()
    try:
        # Sincronizar super admins hardcodeados
        for admin_id in SUPER_ADMIN_USER_IDS:
            # Usar query SQL directo para evitar problemas de formato de fecha
            try:
                result = session.execute(
                    text("SELECT id, is_super_admin, is_admin FROM users WHERE telegram_id = :telegram_id"),
                    {"telegram_id": admin_id}
                ).fetchone()
                
                if result:
                    # Usuario existe, verificar y actualizar permisos si es necesario
                    user_id, is_super_admin, is_admin = result
                    if not is_super_admin or not is_admin:
                        session.execute(
                            text("UPDATE users SET is_super_admin = :is_super_admin, is_admin = :is_admin WHERE telegram_id = :telegram_id"),
                            {"is_super_admin": True, "is_admin": True, "telegram_id": admin_id}
                        )
                        logger.info(f"Permisos actualizados para super admin hardcodeado {admin_id}")
                else:
                    # Usuario no existe, crear uno básico usando query SQL directo
                    session.execute(
                        text("""INSERT INTO users (telegram_id, name, phone, email, address, is_super_admin, is_admin, created_at) 
                             VALUES (:telegram_id, :name, :phone, :email, :address, :is_super_admin, :is_admin, :created_at)"""),
                        {
                            "telegram_id": admin_id,
                            "name": f"SuperAdmin_{admin_id}",
                            "phone": "Sistema",
                            "email": f"superadmin_{admin_id}@sistema.com",
                            "address": "Sistema",
                            "is_super_admin": True,
                            "is_admin": True,
                            "created_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                        }
                    )
                    logger.info(f"Creado usuario para super admin hardcodeado {admin_id}")
            except Exception as e:
                logger.error(f"Error procesando super admin {admin_id}: {e}")
                continue
        
        # Sincronizar admins regulares hardcodeados
        for admin_id in ADMIN_USER_IDS:
            if admin_id not in SUPER_ADMIN_USER_IDS:  # Evitar duplicados
                try:
                    result = session.execute(
                        text("SELECT id, is_admin FROM users WHERE telegram_id = :telegram_id"),
                        {"telegram_id": admin_id}
                    ).fetchone()
                    
                    if result:
                        # Usuario existe, verificar y actualizar permisos si es necesario
                        user_id, is_admin = result
                        if not is_admin:
                            session.execute(
                                text("UPDATE users SET is_admin = :is_admin WHERE telegram_id = :telegram_id"),
                                {"is_admin": True, "telegram_id": admin_id}
                            )
                            logger.info(f"Permisos actualizados para admin hardcodeado {admin_id}")
                    else:
                        # Usuario no existe, crear uno básico usando query SQL directo
                        session.execute(
                            text("""INSERT INTO users (telegram_id, name, phone, email, address, is_admin, is_super_admin, created_at) 
                                 VALUES (:telegram_id, :name, :phone, :email, :address, :is_admin, :is_super_admin, :created_at)"""),
                            {
                                "telegram_id": admin_id,
                                "name": f"Admin_{admin_id}",
                                "phone": "Sistema", 
                                "email": f"admin_{admin_id}@sistema.com",
                                "address": "Sistema",
                                "is_admin": True,
                                "is_super_admin": False,
                                "created_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                            }
                        )
                        logger.info(f"Creado usuario para admin hardcodeado {admin_id}")
                except Exception as e:
                    logger.error(f"Error procesando admin {admin_id}: {e}")
                    continue
        
        session.commit()
        logger.info("Sincronización de administradores hardcodeados completada exitosamente")
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error al sincronizar administradores hardcodeados: {e}")
    finally:
        session.close()

def get_admin_info(user_id):
    """Obtiene información detallada de un administrador"""
    # Verificar si es hardcodeado
    is_hardcoded_super = user_id in SUPER_ADMIN_USER_IDS
    is_hardcoded_admin = user_id in ADMIN_USER_IDS
    
    user_data = get_user(user_id)
    
    return {
        'is_admin': is_admin(user_id),
        'is_super_admin': is_super_admin(user_id),
        'is_hardcoded': is_hardcoded_super or is_hardcoded_admin,
        'permission_source': 'hardcoded' if (is_hardcoded_super or is_hardcoded_admin) else 'database',
        'user_data': user_data
    }

def save_user(telegram_id, name, phone, email, address):
    """Guarda un nuevo usuario en la base de datos"""
    session = get_session()
    try:
        # Verificar si ya existe
        existing_user = session.query(User).filter_by(telegram_id=telegram_id).first()
        if existing_user:
            logger.info(f"Usuario {telegram_id} ya existe, no se crea duplicado")
            return True
            
        user = User(
            telegram_id=telegram_id,
            name=name,
            phone=phone,
            email=email,
            address=address
        )
        session.add(user)
        session.commit()
        logger.info(f"Usuario {telegram_id} guardado exitosamente")
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error al guardar usuario: {e}")
        return False
    finally:
        session.close()

def user_exists(telegram_id):
    """Verifica si un usuario existe en la base de datos"""
    session = get_session()
    try:
        # Usar query SQL directo para evitar problemas de formato de fecha
        result = session.execute(
            text("SELECT 1 FROM users WHERE telegram_id = :telegram_id LIMIT 1"), 
            {"telegram_id": telegram_id}
        ).fetchone()
        return result is not None
    except Exception as e:
        logger.error(f"Error al verificar si usuario existe {telegram_id}: {e}")
        return False
    finally:
        session.close()

def get_user(telegram_id):
    """Obtiene información de un usuario por su ID de Telegram"""
    session = get_session()
    try:
        # Usar query SQL directo para evitar problemas de formato de fecha
        result = session.execute(
            text("SELECT id, telegram_id, name, phone, email, address, is_admin, is_super_admin "
                 "FROM users WHERE telegram_id = :telegram_id"), 
            {"telegram_id": telegram_id}
        ).fetchone()
        
        if result:
            return {
                'id': result[0],
                'name': result[2] if result[2] else '',
                'phone': result[3] if result[3] else '',
                'email': result[4] if result[4] else '',
                'address': result[5] if result[5] else '',
                'is_admin': bool(result[6]) if result[6] is not None else False,
                'is_super_admin': bool(result[7]) if result[7] is not None else False
            }
        return None
    except Exception as e:
        logger.error(f"Error al obtener usuario {telegram_id}: {e}")
        return None
    finally:
        session.close()

def update_user(telegram_id, **kwargs):
    """Actualiza la información de un usuario"""
    session = get_session()
    try:
        user = session.query(User).filter_by(telegram_id=telegram_id).first()
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            session.commit()
            logger.info(f"Usuario {telegram_id} actualizado exitosamente")
            return True
        return False
    except Exception as e:
        session.rollback()
        logger.error(f"Error al actualizar usuario: {e}")
        return False
    finally:
        session.close()

def user_is_completely_registered(telegram_id):
    """Verifica si un usuario tiene todos los datos necesarios"""
    # EXCEPCIÓN PARA SUPERUSUARIOS Y ADMINS - SIEMPRE ESTÁN COMPLETAMENTE REGISTRADOS
    if telegram_id in SUPER_ADMIN_USER_IDS or telegram_id in ADMIN_USER_IDS:
        return True
    
    user_data = get_user(telegram_id)
    if not user_data:
        return False
    
    # También verificar si es admin/superadmin por base de datos
    if user_data.get('is_admin', False) or user_data.get('is_super_admin', False):
        return True
    
    required_fields = ['name', 'phone', 'email', 'address']
    for field in required_fields:
        value = user_data.get(field)
        if not value or value.strip() == '' or value.strip() == 'N/A':
            return False
    
    # Validaciones específicas adicionales
    name = user_data.get('name', '').strip()
    phone = user_data.get('phone', '').strip()
    email = user_data.get('email', '').strip()
    address = user_data.get('address', '').strip()
    
    # Validar longitud mínima del nombre
    if len(name) < 2:
        return False
    
    # Validar teléfono (permitir números con espacios, guiones y paréntesis)
    phone_clean = ''.join(filter(str.isdigit, phone))  # Extraer solo dígitos
    if len(phone_clean) < 8 or len(phone_clean) > 15:
        return False
    
    # Validar email básico
    if '@' not in email or '.' not in email.split('@')[-1]:
        return False
    
    # Validar longitud mínima de dirección
    if len(address) < 10:
        return False
    
    return True

def create_or_update_superadmin(user_id, username):
    """Crea o actualiza un superadministrador en la base de datos"""
    session = get_session()
    try:
        user = session.query(User).filter_by(telegram_id=user_id).first()
        
        if user:
            # Usuario existe, actualizar permisos
            user.is_super_admin = True
            user.is_admin = True
            logger.info(f"Permisos de superadmin actualizados para usuario {user_id}")
        else:
            # Usuario no existe, crear nuevo
            user = User(
                telegram_id=user_id,
                name=username or "SuperAdmin",
                phone="N/A",
                email="admin@sistema.com",
                address="N/A",
                is_super_admin=True,
                is_admin=True
            )
            session.add(user)
            logger.info(f"Nuevo superadmin creado para usuario {user_id}")
        
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error al crear/actualizar superadmin: {e}")
        return False
    finally:
        session.close()

###########################################
# FUNCIONES PARA REGISTRO
###########################################

def get_register_url(user_id, return_url=None):
    """Genera la URL de registro con parámetros necesarios"""
    register_url = f"{BASE_URL}/register?user_id={user_id}"
    if return_url:
        register_url += f"&return_url={return_url}"
    return register_url

def get_edit_info_url(user_id):
    """Generar URL para webapp de edición de información de usuario"""
    return f"{WEBAPP_BASE_URL}/edit?user_id={user_id}"

###########################################
# TECLADOS
###########################################

def get_main_keyboard(is_admin=False):
    """Retorna el teclado principal para usuarios normales"""
    keyboard = [
        [KeyboardButton("📋 Información")],
        [KeyboardButton("🛍️ Catálogo"), KeyboardButton("📅 Agendar Cita")],
        [KeyboardButton("⭐ Calificar Experiencia"), KeyboardButton("❓ Ayuda")],
        [KeyboardButton("📞 Contacto")]
    ]

    if is_admin:
        keyboard.append([KeyboardButton("🔐 Panel Admin")])
    
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def get_admin_keyboard():
    """Retorna el teclado para administradores - solo panel admin"""
    keyboard = [
        [InlineKeyboardButton("🖥️ Panel de Administración", web_app={"url": ADMIN_WEBAPP_URL})],
        [InlineKeyboardButton("Volver", callback_data="back_to_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_edit_webapp_keyboard(user_id):
    """Retorna el teclado con la webapp para editar información"""
    keyboard = [
        [InlineKeyboardButton("✏️ Editar mi Información", web_app={"url": get_edit_info_url(user_id)})],
        [InlineKeyboardButton("Volver", callback_data="back_to_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_admin_webapp_keyboard():
    """Retorna el teclado para administradores con acceso a todas las webapps"""
    keyboard = [
        [InlineKeyboardButton("🛍️ Ver Catálogo", web_app={"url": CATALOG_WEBAPP_URL})],
        [InlineKeyboardButton("📅 Ver Citas", web_app={"url": APPOINTMENTS_WEBAPP_URL})],
        [InlineKeyboardButton("🖥️ Panel de Administración", web_app={"url": ADMIN_WEBAPP_URL})],
        [InlineKeyboardButton("Volver", callback_data="back_to_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_webapp_keyboard_with_registration_check(user_id):
    """Retorna el teclado con botones para las WebApps, verificando si el usuario está registrado"""
    if not user_is_completely_registered(user_id):
        keyboard = [
            [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
            [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
        ]
    else:
        # Solo mostrar los botones individuales cuando el usuario los solicite específicamente
        keyboard = [
            [InlineKeyboardButton("🛍️ Ver Catálogo", web_app={"url": f"{CATALOG_WEBAPP_URL}?user_id={user_id}"})],
            [InlineKeyboardButton("📅 Agendar Cita", web_app={"url": f"{APPOINTMENTS_WEBAPP_URL}?user_id={user_id}"})],
            [InlineKeyboardButton("Volver", callback_data="back_to_main")]
        ]
    
    return InlineKeyboardMarkup(keyboard)

def get_catalog_webapp_keyboard(user_id):
    """Retorna solo el botón del catálogo"""
    if not user_is_completely_registered(user_id):
        keyboard = [
            [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
            [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
        ]
    else:
        keyboard = [
            [InlineKeyboardButton("🛍️ Ver Catálogo", web_app={"url": f"{CATALOG_WEBAPP_URL}?user_id={user_id}"})],
            [InlineKeyboardButton("Volver", callback_data="back_to_main")]
        ]
    
    return InlineKeyboardMarkup(keyboard)

def get_appointments_webapp_keyboard(user_id):
    """Retorna solo el botón de citas"""
    if not user_is_completely_registered(user_id):
        keyboard = [
            [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
            [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
        ]
    else:
        keyboard = [
            [InlineKeyboardButton("📅 Agendar Cita", web_app={"url": f"{APPOINTMENTS_WEBAPP_URL}?user_id={user_id}"})],
            [InlineKeyboardButton("Volver", callback_data="back_to_main")]
        ]
    
    return InlineKeyboardMarkup(keyboard)

###########################################
# ESTADOS PARA CONVERSACIONES
###########################################

NAME, PHONE, EMAIL, ADDRESS = range(4)
EDIT_NAME, EDIT_PHONE, EDIT_EMAIL, EDIT_ADDRESS = range(4, 8)

###########################################
# MANEJADORES PRINCIPALES
###########################################

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para el comando /start"""
    user_id = update.effective_user.id
    logger.info(f"Comando /start recibido de usuario {user_id}")
    
    # Verificar si es superadministrador
    if user_id in SUPER_ADMIN_USER_IDS:
        logger.info(f"Superadministrador {user_id} detectado")
        
        # Crear o actualizar superadministrador
        if not user_exists(user_id):
            create_or_update_superadmin(user_id, update.effective_user.first_name)
        
        user_data = get_user(user_id)
        
        keyboard = get_main_keyboard(True)  # True para admin
        await update.message.reply_text(
            f"¡Bienvenido Super Admin {user_data['name']}!",
            reply_markup=keyboard
        )
        
        webapp_keyboard = get_admin_webapp_keyboard()
        await update.message.reply_text(
            "Acceso a aplicaciones (Super Admin):",
            reply_markup=webapp_keyboard
        )
        return ConversationHandler.END
    
    # Verificar si es administrador regular
    if user_id in ADMIN_USER_IDS:
        logger.info(f"Administrador {user_id} detectado")
        
        if not user_exists(user_id):
            await update.message.reply_text(
                "Eres administrador pero no tienes cuenta. Contacta al super administrador."
            )
            return ConversationHandler.END
        
        user_data = get_user(user_id)
        
        keyboard = get_main_keyboard(True)  # True para admin
        await update.message.reply_text(
            f"¡Bienvenido Admin {user_data['name']}!",
            reply_markup=keyboard
        )
        
        webapp_keyboard = get_admin_webapp_keyboard()
        await update.message.reply_text(
            "Acceso a aplicaciones (Admin):",
            reply_markup=webapp_keyboard
        )
        return ConversationHandler.END

    # Usuario regular - SIEMPRE mostrar teclado principal
    user_data = get_user(user_id)
    is_admin_user = user_id in ADMIN_USER_IDS or user_id in SUPER_ADMIN_USER_IDS or (user_data and user_data.get('is_admin', False))
    main_keyboard = get_main_keyboard(is_admin_user)
    
    # Verificar si el usuario existe y está completamente registrado
    if user_exists(user_id) and user_is_completely_registered(user_id):
        # Usuario completamente registrado - mensaje de bienvenida simple
        logger.info(f"Usuario {user_id} completamente registrado, mostrando bienvenida simple")
        
        await update.message.reply_text(
            f"¡Hola {user_data['name']}! 👋\n\n"
            f"Bienvenido de vuelta. Usa el menú para navegar por nuestros servicios.",
            reply_markup=main_keyboard
        )
        return ConversationHandler.END
    
    # Usuario con registro incompleto
    if user_exists(user_id):
        logger.info(f"Usuario {user_id} existe pero registro incompleto")
        
        # SIEMPRE enviar el teclado principal primero
        await update.message.reply_text(
            f"¡Hola de nuevo, {user_data['name']}! 👋\n\n"
            f"Puedes usar el menú para explorar nuestros servicios:",
            reply_markup=main_keyboard
        )
        
        # Luego el mensaje de registro incompleto
        keyboard = [
            [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
            [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            f"⚠️ *Tu registro está incompleto*\n\n"
            f"Para acceder a todas las funciones (Catálogo, Agendar Citas), "
            f"necesitas completar tu información.\n\n"
            f"📱 Haz clic en el botón de abajo para completar tu registro:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return ConversationHandler.END
    
    # Usuario no registrado
    logger.info(f"Usuario {user_id} no existe, mostrando bienvenida y registro")
    
    # SIEMPRE enviar el teclado principal primero
    await update.message.reply_text(
        f"¡Hola! 👋\n\n"
        f"Soy el bot de nuestra tienda. Puedes usar el menú para explorar nuestros servicios:",
        reply_markup=main_keyboard
    )
    
    # Crear teclado con enlace a webapp de registro
    keyboard = [
        [InlineKeyboardButton("📋 Registrarse", web_app={"url": get_register_url(user_id)})],
        [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"💡 *Para acceder a todas las funciones*\n\n"
        f"Para usar el catálogo y agendar citas, necesitas registrarte.\n\n"
        f"📱 Haz clic en el botón para completar tu registro:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    
    return ConversationHandler.END

async def name_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibido nombre: {update.message.text}")
    context.user_data['name'] = update.message.text
    await update.message.reply_text("Gracias. Ahora necesito tu número de teléfono:")
    return PHONE

async def phone_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibido teléfono: {update.message.text}")
    context.user_data['phone'] = update.message.text
    await update.message.reply_text("Perfecto. Ahora tu correo electrónico:")
    return EMAIL

async def email_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibido email: {update.message.text}")
    context.user_data['email'] = update.message.text
    await update.message.reply_text("Por último, necesito tu dirección de entrega:")
    return ADDRESS

async def address_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibida dirección: {update.message.text}")
    user_id = update.effective_user.id
    context.user_data['address'] = update.message.text
    
    if user_exists(user_id):
        logger.warning(f"Usuario {user_id} ya existe, no creando duplicado")
        user_data = get_user(user_id)
        if user_data:
            await update.message.reply_text(f"¡Bienvenido de nuevo, {user_data['name']}!")
        else:
            await update.message.reply_text("Error al obtener tus datos.")
        return ConversationHandler.END
    
    save_success = save_user(
        user_id, 
        context.user_data['name'], 
        context.user_data['phone'], 
        context.user_data['email'], 
        context.user_data['address']
    )
    
    is_admin_user = user_id in ADMIN_USER_IDS
    keyboard = get_main_keyboard(is_admin_user)
    
    if save_success:
        await update.message.reply_text(
            "¡Gracias! Tus datos han sido guardados correctamente.",
            reply_markup=keyboard
        )
        
        if BASE_URL.startswith("https://"):
            webapp_keyboard = get_webapp_keyboard_with_registration_check(user_id)
            await update.message.reply_text(
                "Ahora puedes acceder a nuestros servicios:",
                reply_markup=webapp_keyboard
            )
    else:
        await update.message.reply_text(
            "Hubo un problema al guardar tus datos. Por favor, intenta nuevamente.",
            reply_markup=keyboard
        )
    
    return ConversationHandler.END

async def why_register_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Explica por qué es necesario el registro"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    
    keyboard = [
        [InlineKeyboardButton("📋 Completar Registro Ahora", web_app={"url": get_register_url(user_id)})],
        [InlineKeyboardButton("Volver", callback_data="back_to_main")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "ℹ️ *¿Por qué necesitas completar tu registro?*\n\n"
        "Para brindarte el mejor servicio, necesitamos tu información para:\n\n"
        "• 📦 **Procesar pedidos**: Para enviar tus compras a la dirección correcta\n"
        "• 📅 **Agendar citas**: Para confirmar y recordarte tus citas\n"
        "• 📞 **Contactarte**: Para actualizaciones importantes sobre tus pedidos\n"
        "• ✨ **Personalizar**: Para ofrecerte una experiencia personalizada\n\n"
        "💡 *Tu información está segura y solo la usamos para mejorar tu experiencia.*",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def handle_text_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Maneja todos los mensajes de texto"""
    text = update.message.text
    user_id = update.effective_user.id
    
    # SIEMPRE asegurar que el usuario tenga el teclado principal
    user_data = get_user(user_id)
    is_admin_user = user_id in ADMIN_USER_IDS or user_id in SUPER_ADMIN_USER_IDS or (user_data and user_data.get('is_admin', False))
    main_keyboard = get_main_keyboard(is_admin_user)
    
    # Verificar si el usuario está completamente registrado
    is_completely_registered = user_exists(user_id) and user_is_completely_registered(user_id)
    
    # Manejar comando /start para usuarios ya registrados
    if text == "/start":
        await start_command(update, context)
        return

    if "Panel Admin" in text:
        if user_id in ADMIN_USER_IDS or user_id in SUPER_ADMIN_USER_IDS or (user_data and user_data.get('is_admin', False)):
            keyboard = get_admin_keyboard()
            await update.message.reply_text(
                "Panel de Administración. Selecciona una opción:",
                reply_markup=keyboard
            )
        else:
            await update.message.reply_text(
                "No tienes permisos para acceder a esta función.",
                reply_markup=main_keyboard
            )
        return

    if "Editar Información" in text:
        # Verificar que el usuario esté registrado
        if not user_exists(user_id):
            await update.message.reply_text(
                "❌ No tienes información registrada. Usa /start para registrarte primero.",
                reply_markup=main_keyboard
            )
            return
        
        # Crear webapp keyboard para editar información
        webapp_keyboard = get_edit_webapp_keyboard(user_id)
        await update.message.reply_text(
            "✏️ **Editar Información Personal**\n\n"
            "Se abrirá un formulario seguro donde podrás actualizar tus datos personales.\n\n"
            "💡 *Todos los campos son opcionales. Solo actualiza los que desees cambiar.*",
            reply_markup=webapp_keyboard,
            parse_mode='Markdown'
        )
        return

    if "Información" in text:
        if user_data and is_completely_registered:
            # Solo mostrar información y botón para editar en webapp
            keyboard = [
                [InlineKeyboardButton("✏️ Editar Información", web_app={"url": get_edit_info_url(user_id)})],
                [InlineKeyboardButton("Volver", callback_data="back_to_main")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                f"📝 *Tu información actual*\n\n"
                f"*Nombre:* {user_data['name']}\n"
                f"*Teléfono:* {user_data['phone']}\n"
                f"*Email:* {user_data['email']}\n"
                f"*Dirección:* {user_data['address']}\n"
                f"*ID de Telegram:* `{user_id}`\n\n"
                f"💡 *Para editar tu información, usa el botón 'Editar Información' que te llevará a un formulario seguro.*",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        else:
            # Usuario no registrado o registro incompleto
            if user_data:
                # Registro incompleto
                keyboard = [
                    [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
                    [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📝 *Tu información está incompleta*\n\n"
                    "Para ver y editar tu información completa, necesitas completar tu registro:",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
            else:
                # No registrado
                keyboard = [
                    [InlineKeyboardButton("📋 Registrarse", web_app={"url": get_register_url(user_id)})],
                    [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await update.message.reply_text(
                    "📝 *No tienes información registrada*\n\n"
                    "Para acceder a esta función, necesitas registrarte primero:",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
        return
    
    if "Catálogo" in text:
        if is_completely_registered:
            webapp_keyboard = get_catalog_webapp_keyboard(user_id)
            await update.message.reply_text(
                "🛍️ Accede a nuestro catálogo de productos:",
                reply_markup=webapp_keyboard
            )
        else:
            # Usuario no registrado o registro incompleto
            keyboard = [
                [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
                [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "🛍️ *Para acceder al catálogo necesitas estar registrado*\n\n"
                "Completa tu registro para ver nuestros productos y realizar compras:",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        return
    
    if "Agendar Cita" in text:
        if is_completely_registered:
            webapp_keyboard = get_appointments_webapp_keyboard(user_id)
            await update.message.reply_text(
                "📅 Agenda tu cita:",
                reply_markup=webapp_keyboard
            )
        else:
            # Usuario no registrado o registro incompleto
            keyboard = [
                [InlineKeyboardButton("📋 Completar Registro", web_app={"url": get_register_url(user_id)})],
                [InlineKeyboardButton("ℹ️ ¿Por qué necesito registrarme?", callback_data="why_register")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(
                "📅 *Para agendar citas necesitas estar registrado*\n\n"
                "Completa tu registro para poder agendar citas con nosotros:",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        return
    
    if "Calificar Experiencia" in text or "⭐" in text:
        # Crear teclado con enlace a la encuesta
        keyboard = [
            [InlineKeyboardButton("⭐ Ir a la Encuesta", url=RATING_SURVEY_URL)],
            [InlineKeyboardButton("Volver", callback_data="back_to_main")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "⭐ *Califica tu experiencia de compra*\n\n"
            "Tu opinión es muy importante para nosotros. Nos ayuda a mejorar nuestros productos y servicios.\n\n"
            "🔗 Haz clic en el botón de abajo para acceder a una breve encuesta donde puedes:\n\n"
            "• ⭐ Calificar tu experiencia general\n"
            "• 💭 Compartir comentarios y sugerencias\n"
            "• 🛍️ Evaluar la calidad de nuestros productos\n"
            "• 📦 Opinar sobre el proceso de compra\n\n"
            "💡 *La encuesta toma solo 2-3 minutos y es bastante sencilla de realizar.*",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return
    
    if "Ayuda" in text:
        help_text = (
            "ℹ️ *Ayuda - Cómo usar el bot*\n\n"
            "🛍️ *Catálogo*: Ver todos nuestros productos disponibles\n"
            "📅 *Agendar Cita*: Reservar una cita para atención personalizada\n"
            "📋 *Información*: Ver y editar tus datos personales\n"
            "⭐ *Calificar Experiencia*: Evalúa tu experiencia de compra\n"
            "📞 *Contacto*: Información para contactarnos\n\n"
            "💡 *Tip*: Puedes usar /start en cualquier momento para volver al menú principal"
        )
        await update.message.reply_text(
            help_text, 
            parse_mode='Markdown',
            reply_markup=main_keyboard
        )
        return

    if "Contacto" in text:
        contact_text = (
            "📞 *Información de Contacto*\n\n"
            "🏪 *Tienda*: Calle Principal #123\n"
            "📱 *Teléfono*: +1 234 567 8900\n"
            "📧 *Email*: info@tienda.com\n"
            "🕒 *Horarios*: Lun-Vie 9:00-18:00, Sáb 9:00-14:00\n\n"
            "¡Estamos aquí para ayudarte! 😊"
        )
        await update.message.reply_text(
            contact_text, 
            parse_mode='Markdown',
            reply_markup=main_keyboard
        )
        return

    # Si no coincide con ningún botón - ASEGURAR QUE SIEMPRE TENGAN EL TECLADO
    await update.message.reply_text(
        "No entiendo ese comando. Usa los botones del menú para navegar.",
        reply_markup=main_keyboard
    )

async def back_to_main_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Vuelve al menú principal"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    user_data = get_user(user_id)
    
    if user_data:
        is_admin_user = user_id in ADMIN_USER_IDS or user_data.get('is_admin', False)
        keyboard = get_main_keyboard(is_admin_user)
        
        # Cerrar el mensaje inline y enviar el teclado principal
        await query.edit_message_text(
            f"¡Hola {user_data['name']}! 👋\n\nSelecciona una opción:"
        )
        
        # Enviar un nuevo mensaje con el teclado principal - ESTO ES CRUCIAL
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="¿En qué puedo ayudarte?",
            reply_markup=keyboard
        )
    else:
        await query.edit_message_text("Error al obtener tus datos. Usa /start para reiniciar.")

async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Comando para enviar mensajes masivos (solo administradores)"""
    user_id = update.effective_user.id
    
    if not is_super_admin(user_id):
        await update.message.reply_text("No tienes permisos para usar este comando.")
        return
    
    # Obtener el mensaje a enviar
    message_text = ' '.join(context.args)
    
    if not message_text:
        await update.message.reply_text(
            "Uso: /broadcast <mensaje>\n\n"
            "Ejemplo: /broadcast ¡Nuevos productos disponibles!"
        )
        return
    
    # Confirmar antes de enviar
    keyboard = [
        [InlineKeyboardButton("✅ Confirmar Envío", callback_data="confirm_broadcast")],
        [InlineKeyboardButton("❌ Cancelar", callback_data="cancel_broadcast")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Guardar el mensaje en user_data
    context.user_data['broadcast_message'] = message_text
    
    await update.message.reply_text(
        f"*Confirmar envío masivo*\n\n"
        f"*Mensaje a enviar:*\n{message_text}\n\n"
        f"¿Estás seguro de que quieres enviar este mensaje a todos los usuarios?",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def confirm_broadcast_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Confirma y ejecuta el envío masivo"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    
    if not is_super_admin(user_id):
        await query.edit_message_text("No tienes permisos para esta acción.")
        return
    
    broadcast_message = context.user_data.get('broadcast_message')
    if not broadcast_message:
        await query.edit_message_text("Error: No se encontró el mensaje a enviar.")
        return
    
    # Obtener todos los usuarios
    session = get_session()
    try:
        users = session.query(User).all()
        total_users = len(users)
        sent_count = 0
        failed_count = 0
        
        await query.edit_message_text("📤 Enviando mensajes... Por favor espera.")
        
        for user in users:
            try:
                await context.bot.send_message(
                    chat_id=user.telegram_id,
                    text=f"📢 *Mensaje del administrador*\n\n{broadcast_message}",
                    parse_mode='Markdown'
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Error enviando mensaje a {user.telegram_id}: {e}")
                failed_count += 1
        
        # Reporte final
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text=f"✅ *Envío masivo completado*\n\n"
                 f"👥 Total de usuarios: {total_users}\n"
                 f"✅ Enviados exitosamente: {sent_count}\n"
                 f"❌ Fallos: {failed_count}",
            parse_mode='Markdown'
        )
        
    except Exception as e:
        logger.error(f"Error en broadcast: {e}")
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="❌ Error al ejecutar el envío masivo."
        )
    finally:
        session.close()

async def cancel_broadcast_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancela el envío masivo"""
    query = update.callback_query
    await query.answer()
    
    # Limpiar datos del broadcast
    if 'broadcast_message' in context.user_data:
        del context.user_data['broadcast_message']
    
    await query.edit_message_text("❌ Envío masivo cancelado.")

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Maneja errores globales del bot"""
    logger.error(f"Exception while handling an update: {context.error}")
    
    # Notificar al usuario si es posible
    if update and update.effective_chat:
        try:
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="❌ Ocurrió un error inesperado. Por favor, intenta nuevamente."
            )
        except Exception as e:
            logger.error(f"No se pudo enviar mensaje de error: {e}")

###########################################
# FUNCIÓN PRINCIPAL
###########################################

def main():
    """Función principal del bot"""
    if not TELEGRAM_TOKEN:
        logger.error("TELEGRAM_TOKEN no encontrado en las variables de entorno")
        return
    
    # Inicializar base de datos
    init_db()
    
    # NUEVO: Sincronizar administradores hardcodeados con la base de datos
    logger.info("Sincronizando administradores hardcodeados con la base de datos...")
    sync_hardcoded_admins_to_db()
    
    # Crear la aplicación
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # Crear el ConversationHandler para el registro
    registration_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start_command)],
        states={
            NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, name_handler)],
            PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, phone_handler)],
            EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, email_handler)],
            ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, address_handler)],
        },
        fallbacks=[CommandHandler("start", start_command)],
    )
    
    # Agregar manejadores
    application.add_handler(registration_handler)
    application.add_handler(CommandHandler("broadcast", broadcast_command))
    application.add_handler(CallbackQueryHandler(why_register_callback, pattern="^why_register$"))
    application.add_handler(CallbackQueryHandler(back_to_main_callback, pattern="^back_to_main$"))
    application.add_handler(CallbackQueryHandler(confirm_broadcast_callback, pattern="^confirm_broadcast$"))
    application.add_handler(CallbackQueryHandler(cancel_broadcast_callback, pattern="^cancel_broadcast$"))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_messages))
    
    # Agregar manejador de errores
    application.add_error_handler(error_handler)
    
    # Iniciar el bot
    logger.info("Iniciando bot...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()