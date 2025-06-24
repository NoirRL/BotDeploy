import pytest
import asyncio
import os
import sys
from unittest.mock import Mock, AsyncMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

# Agregar el directorio padre al path para importar el módulo bot
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Configurar base de datos de prueba en memoria
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    """Crear event loop para pruebas async"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_env():
    """Mock de variables de entorno"""
    with patch.dict(os.environ, {
        'TELEGRAM_TOKEN': 'test_token_123',
        'DATABASE_URL': TEST_DATABASE_URL
    }):
        yield

@pytest.fixture
def test_db_engine():
    """Engine de base de datos para pruebas"""
    from sqlalchemy import create_engine
    engine = create_engine(TEST_DATABASE_URL, echo=False)
    return engine

@pytest.fixture
def test_db_session(test_db_engine):
    """Sesión de base de datos para pruebas - SIN MODIFICAR LA SESIÓN GLOBAL"""
    # Importar aquí para evitar problemas de importación circular
    try:
        from bot.bot_main import Base
    except ImportError:
        # Si no se puede importar, crear Base aquí
        from sqlalchemy.ext.declarative import declarative_base
        Base = declarative_base()
    
    # Crear todas las tablas en la base de datos de prueba
    Base.metadata.create_all(test_db_engine)
    
    # Crear una sesión específica para esta prueba (NO reemplazar la global)
    TestSession = scoped_session(sessionmaker(bind=test_db_engine))
    
    yield TestSession
    
    # Limpiar después de la prueba
    TestSession.remove()
    Base.metadata.drop_all(test_db_engine)

@pytest.fixture
def mock_update():
    """Mock de Update de Telegram"""
    update = Mock()
    update.effective_user.id = 12345
    update.effective_user.first_name = "Test User"
    update.message.text = "/start"
    update.message.reply_text = AsyncMock()
    update.message.chat_id = 12345
    return update

@pytest.fixture
def mock_context():
    """Mock de Context de Telegram"""
    context = Mock()
    context.user_data = {}
    context.bot.send_message = AsyncMock()
    context.args = []
    return context

@pytest.fixture
def mock_callback_query():
    """Mock de CallbackQuery de Telegram"""
    query = Mock()
    query.answer = AsyncMock()
    query.edit_message_text = AsyncMock()
    query.message.chat_id = 12345
    return query