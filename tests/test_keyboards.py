import pytest
from unittest.mock import patch, Mock
import sys
import os

# Agregar el directorio del bot al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bot'))

from bot_main import (
    get_main_keyboard, get_admin_keyboard, get_edit_webapp_keyboard,
    get_admin_webapp_keyboard, get_webapp_keyboard_with_registration_check,
    get_catalog_webapp_keyboard, get_appointments_webapp_keyboard,
    ADMIN_USER_IDS, SUPER_ADMIN_USER_IDS
)

class TestKeyboardCreation:
    """Pruebas para la creación de teclados"""
    
    def test_create_main_keyboard_regular_user(self):
        """Prueba teclado principal para usuario regular"""
        keyboard = get_main_keyboard(is_admin=False)
        
        # Verificar que tiene los botones correctos para usuario regular
        assert keyboard is not None
        keyboard_markup = keyboard.keyboard
        
        # Buscar botones específicos en el teclado
        buttons_text = []
        for row in keyboard_markup:
            for button in row:
                buttons_text.append(button.text)
        
        # Verificar botones de usuario regular 
        assert "🛍️ Catálogo" in buttons_text
        assert "📅 Agendar Cita" in buttons_text
        assert "📋 Información" in buttons_text
        
        # No debería tener botón de admin
        assert "🔐 Panel Admin" not in buttons_text
    
    def test_create_main_keyboard_admin_user(self):
        """Prueba teclado principal para usuario administrador"""
        keyboard = get_main_keyboard(is_admin=True)
        
        keyboard_markup = keyboard.keyboard
        buttons_text = []
        for row in keyboard_markup:
            for button in row:
                buttons_text.append(button.text)
        
        # Verificar botones de usuario regular
        assert "🛍️ Catálogo" in buttons_text
        assert "📅 Agendar Cita" in buttons_text
        assert "📋 Información" in buttons_text
        
        # Debería tener botón de admin
        assert "🔐 Panel Admin" in buttons_text
    
    def test_create_admin_keyboard(self):
        """Prueba teclado de administración"""
        keyboard = get_admin_keyboard()
        
        # Verificar que es un InlineKeyboard
        assert hasattr(keyboard, 'inline_keyboard')
        
        inline_keyboard = keyboard.inline_keyboard
        buttons_text = []
        for row in inline_keyboard:
            for button in row:
                buttons_text.append(button.text)
        
        # Verificar botones de administración (ajustados a la implementación real)
        assert "🖥️ Panel de Administración" in buttons_text
        assert "Volver" in buttons_text
    
    def test_create_webapp_keyboard_with_registration_check(self):
        """Prueba teclado con verificación de registro"""
        # Test con usuario no registrado (simulado)
        keyboard = get_webapp_keyboard_with_registration_check(user_id=12345)
        
        # Verificar que es un InlineKeyboard
        assert hasattr(keyboard, 'inline_keyboard')
        
        inline_keyboard = keyboard.inline_keyboard
        buttons_text = []
        for row in inline_keyboard:
            for button in row:
                buttons_text.append(button.text)
        
        # Como no podemos simular fácilmente el estado de registro,
        # solo verificamos que el teclado se crea correctamente
        assert len(buttons_text) > 0
    
    def test_create_admin_webapp_keyboard(self):
        """Prueba teclado webapp para administradores"""
        keyboard = get_admin_webapp_keyboard()
        
        inline_keyboard = keyboard.inline_keyboard
        buttons_text = []
        
        for row in inline_keyboard:
            for button in row:
                buttons_text.append(button.text)
        
        # Verificar botones de admin webapp
        assert "🛍️ Ver Catálogo" in buttons_text
        assert "📅 Ver Citas" in buttons_text
        assert "🖥️ Panel de Administración" in buttons_text
        assert "Volver" in buttons_text

class TestKeyboardIntegration:
    """Pruebas de integración de teclados con funciones del bot"""
    
    def test_keyboard_returned_in_start_command(self):
        """Prueba que start_command retorna el teclado correcto"""
        # Esto requiere mockear la función completa para verificar
        # que se usa el teclado correcto según el tipo de usuario
        pass  # Se puede implementar si es necesario
    
    def test_keyboard_consistency(self):
        """Prueba consistencia entre teclados"""
        # Verificar que los textos de botones son consistentes
        main_regular = get_main_keyboard(is_admin=False)
        main_admin = get_main_keyboard(is_admin=True)
        
        # Los teclados deberían tener estructura similar
        assert main_regular is not None
        assert main_admin is not None
        
        # El teclado de admin debería tener al menos tantos botones como el regular
        regular_buttons = len([button for row in main_regular.keyboard for button in row])
        admin_buttons = len([button for row in main_admin.keyboard for button in row])
        
        assert admin_buttons >= regular_buttons

class TestKeyboardEdgeCases:
    """Pruebas para casos extremos en teclados"""
    
    def test_keyboard_with_none_parameter(self):
        """Prueba teclado con parámetro None"""
        # Debería manejar graciosamente parámetros None
        keyboard = get_main_keyboard(is_admin=None)
        assert keyboard is not None
    
    def test_keyboard_button_limits(self):
        """Prueba límites de botones en teclados"""
        keyboard = get_main_keyboard(is_admin=True)
        
        # Verificar que no excede límites de Telegram
        for row in keyboard.keyboard:
            assert len(row) <= 8  # Límite de botones por fila en Telegram
        
        total_buttons = sum(len(row) for row in keyboard.keyboard)
        assert total_buttons <= 100  # Límite razonable de botones totales
    
    def test_keyboard_text_length(self):
        """Prueba longitud de texto en botones"""
        keyboards = [
            get_main_keyboard(is_admin=False),
            get_main_keyboard(is_admin=True),
            get_admin_keyboard()
        ]
        
        for keyboard in keyboards:
            if hasattr(keyboard, 'keyboard'):  # ReplyKeyboard
                for row in keyboard.keyboard:
                    for button in row:
                        # Los botones no deberían ser demasiado largos
                        assert len(button.text) <= 50
            else:  # InlineKeyboard
                for row in keyboard.inline_keyboard:
                    for button in row:
                        assert len(button.text) <= 50
    
    def test_inline_keyboard_callback_data(self):
        """Prueba datos de callback en teclados inline"""
        keyboards = [
            get_admin_keyboard(),
            get_admin_webapp_keyboard()
        ]
        
        for keyboard in keyboards:
            for row in keyboard.inline_keyboard:
                for button in row:
                    # Callback data no debería estar vacío si existe
                    if hasattr(button, 'callback_data') and button.callback_data:
                        assert len(button.callback_data) > 0
                        # No debería exceder el límite de Telegram
                        assert len(button.callback_data) <= 64

class TestKeyboardAccessibility:
    """Pruebas para accesibilidad de teclados"""
    
    def test_keyboard_emojis_consistency(self):
        """Prueba consistencia de emojis en teclados"""
        keyboard = get_main_keyboard(is_admin=True)
        
        buttons_text = []
        for row in keyboard.keyboard:
            for button in row:
                buttons_text.append(button.text)
        
        # Verificar que los botones principales tienen emojis
        emoji_buttons = [text for text in buttons_text if any(ord(char) > 0x1F600 for char in text)]
        assert len(emoji_buttons) > 0  # Debería haber al menos algunos botones con emojis
    
    def test_keyboard_text_clarity(self):
        """Prueba claridad de texto en botones"""
        keyboards = [
            get_main_keyboard(is_admin=False),
            get_admin_keyboard(),
            get_admin_webapp_keyboard()
        ]
        
        for keyboard in keyboards:
            if hasattr(keyboard, 'keyboard'):  # ReplyKeyboard
                buttons = [button.text for row in keyboard.keyboard for button in row]
            else:  # InlineKeyboard
                buttons = [button.text for row in keyboard.inline_keyboard for button in row]
            
            for button_text in buttons:
                # Los botones no deberían estar vacíos
                assert button_text.strip() != ""
                # No deberían tener solo espacios o caracteres especiales
                assert any(char.isalnum() for char in button_text)

class TestKeyboardUserExperience:
    """Pruebas para experiencia de usuario con teclados"""
    
    def test_keyboard_logical_grouping(self):
        """Prueba agrupación lógica de botones"""
        admin_keyboard = get_admin_keyboard()
        
        # Los botones deberían estar agrupados lógicamente
        # (esto es más una verificación visual/conceptual)
        buttons_per_row = [len(row) for row in admin_keyboard.inline_keyboard]
        
        # No debería haber filas con un solo botón (excepto posiblemente la última)
        single_button_rows = sum(1 for count in buttons_per_row if count == 1)
        assert single_button_rows <= 2  # Máximo dos filas con un solo botón
    
    def test_keyboard_navigation_flow(self):
        """Prueba flujo de navegación entre teclados"""
        main_keyboard = get_main_keyboard(is_admin=True)
        admin_keyboard = get_admin_keyboard()
        
        # El teclado principal debería tener acceso al panel admin
        main_buttons = [button.text for row in main_keyboard.keyboard for button in row]
        assert "🔐 Panel Admin" in main_buttons
        
        # El teclado admin debería tener botón para volver
        admin_buttons = [button.text for row in admin_keyboard.inline_keyboard for button in row]
        assert any("Volver" in button for button in admin_buttons)
    
    def test_keyboard_responsive_design(self):
        """Prueba diseño responsivo de teclados"""
        keyboard = get_main_keyboard(is_admin=True)
        
        # Verificar distribución equilibrada de botones
        total_buttons = sum(len(row) for row in keyboard.keyboard)
        num_rows = len(keyboard.keyboard)
        
        if num_rows > 0:
            avg_buttons_per_row = total_buttons / num_rows
            # La distribución debería ser relativamente equilibrada
            assert 1 <= avg_buttons_per_row <= 4  # Rango razonable para UX móvil

class TestKeyboardSecurity:
    """Pruebas de seguridad para teclados"""
    
    def test_admin_keyboard_access_control(self):
        """Prueba control de acceso para teclado admin"""
        # El teclado admin no debería ser creado por usuarios no autorizados
        # (esto se maneja en la lógica del bot, no en la función del teclado)
        
        # Verificar que el teclado admin tiene funciones sensibles
        admin_keyboard = get_admin_keyboard()
        admin_buttons = [button.text for row in admin_keyboard.inline_keyboard for button in row]
        
        # Funciones que requieren permisos especiales
        sensitive_functions = ["Administración"]
        for function in sensitive_functions:
            assert any(function in button for button in admin_buttons)
    
    def test_callback_data_safety(self):
        """Prueba seguridad de callback data"""
        keyboards = [
            get_admin_keyboard(),
            get_admin_webapp_keyboard()
        ]
        
        for keyboard in keyboards:
            for row in keyboard.inline_keyboard:
                for button in row:
                    if hasattr(button, 'callback_data') and button.callback_data:
                        callback_data = button.callback_data
                        
                        # Callback data no debería contener información sensible
                        sensitive_patterns = ['password', 'token', 'secret', 'key']
                        for pattern in sensitive_patterns:
                            assert pattern.lower() not in callback_data.lower()

class TestKeyboardMaintainability:
    """Pruebas para mantenibilidad de teclados"""
    
    def test_keyboard_function_modularity(self):
        """Prueba modularidad de funciones de teclado"""
        # Cada función debería crear un teclado independiente
        keyboard1 = get_main_keyboard(is_admin=False)
        keyboard2 = get_main_keyboard(is_admin=False)
        
        # Deberían ser instancias separadas
        assert keyboard1 is not keyboard2
        
        # Pero con el mismo contenido
        assert len(keyboard1.keyboard) == len(keyboard2.keyboard)
    
    def test_keyboard_extensibility(self):
        """Prueba extensibilidad de teclados"""
        # Los teclados deberían ser fáciles de extender
        admin_keyboard = get_admin_keyboard()
        
        # Verificar estructura que permita añadir botones fácilmente
        assert hasattr(admin_keyboard, 'inline_keyboard')
        assert len(admin_keyboard.inline_keyboard) > 0
    
    def test_keyboard_consistency_across_functions(self):
        """Prueba consistencia entre diferentes funciones de teclado"""
        keyboards = {
            'main_regular': get_main_keyboard(is_admin=False),
            'main_admin': get_main_keyboard(is_admin=True),
            'admin': get_admin_keyboard(),
            'admin_webapp': get_admin_webapp_keyboard()
        }
        
        # Todos los teclados deberían tener estructura válida
        for name, keyboard in keyboards.items():
            assert keyboard is not None, f"Keyboard {name} is None"
            
            # Verificar que tienen la estructura esperada
            if hasattr(keyboard, 'keyboard'):  # ReplyKeyboard
                assert hasattr(keyboard, 'keyboard')
                assert len(keyboard.keyboard) > 0
            elif hasattr(keyboard, 'inline_keyboard'):  # InlineKeyboard
                assert hasattr(keyboard, 'inline_keyboard')
                assert len(keyboard.inline_keyboard) > 0
            else:
                assert False, f"Unknown keyboard type for {name}"