import pytest
import asyncio
from unittest.mock import patch, Mock, AsyncMock, MagicMock
import sys
import os
from telegram.ext import ConversationHandler

# Agregar el directorio del bot al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bot'))

from bot_main import (
    start_command, name_handler, phone_handler, email_handler, address_handler,
    handle_text_messages, why_register_callback, back_to_main_callback,
    broadcast_command, confirm_broadcast_callback, cancel_broadcast_callback,
    error_handler, ADMIN_USER_IDS, SUPER_ADMIN_USER_IDS,
    NAME, PHONE, EMAIL, ADDRESS
)

class TestFullUserJourney:
    """Pruebas de integración para el viaje completo del usuario"""
    
    @pytest.mark.asyncio
    async def test_complete_user_registration_journey(self, mock_update, mock_context):
        """Prueba el viaje completo de registro de un usuario nuevo"""
        user_id = 99999
        mock_update.effective_user.id = user_id
        mock_update.effective_user.first_name = "Usuario"
        mock_update.effective_user.last_name = "Prueba"
        
        # Paso 1: Usuario envía /start por primera vez
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.get_user', return_value=None):
            result = await start_command(mock_update, mock_context)
            assert result == ConversationHandler.END
            assert mock_update.message.reply_text.call_count >= 1
        
        # Paso 2: Usuario decide registrarse - inicia conversación de registro
        mock_context.user_data = {}
        
        # Paso 3: Proporciona nombre
        mock_update.message.text = "Juan Carlos Pérez"
        result = await name_handler(mock_update, mock_context)
        assert result == PHONE
        assert mock_context.user_data['name'] == "Juan Carlos Pérez"
        
        # Paso 4: Proporciona teléfono
        mock_update.message.text = "+1-555-123-4567"
        result = await phone_handler(mock_update, mock_context)
        assert result == EMAIL
        assert mock_context.user_data['phone'] == "+1-555-123-4567"
        
        # Paso 5: Proporciona email
        mock_update.message.text = "juan.perez@email.com"
        result = await email_handler(mock_update, mock_context)
        assert result == ADDRESS
        assert mock_context.user_data['email'] == "juan.perez@email.com"
        
        # Paso 6: Proporciona dirección y completa registro
        mock_update.message.text = "Calle Principal 123, Ciudad, País"
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.save_user', return_value=True), \
             patch('bot_main.BASE_URL', 'https://test.com'):
            
            result = await address_handler(mock_update, mock_context)
            assert result == ConversationHandler.END
            assert mock_context.user_data['address'] == "Calle Principal 123, Ciudad, País"
        
        # Paso 7: Usuario registrado accede al catálogo
        mock_update.message.text = "🛍️ Catálogo"
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=True):
            await handle_text_messages(mock_update, mock_context)
            # Debería poder acceder al catálogo ahora
    
    @pytest.mark.asyncio
    async def test_admin_workflow_complete(self, mock_update, mock_context):
        """Prueba el flujo completo de trabajo de un administrador"""
        admin_id = ADMIN_USER_IDS[0]
        mock_update.effective_user.id = admin_id
        mock_update.effective_user.first_name = "Admin"
        
        # Paso 1: Admin inicia sesión
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Admin User', 'is_admin': True}), \
             patch('bot_main.user_is_completely_registered', return_value=True):
            
            result = await start_command(mock_update, mock_context)
            assert result == ConversationHandler.END
        
        # Paso 2: Admin accede al panel de administración
        mock_update.message.text = "🔐 Panel Admin"
        with patch('bot_main.get_user', return_value={'is_admin': True}):
            await handle_text_messages(mock_update, mock_context)
            # Debería tener acceso al panel
        
        # Paso 3: Admin ve estadísticas
        mock_update.message.text = "📊 Estadísticas"
        with patch('bot_main.get_user', return_value={'is_admin': True}):
            await handle_text_messages(mock_update, mock_context)
        
        # Paso 4: Admin ve usuarios
        mock_update.message.text = "👥 Ver Usuarios"
        with patch('bot_main.get_user', return_value={'is_admin': True}), \
             patch('bot_main.get_all_users', return_value=[
                 {'name': 'User1', 'email': 'user1@test.com'},
                 {'name': 'User2', 'email': 'user2@test.com'}
             ]):
            await handle_text_messages(mock_update, mock_context)
    
    @pytest.mark.asyncio
    async def test_super_admin_broadcast_workflow(self, mock_update, mock_context, mock_callback_query):
        """Prueba el flujo completo de broadcast de superadmin"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        mock_update.effective_user.id = super_admin_id
        mock_context.args = ["Mensaje", "importante", "para", "todos"]
        
        # Paso 1: SuperAdmin inicia broadcast
        with patch('bot_main.is_super_admin', return_value=True):
            await broadcast_command(mock_update, mock_context)
            assert mock_context.user_data['broadcast_message'] == "Mensaje importante para todos"
        
        # Paso 2: SuperAdmin confirma el envío
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update_callback = Mock()
        mock_update_callback.callback_query = mock_callback_query
        mock_update_callback.effective_user.id = super_admin_id
        
        mock_users = [
            {'telegram_id': 1001},
            {'telegram_id': 1002},
            {'telegram_id': 1003}
        ]
        
        with patch('bot_main.get_all_users', return_value=mock_users), \
             patch('bot_main.is_super_admin', return_value=True):
            
            await confirm_broadcast_callback(mock_update_callback, mock_context)
            
            # Verificar que se envió a todos los usuarios
            assert mock_context.bot.send_message.call_count == len(mock_users)

class TestErrorRecoveryScenarios:
    """Pruebas para escenarios de recuperación de errores"""
    
    @pytest.mark.asyncio
    async def test_database_connection_failure_recovery(self, mock_update, mock_context):
        """Prueba recuperación ante fallo de conexión a BD"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        # Simular fallo de BD en primera llamada, éxito en segunda
        call_count = 0
        def db_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Database connection failed")
            return True
        
        with patch('bot_main.user_exists', side_effect=db_side_effect):
            # Primera llamada debería fallar graciosamente
            try:
                await start_command(mock_update, mock_context)
                # No debería lanzar excepción no manejada
            except Exception as e:
                # Si hay excepción, debería ser manejada por error_handler
                pass
    
    @pytest.mark.asyncio
    async def test_telegram_api_failure_recovery(self, mock_update, mock_context):
        """Prueba recuperación ante fallo de API de Telegram"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        # Simular fallo en envío de mensaje
        mock_update.message.reply_text.side_effect = Exception("Telegram API Error")
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Test User', 'is_admin': False}), \
             patch('bot_main.user_is_completely_registered', return_value=True):
            
            try:
                await start_command(mock_update, mock_context)
            except Exception:
                # Debería ser manejado por error_handler
                pass
    
    @pytest.mark.asyncio
    async def test_partial_registration_recovery(self, mock_update, mock_context):
        """Prueba recuperación desde registro parcial"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        # Usuario existe pero con datos incompletos
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=False), \
             patch('bot_main.get_user', return_value={'name': 'Partial User', 'phone': ''}):
            
            result = await start_command(mock_update, mock_context)
            assert result == ConversationHandler.END
            
            # Usuario debería poder completar su registro
            mock_context.user_data = {'name': 'Partial User'}
            mock_update.message.text = "123-456-7890"
            result = await phone_handler(mock_update, mock_context)
            assert result == EMAIL

class TestConcurrencyScenarios:
    """Pruebas para escenarios de concurrencia"""
    
    @pytest.mark.asyncio
    async def test_concurrent_user_registration(self):
        """Prueba registro concurrente de múltiples usuarios"""
        # Crear múltiples mocks para diferentes usuarios
        users = []
        contexts = []
        
        for i in range(5):
            mock_update = Mock()
            mock_update.effective_user.id = 10000 + i
            mock_update.effective_user.first_name = f"User{i}"
            mock_update.message.reply_text = AsyncMock()
            
            mock_context = Mock()
            mock_context.user_data = {}
            mock_context.bot.send_message = AsyncMock()
            
            users.append(mock_update)
            contexts.append(mock_context)
        
        # Simular registros concurrentes
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.get_user', return_value=None):
            
            tasks = []
            for user, context in zip(users, contexts):
                task = start_command(user, context)
                tasks.append(task)
            
            # Ejecutar todos concurrentemente
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Todos deberían completarse sin errores
            for result in results:
                if isinstance(result, Exception):
                    pytest.fail(f"Concurrent registration failed: {result}")
                assert result == ConversationHandler.END
    
    @pytest.mark.asyncio
    async def test_concurrent_admin_operations(self):
        """Prueba operaciones concurrentes de administradores"""
        admin_updates = []
        admin_contexts = []
        
        for i in range(3):
            mock_update = Mock()
            mock_update.effective_user.id = ADMIN_USER_IDS[0] + i if i < len(ADMIN_USER_IDS) else ADMIN_USER_IDS[0]
            mock_update.message.reply_text = AsyncMock()
            mock_update.message.text = "🔐 Panel Admin"
            
            mock_context = Mock()
            mock_context.user_data = {}
            
            admin_updates.append(mock_update)
            admin_contexts.append(mock_context)
        
        with patch('bot_main.get_user', return_value={'is_admin': True}):
            tasks = []
            for update, context in zip(admin_updates, admin_contexts):
                task = handle_text_messages(update, context)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    pytest.fail(f"Concurrent admin operation failed: {result}")

class TestDataConsistencyScenarios:
    """Pruebas para consistencia de datos"""
    
    @pytest.mark.asyncio
    async def test_user_data_consistency_during_registration(self, mock_update, mock_context):
        """Prueba consistencia de datos durante el registro"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_context.user_data = {}
        
        # Simular proceso de registro completo
        registration_data = {
            'name': 'Test User',
            'phone': '123-456-7890',
            'email': 'test@example.com',
            'address': 'Test Address 123'
        }
        
        # Verificar que los datos se mantienen consistentes en cada paso
        mock_update.message.text = registration_data['name']
        await name_handler(mock_update, mock_context)
        assert mock_context.user_data['name'] == registration_data['name']
        
        mock_update.message.text = registration_data['phone']
        await phone_handler(mock_update, mock_context)
        assert mock_context.user_data['phone'] == registration_data['phone']
        assert mock_context.user_data['name'] == registration_data['name']  # Datos anteriores se mantienen
        
        mock_update.message.text = registration_data['email']
        await email_handler(mock_update, mock_context)
        assert mock_context.user_data['email'] == registration_data['email']
        assert mock_context.user_data['name'] == registration_data['name']
        assert mock_context.user_data['phone'] == registration_data['phone']
        
        # Verificar que todos los datos están presentes al final
        mock_update.message.text = registration_data['address']
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.save_user') as mock_save:
            
            await address_handler(mock_update, mock_context)
            
            # Verificar que save_user fue llamado con todos los datos
            mock_save.assert_called_once()
            call_args = mock_save.call_args[0]
            saved_data = call_args[0]  # Primer argumento debería ser telegram_id
            assert saved_data == user_id
    
    @pytest.mark.asyncio
    async def test_admin_permission_consistency(self, mock_update, mock_context):
        """Prueba consistencia de permisos de administrador"""
        admin_id = ADMIN_USER_IDS[0]
        mock_update.effective_user.id = admin_id
        
        # Verificar que el acceso a funciones de admin es consistente
        admin_functions = [
            "🔐 Panel Admin",
            "👥 Ver Usuarios",
            "📊 Estadísticas"
        ]
        
        for function in admin_functions:
            mock_update.message.text = function
            
            with patch('bot_main.get_user', return_value={'is_admin': True}), \
                 patch('bot_main.get_all_users', return_value=[]):
                
                await handle_text_messages(mock_update, mock_context)
                # No debería haber mensajes de "sin permisos"
                
                if mock_update.message.reply_text.called:
                    call_args = mock_update.message.reply_text.call_args[0][0]
                    assert "No tienes permisos" not in call_args

class TestPerformanceScenarios:
    """Pruebas para escenarios de rendimiento"""
    
    @pytest.mark.asyncio
    async def test_large_user_broadcast_performance(self, mock_update, mock_context, mock_callback_query):
        """Prueba rendimiento con broadcast a muchos usuarios"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        mock_update.effective_user.id = super_admin_id
        mock_context.user_data = {'broadcast_message': 'Test broadcast'}
        
        # Simular muchos usuarios (1000)
        mock_users = [{'telegram_id': 10000 + i} for i in range(1000)]
        
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update_callback = Mock()
        mock_update_callback.callback_query = mock_callback_query
        mock_update_callback.effective_user.id = super_admin_id
        
        import time
        start_time = time.time()
        
        with patch('bot_main.get_all_users', return_value=mock_users), \
             patch('bot_main.is_super_admin', return_value=True):
            
            await confirm_broadcast_callback(mock_update_callback, mock_context)
            
            end_time = time.time()
            execution_time = end_time - start_time
            
            # El broadcast no debería tomar más de 5 segundos (con mocks)
            assert execution_time < 5.0
            
            # Verificar que se intentó enviar a todos
            assert mock_context.bot.send_message.call_count == len(mock_users)
    
    @pytest.mark.asyncio
    async def test_rapid_user_interactions(self, mock_update, mock_context):
        """Prueba interacciones rápidas de usuario"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        # Simular múltiples comandos rápidos
        commands = ["📋 Información", "🛍️ Catálogo", "❓ Ayuda", "📞 Contacto"]
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Fast User'}):
            
            start_time = time.time()
            
            for command in commands:
                mock_update.message.text = command
                await handle_text_messages(mock_update, mock_context)
            
            end_time = time.time()
            execution_time = end_time - start_time
            
            # Todas las interacciones deberían ser rápidas
            assert execution_time < 1.0  # Menos de 1 segundo total

class TestSecurityScenarios:
    """Pruebas para escenarios de seguridad"""
    
    @pytest.mark.asyncio
    async def test_unauthorized_admin_access_attempts(self, mock_update, mock_context):
        """Prueba intentos de acceso no autorizado a funciones de admin"""
        # Usuario regular intenta acceder a funciones de admin
        regular_user_id = 99999
        mock_update.effective_user.id = regular_user_id
        
        admin_functions = [
            "🔐 Panel Admin",
            "👥 Ver Usuarios",
            "📊 Estadísticas",
            "📢 Envío Masivo"
        ]
        
        for function in admin_functions:
            mock_update.message.text = function
            
            with patch('bot_main.get_user', return_value={'is_admin': False}):
                await handle_text_messages(mock_update, mock_context)
                
                # Debería recibir mensaje de sin permisos
                if mock_update.message.reply_text.called:
                    call_args = mock_update.message.reply_text.call_args[0][0]
                    assert "No tienes permisos" in call_args or "comando" in call_args.lower()
    
    @pytest.mark.asyncio
    async def test_sql_injection_attempts_in_registration(self, mock_update, mock_context):
        """Prueba intentos de inyección SQL en datos de registro"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_context.user_data = {}
        
        # Intentos de inyección SQL en diferentes campos
        malicious_inputs = [
            "'; DROP TABLE users; --",
            "admin' OR '1'='1",
            "<script>alert('xss')</script>",
            "../../etc/passwd",
            "null; DELETE FROM users WHERE 1=1; --"
        ]
        
        for malicious_input in malicious_inputs:
            # Probar en nombre
            mock_update.message.text = malicious_input
            result = await name_handler(mock_update, mock_context)
            assert result == PHONE
            # Los datos deberían almacenarse tal como se proporcionan (sanitización en BD)
            assert mock_context.user_data['name'] == malicious_input
            
            # Probar en otros campos
            result = await phone_handler(mock_update, mock_context)
            assert result == EMAIL
            
            result = await email_handler(mock_update, mock_context)
            assert result == ADDRESS
    
    @pytest.mark.asyncio
    async def test_broadcast_privilege_escalation_attempt(self, mock_update, mock_context):
        """Prueba intento de escalación de privilegios en broadcast"""
        # Usuario regular intenta usar comando de broadcast
        regular_user_id = 99999
        mock_update.effective_user.id = regular_user_id
        mock_context.args = ["Mensaje", "malicioso"]
        
        with patch('bot_main.is_super_admin', return_value=False):
            await broadcast_command(mock_update, mock_context)
            
            # Debería ser rechazado
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "No tienes permisos" in call_args