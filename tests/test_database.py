import pytest
from unittest.mock import patch, Mock
import sys
import os

# Agregar el directorio del bot al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bot'))

from bot_main import (
    save_user, user_exists, get_user, update_user, 
    user_is_completely_registered, is_admin, is_super_admin,
    create_or_update_superadmin, get_current_datetime,
    ADMIN_USER_IDS, SUPER_ADMIN_USER_IDS
)

class TestDatabaseFunctions:
    """Pruebas para las funciones de base de datos"""
    
    def test_get_current_datetime(self):
        """Prueba que get_current_datetime retorna formato correcto"""
        result = get_current_datetime()
        assert isinstance(result, str)
        assert len(result) == 23  # Formato: YYYY-MM-DD HH:MM:SS.fff
        assert result[4] == '-'
        assert result[7] == '-'
        assert result[10] == ' '
        assert result[13] == ':'
        assert result[16] == ':'
        assert result[19] == '.'
    
    def test_save_user_new_user(self, test_db_session):
        """Prueba guardar un nuevo usuario"""
        telegram_id = 99999
        name = "Test User"
        phone = "12345678"
        email = "test@example.com"
        address = "Test Address"
        
        result = save_user(telegram_id, name, phone, email, address)
        
        assert result is True
        assert user_exists(telegram_id)
        
        user_data = get_user(telegram_id)
        assert user_data['name'] == name
        assert user_data['phone'] == phone
        assert user_data['email'] == email
        assert user_data['address'] == address
    
    def test_save_user_existing_user(self, test_db_session):
        """Prueba que no se cree duplicado de usuario existente"""
        telegram_id = 88888
        
        # Crear usuario inicial
        save_user(telegram_id, "User 1", "111", "a@test.com", "Address 1")
        
        # Intentar crear el mismo usuario otra vez
        result = save_user(telegram_id, "User 2", "222", "b@test.com", "Address 2")
        
        assert result is True
        
        # Verificar que los datos no cambiaron
        user_data = get_user(telegram_id)
        assert user_data['name'] == "User 1"
    
    def test_user_exists_true(self, test_db_session):
        """Prueba user_exists cuando el usuario existe"""
        telegram_id = 77777
        save_user(telegram_id, "Existing User", "123", "test@test.com", "Test")
        
        assert user_exists(telegram_id) is True
    
    def test_user_exists_false(self, test_db_session):
        """Prueba user_exists cuando el usuario no existe"""
        assert user_exists(99999999) is False
    
    def test_get_user_existing(self, test_db_session):
        """Prueba get_user para usuario existente"""
        telegram_id = 66666
        save_user(telegram_id, "Get User Test", "555", "get@test.com", "Get Address")
        
        user_data = get_user(telegram_id)
        
        assert user_data is not None
        assert user_data['name'] == "Get User Test"
        assert user_data['phone'] == "555"
        assert user_data['email'] == "get@test.com"
        assert user_data['address'] == "Get Address"
        assert user_data['is_admin'] is False
        assert user_data['is_super_admin'] is False
    
    def test_get_user_nonexistent(self, test_db_session):
        """Prueba get_user para usuario no existente"""
        user_data = get_user(99999999)
        assert user_data is None
    
    def test_update_user_success(self, test_db_session):
        """Prueba actualizar usuario exitosamente"""
        telegram_id = 55555
        save_user(telegram_id, "Original Name", "111", "old@test.com", "Old Address")
        
        result = update_user(telegram_id, name="Updated Name", email="new@test.com")
        
        assert result is True
        
        user_data = get_user(telegram_id)
        assert user_data['name'] == "Updated Name"
        assert user_data['email'] == "new@test.com"
        assert user_data['phone'] == "111"  # No cambió
        assert user_data['address'] == "Old Address"  # No cambió
    
    def test_update_user_nonexistent(self, test_db_session):
        """Prueba actualizar usuario que no existe"""
        result = update_user(99999999, name="New Name")
        assert result is False
    
    def test_user_is_completely_registered_admin(self):
        """Prueba que admins siempre están completamente registrados"""
        admin_id = ADMIN_USER_IDS[0]
        assert user_is_completely_registered(admin_id) is True
        
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        assert user_is_completely_registered(super_admin_id) is True
    
    def test_user_is_completely_registered_complete_user(self, test_db_session):
        """Prueba usuario completamente registrado"""
        telegram_id = 44444
        save_user(telegram_id, "Complete User", "123456789", "complete@test.com", "Complete Address")
        
        assert user_is_completely_registered(telegram_id) is True
    
    def test_user_is_completely_registered_incomplete_user(self, test_db_session):
        """Prueba usuario incompletamente registrado"""
        telegram_id = 33333
        save_user(telegram_id, "", "123", "test@test.com", "Address")  # Nombre vacío
        
        assert user_is_completely_registered(telegram_id) is False
    
    def test_user_is_completely_registered_nonexistent(self, test_db_session):
        """Prueba usuario que no existe"""
        assert user_is_completely_registered(99999999) is False
    
    def test_is_admin_by_id(self):
        """Prueba is_admin para IDs en lista de admins"""
        admin_id = ADMIN_USER_IDS[0]
        assert is_admin(admin_id) is True
        
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        assert is_admin(super_admin_id) is True
        
        regular_user = 99999999
        assert is_admin(regular_user) is False
    
    def test_is_admin_by_database(self, test_db_session):
        """Prueba is_admin para usuarios con permisos en BD"""
        telegram_id = 22222
        save_user(telegram_id, "Admin User", "123", "admin@test.com", "Admin Address")
        update_user(telegram_id, is_admin=True)
        
        assert is_admin(telegram_id) is True
    
    def test_is_super_admin_by_id(self):
        """Prueba is_super_admin para IDs en lista"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        assert is_super_admin(super_admin_id) is True
        
        regular_user = 99999999
        assert is_super_admin(regular_user) is False
    
    def test_is_super_admin_by_database(self, test_db_session):
        """Prueba is_super_admin para usuarios con permisos en BD"""
        telegram_id = 11111
        save_user(telegram_id, "Super Admin User", "123", "super@test.com", "Super Address")
        update_user(telegram_id, is_super_admin=True)
        
        assert is_super_admin(telegram_id) is True
    
    def test_create_or_update_superadmin_new(self, test_db_session):
        """Prueba crear nuevo superadmin"""
        telegram_id = 10101
        username = "New SuperAdmin"
        
        result = create_or_update_superadmin(telegram_id, username)
        
        assert result is True
        assert user_exists(telegram_id)
        
        user_data = get_user(telegram_id)
        assert user_data['name'] == username
        assert user_data['is_super_admin'] is True
        assert user_data['is_admin'] is True
    
    def test_create_or_update_superadmin_existing(self, test_db_session):
        """Prueba actualizar superadmin existente"""
        telegram_id = 20202
        save_user(telegram_id, "Regular User", "123", "user@test.com", "User Address")
        
        result = create_or_update_superadmin(telegram_id, "Updated SuperAdmin")
        
        assert result is True
        
        user_data = get_user(telegram_id)
        assert user_data['is_super_admin'] is True
        assert user_data['is_admin'] is True
        # El nombre original se mantiene
        assert user_data['name'] == "Regular User"

class TestDatabaseErrorHandling:
    """Pruebas para manejo de errores en base de datos"""
    
    @patch('bot_main.get_session')
    def test_save_user_database_error(self, mock_get_session):
        """Prueba manejo de error al guardar usuario"""
        mock_session = Mock()
        mock_session.query.side_effect = Exception("DB Error")
        mock_get_session.return_value = mock_session
        
        result = save_user(12345, "Test", "123", "test@test.com", "Address")
        
        assert result is False
        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()
    
    @patch('bot_main.get_session')
    def test_user_exists_database_error(self, mock_get_session):
        """Prueba manejo de error en user_exists"""
        mock_session = Mock()
        mock_session.query.side_effect = Exception("DB Error")
        mock_session.execute.return_value.fetchone.return_value = None
        mock_get_session.return_value = mock_session
        
        result = user_exists(12345)
        
        # Debe intentar con query SQL directo
        assert result is False
        mock_session.execute.assert_called_once()
    
    @patch('bot_main.get_session')
    def test_get_user_database_error(self, mock_get_session):
        """Prueba manejo de error en get_user"""
        mock_session = Mock()
        mock_session.query.side_effect = Exception("DB Error")
        mock_session.execute.return_value.fetchone.return_value = (1, 12345, "Test", "123", "test@test.com", "Address", False, False)
        mock_get_session.return_value = mock_session
        
        result = get_user(12345)
        
        # Debe usar query SQL directo
        assert result is not None
        assert result['name'] == "Test"
        mock_session.execute.assert_called_once()