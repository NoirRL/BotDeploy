import pytest
from unittest.mock import patch, Mock, AsyncMock
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

class TestStartCommand:
    """Pruebas para el comando /start"""
    
    @pytest.mark.asyncio
    async def test_start_super_admin_new(self, mock_update, mock_context, test_db_session):
        """Prueba /start para superadmin nuevo"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        mock_update.effective_user.id = super_admin_id
        mock_update.effective_user.first_name = "Super Admin"
        
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.create_or_update_superadmin', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Super Admin'}):
            
            result = await start_command(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            assert mock_update.message.reply_text.call_count == 2
            # Verificar que se llama con teclado de admin
            call_args = mock_update.message.reply_text.call_args_list[0][1]
            assert "Super Admin" in call_args['text']
    
    @pytest.mark.asyncio
    async def test_start_admin_existing(self, mock_update, mock_context, test_db_session):
        """Prueba /start para admin existente"""
        admin_id = ADMIN_USER_IDS[0]
        mock_update.effective_user.id = admin_id
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Admin User', 'is_admin': True}):
            
            result = await start_command(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            assert mock_update.message.reply_text.call_count == 2
    
    @pytest.mark.asyncio
    async def test_start_admin_without_account(self, mock_update, mock_context):
        """Prueba /start para admin sin cuenta"""
        admin_id = ADMIN_USER_IDS[0]
        mock_update.effective_user.id = admin_id
        
        with patch('bot_main.user_exists', return_value=False):
            result = await start_command(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "administrador pero no tienes cuenta" in call_args
    
    @pytest.mark.asyncio
    async def test_start_regular_user_complete_registration(self, mock_update, mock_context):
        """Prueba /start para usuario regular completamente registrado"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Regular User', 'is_admin': False}):
            
            result = await start_command(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[1]['text']
            assert "Regular User" in call_args
            assert "Bienvenido de vuelta" in call_args
    
    @pytest.mark.asyncio
    async def test_start_regular_user_incomplete_registration(self, mock_update, mock_context):
        """Prueba /start para usuario con registro incompleto"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=False), \
             patch('bot_main.get_user', return_value={'name': 'Incomplete User', 'is_admin': False}):
            
            result = await start_command(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            assert mock_update.message.reply_text.call_count == 2
            # Verificar que se menciona registro incompleto
            second_call = mock_update.message.reply_text.call_args_list[1][1]['text']
            assert "registro está incompleto" in second_call
    
    @pytest.mark.asyncio
    async def test_start_new_user(self, mock_update, mock_context):
        """Prueba /start para usuario nuevo"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.get_user', return_value=None):
            
            result = await start_command(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            assert mock_update.message.reply_text.call_count == 2
            # Verificar mensaje de bienvenida
            first_call = mock_update.message.reply_text.call_args_list[0][1]['text']
            assert "¡Hola!" in first_call

class TestConversationHandlers:
    """Pruebas para los manejadores de conversación"""
    
    @pytest.mark.asyncio
    async def test_name_handler(self, mock_update, mock_context):
        """Prueba el manejador de nombre"""
        mock_update.message.text = "Juan Pérez"
        
        result = await name_handler(mock_update, mock_context)
        
        assert result == PHONE
        assert mock_context.user_data['name'] == "Juan Pérez"
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "teléfono" in call_args.lower()
    
    @pytest.mark.asyncio
    async def test_phone_handler(self, mock_update, mock_context):
        """Prueba el manejador de teléfono"""
        mock_update.message.text = "12345678"
        
        result = await phone_handler(mock_update, mock_context)
        
        assert result == EMAIL
        assert mock_context.user_data['phone'] == "12345678"
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "correo" in call_args.lower()
    
    @pytest.mark.asyncio
    async def test_email_handler(self, mock_update, mock_context):
        """Prueba el manejador de email"""
        mock_update.message.text = "test@example.com"
        
        result = await email_handler(mock_update, mock_context)
        
        assert result == ADDRESS
        assert mock_context.user_data['email'] == "test@example.com"
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "dirección" in call_args.lower()
    
    @pytest.mark.asyncio
    async def test_address_handler_new_user(self, mock_update, mock_context):
        """Prueba el manejador de dirección para usuario nuevo"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_update.message.text = "Calle Principal 123"
        mock_context.user_data = {
            'name': 'Test User',
            'phone': '12345678',
            'email': 'test@example.com'
        }
        
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.save_user', return_value=True), \
             patch('bot_main.BASE_URL', 'https://test.com'):
            
            result = await address_handler(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            assert mock_context.user_data['address'] == "Calle Principal 123"
            assert mock_update.message.reply_text.call_count == 2
    
    @pytest.mark.asyncio
    async def test_address_handler_existing_user(self, mock_update, mock_context):
        """Prueba el manejador de dirección para usuario existente"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_update.message.text = "Nueva dirección"
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Existing User'}):
            
            result = await address_handler(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Bienvenido de nuevo" in call_args
    
    @pytest.mark.asyncio
    async def test_address_handler_save_failure(self, mock_update, mock_context):
        """Prueba el manejador de dirección cuando falla el guardado"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_update.message.text = "Dirección test"
        mock_context.user_data = {
            'name': 'Test',
            'phone': '123',
            'email': 'test@test.com'
        }
        
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.save_user', return_value=False):
            
            result = await address_handler(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "problema" in call_args.lower()

class TestTextMessageHandlers:
    """Pruebas para el manejador de mensajes de texto"""
    
    @pytest.mark.asyncio
    async def test_handle_start_command(self, mock_update, mock_context):
        """Prueba manejo del comando /start como texto"""
        mock_update.message.text = "/start"
        
        with patch('bot_main.start_command') as mock_start:
            await handle_text_messages(mock_update, mock_context)
            mock_start.assert_called_once_with(mock_update, mock_context)
    
    @pytest.mark.asyncio
    async def test_handle_panel_admin_authorized(self, mock_update, mock_context):
        """Prueba acceso a Panel Admin autorizado"""
        admin_id = ADMIN_USER_IDS[0]
        mock_update.effective_user.id = admin_id
        mock_update.message.text = "🔐 Panel Admin"
        
        with patch('bot_main.get_user', return_value={'is_admin': True}):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Panel de Administración" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_panel_admin_unauthorized(self, mock_update, mock_context):
        """Prueba acceso a Panel Admin no autorizado"""
        user_id = 99999
        mock_update.effective_user.id = user_id
        mock_update.message.text = "🔐 Panel Admin"
        
        with patch('bot_main.get_user', return_value={'is_admin': False}):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "No tienes permisos" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_informacion_complete_user(self, mock_update, mock_context):
        """Prueba 'Información' para usuario completamente registrado"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_update.message.text = "📋 Información"
        
        user_data = {
            'name': 'Test User',
            'phone': '12345678',
            'email': 'test@example.com',
            'address': 'Test Address'
        }
        
        with patch('bot_main.get_user', return_value=user_data), \
             patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=True):
            
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[1]['text']
            assert "Tu información actual" in call_args
            assert "Test User" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_catalogo_registered_user(self, mock_update, mock_context):
        """Prueba 'Catálogo' para usuario registrado"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_update.message.text = "🛍️ Catálogo"
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=True):
            
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "catálogo de productos" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_catalogo_unregistered_user(self, mock_update, mock_context):
        """Prueba 'Catálogo' para usuario no registrado"""
        user_id = 12345
        mock_update.effective_user.id = user_id
        mock_update.message.text = "🛍️ Catálogo"
        
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.user_is_completely_registered', return_value=False):
            
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[1]['text']
            assert "necesitas estar registrado" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_ayuda(self, mock_update, mock_context):
        """Prueba comando 'Ayuda'"""
        mock_update.message.text = "❓ Ayuda"
        
        with patch('bot_main.get_user', return_value=None):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Cómo usar el bot" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_contacto(self, mock_update, mock_context):
        """Prueba comando 'Contacto'"""
        mock_update.message.text = "📞 Contacto"
        
        with patch('bot_main.get_user', return_value=None):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Información de Contacto" in call_args
    
    @pytest.mark.asyncio
    async def test_handle_unknown_command(self, mock_update, mock_context):
        """Prueba comando desconocido"""
        mock_update.message.text = "comando inexistente"
        
        with patch('bot_main.get_user', return_value=None):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "No entiendo ese comando" in call_args

class TestCallbackHandlers:
    """Pruebas para los manejadores de callback queries"""
    
    @pytest.mark.asyncio
    async def test_why_register_callback(self, mock_callback_query, mock_context):
        """Prueba callback 'why_register'"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = 12345
        
        await why_register_callback(mock_update, mock_context)
        
        mock_callback_query.answer.assert_called_once()
        mock_callback_query.edit_message_text.assert_called_once()
        call_args = mock_callback_query.edit_message_text.call_args[1]['text']
        assert "Por qué necesitas completar tu registro" in call_args
    
    @pytest.mark.asyncio
    async def test_back_to_main_callback(self, mock_callback_query, mock_context):
        """Prueba callback 'back_to_main'"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = 12345
        
        with patch('bot_main.get_user', return_value={'name': 'Test User', 'is_admin': False}):
            await back_to_main_callback(mock_update, mock_context)
            
            mock_callback_query.answer.assert_called_once()
            mock_callback_query.edit_message_text.assert_called_once()
            mock_context.bot.send_message.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_back_to_main_callback_no_user(self, mock_callback_query, mock_context):
        """Prueba callback 'back_to_main' sin datos de usuario"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = 12345
        
        with patch('bot_main.get_user', return_value=None):
            await back_to_main_callback(mock_update, mock_context)
            
            mock_callback_query.edit_message_text.assert_called_once()
            call_args = mock_callback_query.edit_message_text.call_args[0][0]
            assert "Error al obtener tus datos" in call_args

class TestBroadcastCommands:
    """Pruebas para comandos de broadcast"""
    
    @pytest.mark.asyncio
    async def test_broadcast_command_unauthorized(self, mock_update, mock_context):
        """Prueba comando broadcast sin permisos"""
        user_id = 99999  # Usuario regular
        mock_update.effective_user.id = user_id
        
        with patch('bot_main.is_super_admin', return_value=False):
            await broadcast_command(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "No tienes permisos" in call_args
    
    @pytest.mark.asyncio
    async def test_broadcast_command_no_message(self, mock_update, mock_context):
        """Prueba comando broadcast sin mensaje"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        mock_update.effective_user.id = super_admin_id
        mock_context.args = []
        
        with patch('bot_main.is_super_admin', return_value=True):
            await broadcast_command(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Uso: /broadcast" in call_args
    
    @pytest.mark.asyncio
    async def test_broadcast_command_with_message(self, mock_update, mock_context):
        """Prueba comando broadcast con mensaje"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        mock_update.effective_user.id = super_admin_id
        mock_context.args = ["Mensaje", "de", "prueba"]
        
        with patch('bot_main.is_super_admin', return_value=True):
            await broadcast_command(mock_update, mock_context)
            
            assert mock_context.user_data['broadcast_message'] == "Mensaje de prueba"
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[1]['text']
            assert "Confirmar envío masivo" in call_args

class TestBroadcastExecution:
    """Pruebas para la ejecución completa del broadcast"""
    
    @pytest.mark.asyncio
    async def test_confirm_broadcast_callback_success(self, mock_callback_query, mock_context, test_db_session):
        """Prueba confirmación exitosa de broadcast"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = SUPER_ADMIN_USER_IDS[0]
        mock_context.user_data = {'broadcast_message': 'Mensaje de prueba'}
        
        # Mock de usuarios en BD
        mock_users = [
            {'telegram_id': 1001},
            {'telegram_id': 1002},
            {'telegram_id': 1003}
        ]
        
        with patch('bot_main.get_all_users', return_value=mock_users), \
             patch('bot_main.is_super_admin', return_value=True):
            
            await confirm_broadcast_callback(mock_update, mock_context)
            
            mock_callback_query.answer.assert_called_once()
            mock_callback_query.edit_message_text.assert_called_once()
            
            # Verificar que se envió a todos los usuarios
            assert mock_context.bot.send_message.call_count == len(mock_users)
            
            # Verificar que el mensaje fue enviado correctamente
            for call in mock_context.bot.send_message.call_args_list:
                args, kwargs = call
                assert kwargs['text'] == 'Mensaje de prueba'
    
    @pytest.mark.asyncio
    async def test_confirm_broadcast_callback_unauthorized(self, mock_callback_query, mock_context):
        """Prueba confirmación de broadcast sin permisos"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = 99999  # Usuario regular
        
        with patch('bot_main.is_super_admin', return_value=False):
            await confirm_broadcast_callback(mock_update, mock_context)
            
            mock_callback_query.answer.assert_called_once()
            mock_callback_query.edit_message_text.assert_called_once()
            call_args = mock_callback_query.edit_message_text.call_args[0][0]
            assert "No tienes permisos" in call_args
    
    @pytest.mark.asyncio
    async def test_confirm_broadcast_callback_no_message(self, mock_callback_query, mock_context):
        """Prueba confirmación de broadcast sin mensaje guardado"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = SUPER_ADMIN_USER_IDS[0]
        mock_context.user_data = {}  # Sin mensaje guardado
        
        with patch('bot_main.is_super_admin', return_value=True):
            await confirm_broadcast_callback(mock_update, mock_context)
            
            mock_callback_query.edit_message_text.assert_called_once()
            call_args = mock_callback_query.edit_message_text.call_args[0][0]
            assert "No hay mensaje para enviar" in call_args
    
    @pytest.mark.asyncio
    async def test_confirm_broadcast_callback_with_failures(self, mock_callback_query, mock_context):
        """Prueba confirmación de broadcast con algunos fallos de envío"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = SUPER_ADMIN_USER_IDS[0]
        mock_context.user_data = {'broadcast_message': 'Mensaje de prueba'}
        
        mock_users = [
            {'telegram_id': 1001},
            {'telegram_id': 1002},
            {'telegram_id': 1003}
        ]
        
        # Simular fallo en el segundo envío
        def side_effect(*args, **kwargs):
            if kwargs.get('chat_id') == 1002:
                raise Exception("Usuario bloqueó el bot")
            return AsyncMock()
        
        mock_context.bot.send_message.side_effect = side_effect
        
        with patch('bot_main.get_all_users', return_value=mock_users), \
             patch('bot_main.is_super_admin', return_value=True):
            
            await confirm_broadcast_callback(mock_update, mock_context)
            
            # Debería intentar enviar a todos los usuarios
            assert mock_context.bot.send_message.call_count == len(mock_users)
    
    @pytest.mark.asyncio
    async def test_cancel_broadcast_callback(self, mock_callback_query, mock_context):
        """Prueba cancelación de broadcast"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = SUPER_ADMIN_USER_IDS[0]
        mock_context.user_data = {'broadcast_message': 'Mensaje cancelado'}
        
        await cancel_broadcast_callback(mock_update, mock_context)
        
        mock_callback_query.answer.assert_called_once()
        mock_callback_query.edit_message_text.assert_called_once()
        
        # Verificar que se limpió el mensaje
        assert 'broadcast_message' not in mock_context.user_data
        
        call_args = mock_callback_query.edit_message_text.call_args[0][0]
        assert "Envío masivo cancelado" in call_args

class TestEdgeCases:
    """Pruebas para casos extremos y edge cases"""
    
    @pytest.mark.asyncio
    async def test_conversation_handler_edge_cases(self, mock_update, mock_context):
        """Prueba casos extremos en manejadores de conversación"""
        # Nombre muy largo
        mock_update.message.text = "A" * 1000
        result = await name_handler(mock_update, mock_context)
        assert result == PHONE
        assert mock_context.user_data['name'] == "A" * 1000
        
        # Teléfono con caracteres especiales
        mock_update.message.text = "+1-555-123-4567 ext.123"
        result = await phone_handler(mock_update, mock_context)
        assert result == EMAIL
        assert mock_context.user_data['phone'] == "+1-555-123-4567 ext.123"
        
        # Email muy largo
        long_email = "a" * 50 + "@" + "b" * 50 + ".com"
        mock_update.message.text = long_email
        result = await email_handler(mock_update, mock_context)
        assert result == ADDRESS
        assert mock_context.user_data['email'] == long_email
    
    @pytest.mark.asyncio
    async def test_empty_message_handling(self, mock_update, mock_context):
        """Prueba manejo de mensajes vacíos"""
        mock_update.message.text = ""
        
        with patch('bot_main.get_user', return_value=None):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "No entiendo ese comando" in call_args
    
    @pytest.mark.asyncio
    async def test_whitespace_only_message(self, mock_update, mock_context):
        """Prueba manejo de mensajes con solo espacios"""
        mock_update.message.text = "   \t\n   "
        
        with patch('bot_main.get_user', return_value=None):
            await handle_text_messages(mock_update, mock_context)
            
            mock_update.message.reply_text.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_special_characters_in_conversation(self, mock_update, mock_context):
        """Prueba caracteres especiales en conversación"""
        # Nombre con emojis y caracteres especiales
        mock_update.message.text = "José María 👨‍💼 O'Connor-Smith"
        result = await name_handler(mock_update, mock_context)
        assert result == PHONE
        assert mock_context.user_data['name'] == "José María 👨‍💼 O'Connor-Smith"

class TestUserStateTransitions:
    """Pruebas para transiciones de estado de usuario"""
    
    @pytest.mark.asyncio
    async def test_user_registration_flow_complete(self, mock_update, mock_context):
        """Prueba flujo completo de registro de usuario"""
        user_id = 54321
        mock_update.effective_user.id = user_id
        
        # Estado inicial: usuario nuevo
        with patch('bot_main.user_exists', return_value=False):
            result = await start_command(mock_update, mock_context)
            assert result == ConversationHandler.END
        
        # Flujo de registro
        mock_context.user_data = {}
        
        # Paso 1: Nombre
        mock_update.message.text = "Usuario Test"
        result = await name_handler(mock_update, mock_context)
        assert result == PHONE
        assert mock_context.user_data['name'] == "Usuario Test"
        
        # Paso 2: Teléfono
        mock_update.message.text = "555-0123"
        result = await phone_handler(mock_update, mock_context)
        assert result == EMAIL
        assert mock_context.user_data['phone'] == "555-0123"
        
        # Paso 3: Email
        mock_update.message.text = "usuario@test.com"
        result = await email_handler(mock_update, mock_context)
        assert result == ADDRESS
        assert mock_context.user_data['email'] == "usuario@test.com"
        
        # Paso 4: Dirección (completar registro)
        mock_update.message.text = "Calle Test 123"
        with patch('bot_main.user_exists', return_value=False), \
             patch('bot_main.save_user', return_value=True):
            result = await address_handler(mock_update, mock_context)
            assert result == ConversationHandler.END
            assert mock_context.user_data['address'] == "Calle Test 123"
    
    @pytest.mark.asyncio
    async def test_admin_privilege_escalation(self, mock_update, mock_context, test_db_session):
        """Prueba escalación de privilegios para administradores"""
        # Usuario regular que se convierte en admin
        user_id = 65432
        mock_update.effective_user.id = user_id
        
        # Inicialmente no es admin
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Regular User', 'is_admin': False}), \
             patch('bot_main.user_is_completely_registered', return_value=True):
            
            await start_command(mock_update, mock_context)
            
            # No debería tener acceso a panel admin
            mock_update.message.text = "🔐 Panel Admin"
            await handle_text_messages(mock_update, mock_context)
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "No tienes permisos" in call_args
        
        # Ahora es admin
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Admin User', 'is_admin': True}):
            
            mock_update.message.text = "🔐 Panel Admin"
            await handle_text_messages(mock_update, mock_context)
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Panel de Administración" in call_args

class TestRegistrationValidation:
    """Pruebas para validación de datos de registro"""
    
    @pytest.mark.asyncio
    async def test_incomplete_registration_scenarios(self, mock_update, mock_context):
        """Prueba diferentes escenarios de registro incompleto"""
        user_id = 13579
        mock_update.effective_user.id = user_id
        mock_update.message.text = "📋 Información"
        
        # Escenario 1: Usuario sin nombre
        user_data = {'name': '', 'phone': '123', 'email': 'test@test.com', 'address': 'Address'}
        with patch('bot_main.get_user', return_value=user_data), \
             patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=False):
            
            await handle_text_messages(mock_update, mock_context)
            call_args = mock_update.message.reply_text.call_args[1]['text']
            assert "registro está incompleto" in call_args
        
        # Escenario 2: Usuario sin email
        user_data = {'name': 'Test', 'phone': '123', 'email': '', 'address': 'Address'}
        with patch('bot_main.get_user', return_value=user_data), \
             patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.user_is_completely_registered', return_value=False):
            
            await handle_text_messages(mock_update, mock_context)
            call_args = mock_update.message.reply_text.call_args[1]['text']
            assert "registro está incompleto" in call_args
    
    @pytest.mark.asyncio
    async def test_user_exists_but_no_data(self, mock_update, mock_context):
        """Prueba usuario que existe en BD pero sin datos"""
        user_id = 24680
        mock_update.effective_user.id = user_id
        mock_update.message.text = "📋 Información"
        
        with patch('bot_main.user_exists', return_value=True), \
             patch('bot_main.get_user', return_value=None):
            
            await handle_text_messages(mock_update, mock_context)
            call_args = mock_update.message.reply_text.call_args[0][0]
            assert "Error al obtener tu información" in call_args

class TestCallbackQueryEdgeCases:
    """Pruebas para casos extremos en callback queries"""
    
    @pytest.mark.asyncio
    async def test_callback_with_invalid_user_data(self, mock_callback_query, mock_context):
        """Prueba callback con datos de usuario inválidos"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = None  # ID inválido
        
        await why_register_callback(mock_update, mock_context)
        
        # Debería manejar el error graciosamente
        mock_callback_query.answer.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_back_to_main_with_database_error(self, mock_callback_query, mock_context):
        """Prueba callback back_to_main con error de base de datos"""
        mock_callback_query.edit_message_text = AsyncMock()
        mock_update = Mock()
        mock_update.callback_query = mock_callback_query
        mock_update.effective_user.id = 12345
        
        with patch('bot_main.get_user', side_effect=Exception("DB Error")):
            await back_to_main_callback(mock_update, mock_context)
            
            mock_callback_query.edit_message_text.assert_called_once()
            call_args = mock_callback_query.edit_message_text.call_args[0][0]
            assert "Error al obtener tus datos" in call_args

class TestConcurrencyAndRaceConditions:
    """Pruebas para condiciones de carrera y concurrencia"""
    
    @pytest.mark.asyncio
    async def test_simultaneous_user_registration(self, mock_update, mock_context):
        """Prueba registro simultáneo del mismo usuario"""
        user_id = 98765
        mock_update.effective_user.id = user_id
        mock_update.message.text = "Calle Simultánea 123"
        mock_context.user_data = {
            'name': 'Usuario Simultáneo',
            'phone': '999-0000',
            'email': 'simultaneo@test.com'
        }
        
        # Simular que el usuario se registra mientras procesamos
        call_count = 0
        def user_exists_side_effect(telegram_id):
            nonlocal call_count
            call_count += 1
            return call_count > 1  # Primera llamada False, segunda True
        
        with patch('bot_main.user_exists', side_effect=user_exists_side_effect), \
             patch('bot_main.save_user', return_value=True), \
             patch('bot_main.get_user', return_value={'name': 'Usuario Existente'}):
            
            result = await address_handler(mock_update, mock_context)
            
            assert result == ConversationHandler.END
            # Debería manejar el caso graciosamente
    
    @pytest.mark.asyncio
    async def test_multiple_broadcast_attempts(self, mock_update, mock_context):
        """Prueba múltiples intentos de broadcast simultáneos"""
        super_admin_id = SUPER_ADMIN_USER_IDS[0]
        mock_update.effective_user.id = super_admin_id
        mock_context.args = ["Broadcast", "Test"]
        
        with patch('bot_main.is_super_admin', return_value=True):
            # Primer broadcast
            await broadcast_command(mock_update, mock_context)
            first_message = mock_context.user_data.get('broadcast_message')
            
            # Segundo broadcast (debería sobrescribir)
            mock_context.args = ["Nuevo", "Mensaje"]
            await broadcast_command(mock_update, mock_context)
            second_message = mock_context.user_data.get('broadcast_message')
            
            assert first_message != second_message
            assert second_message == "Nuevo Mensaje"