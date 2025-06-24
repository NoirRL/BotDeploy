// Variables globales
const API_BASE = window.location.origin + '/api';
let userId = null;

// Inicialización de Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    
    // Configurar tema
    if (tg.themeParams) {
        document.documentElement.style.setProperty('--primary-color', tg.themeParams.button_color || '#3498db');
        document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#f8f9fa');
        document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#2c3e50');
    }
}

// DOM Elements
const registerForm = document.getElementById('registerForm');
const errorMessage = document.getElementById('errorMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const submitBtn = document.getElementById('submitBtn');
const goToBotBtn = document.getElementById('goToBotBtn');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Obtener parámetros de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    userId = urlParams.get('user_id');
    
    // Mostrar mensaje de error si existe
    if (error) {
        showError(getErrorMessage(error));
    }
    
    // Obtener user_id de Telegram si no está en URL
    if (!userId && tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        userId = tg.initDataUnsafe.user.id;
    }
    
    // Si tenemos user_id, verificar si ya está completamente registrado
    if (userId) {
        checkIfUserIsAlreadyRegistered();
    } else {
        showError('No se pudo identificar tu usuario. Por favor, accede desde Telegram.');
    }
    
    console.log('Registro inicializado para usuario:', userId);
}

async function checkIfUserIsAlreadyRegistered() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            headers: {
                'x-telegram-user-id': userId
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            
            // Verificar si el usuario está completamente registrado
            if (userData.name && userData.name.trim() !== '' &&
                userData.phone && userData.phone.trim() !== '' &&
                userData.email && userData.email.trim() !== '' &&
                userData.address && userData.address.trim() !== '') {
                
                // Usuario ya está completamente registrado
                showUserAlreadyRegisteredMessage(userData);
                return;
            } else {
                // Usuario existe pero no está completamente registrado
                populateForm(userData);
                hideRegistrationInfo();
            }
        } else {
            // Usuario no existe, mostrar formulario de registro normal
            hideRegistrationInfo();
        }
    } catch (error) {
        console.error('Error verificando registro:', error);
        hideRegistrationInfo();
    } finally {
        showLoading(false);
    }
}

function isUserCompletelyRegistered(userData) {
    return userData && 
           userData.name && userData.name.trim() !== '' &&
           userData.phone && userData.phone.trim() !== '' &&
           userData.email && userData.email.trim() !== '' &&
           userData.address && userData.address.trim() !== '';
}

function showUserAlreadyRegisteredMessage(userData) {
    // Ocultar el formulario
    registerForm.style.display = 'none';
    
    // Ocultar la información de por qué registrarse
    const registrationInfo = document.querySelector('.registration-info');
    if (registrationInfo) {
        registrationInfo.style.display = 'none';
    }
    
    // Ocultar el enlace del bot
    const botLink = document.querySelector('.bot-link');
    if (botLink) {
        botLink.style.display = 'none';
    }
    
    // Mostrar mensaje de que ya está registrado
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="success-message">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2>¡Ya estás registrado!</h2>
            <p>Tu cuenta ya está completamente configurada con la siguiente información:</p>
            <div class="user-info">
                <p><strong>Nombre:</strong> ${userData.name}</p>
                <p><strong>Teléfono:</strong> ${userData.phone}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Dirección:</strong> ${userData.address}</p>
            </div>
            <button onclick="redirectToOriginalDestination()" class="btn btn-primary">
                <i class="fas fa-arrow-left"></i>
                Continuar
            </button>
        </div>
    `;
}

function setupEventListeners() {
    registerForm.addEventListener('submit', handleSubmit);
    goToBotBtn.addEventListener('click', goToBot);
    
    // Validación en tiempo real
    const inputs = registerForm.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
}

async function loadExistingUserData() {
    try {
        const response = await fetch(`${API_BASE}/users/${userId}`);
        if (response.ok) {
            const userData = await response.json();
            populateForm(userData);
        }
    } catch (error) {
        console.log('No se pudieron cargar datos existentes:', error);
    }
}

function populateForm(userData) {
    if (userData.name) document.getElementById('name').value = userData.name;
    if (userData.phone) document.getElementById('phone').value = userData.phone;
    if (userData.email) document.getElementById('email').value = userData.email;
    if (userData.address) document.getElementById('address').value = userData.address;
}

async function handleSubmit(e) {
    e.preventDefault();
    
    if (!userId) {
        showError('No se pudo identificar tu usuario. Por favor, accede desde Telegram.');
        return;
    }
    
    const formData = new FormData(registerForm);
    const userData = {
        telegram_id: parseInt(userId),
        name: formData.get('name').trim(),
        phone: formData.get('phone').trim(),
        email: formData.get('email').trim(),
        address: formData.get('address').trim()
    };
    
    // Validar campos requeridos
    if (!userData.name || !userData.phone || !userData.email || !userData.address) {
        showError('Todos los campos son requeridos');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-telegram-user-id': userId
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('¡Registro completado exitosamente!');
            
            // Esperar un momento antes de redirigir
            setTimeout(() => {
                redirectToOriginalDestination();
            }, 2000);
        } else {
            showError(result.error || 'Error al registrar usuario');
        }
    } catch (error) {
        console.error('Error en registro:', error);
        showError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
        showLoading(false);
    }
}

function validateForm() {
    let isValid = true;
    const fields = ['name', 'phone', 'email', 'address'];
    
    fields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (!validateField({ target: field })) {
            isValid = false;
        }
    });
    
    return isValid;
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    let isValid = true;
    let errorMsg = '';
    
    // Validaciones específicas por campo
    switch (field.name) {
        case 'name':
            if (!value) {
                errorMsg = 'El nombre completo es requerido';
                isValid = false;
            } else if (value.length < 2) {
                errorMsg = 'El nombre debe tener al menos 2 caracteres';
                isValid = false;
            } else if (/\d/.test(value)) {
                errorMsg = 'El nombre no puede contener números';
                isValid = false;
            } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(value)) {
                errorMsg = 'El nombre solo puede contener letras y espacios';
                isValid = false;
            }
            break;
            
        case 'phone':
            if (!value) {
                errorMsg = 'El teléfono es requerido';
                isValid = false;
            } else {
                // CORREGIR: Permitir números con espacios, guiones y paréntesis
                const phoneClean = value.replace(/\D/g, ''); // Extraer solo dígitos
                
                if (phoneClean.length < 8) {
                    errorMsg = 'El teléfono debe tener al menos 8 dígitos';
                    isValid = false;
                } else if (phoneClean.length > 15) {
                    errorMsg = 'El teléfono debe tener máximo 15 dígitos';
                    isValid = false;
                }
            }
            break;
            
        case 'email':
            if (!value) {
                errorMsg = 'El correo electrónico es requerido';
                isValid = false;
            } else {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errorMsg = 'Ingresa un correo electrónico válido';
                    isValid = false;
                }
            }
            break;
            
        case 'address':
            if (!value) {
                errorMsg = 'La dirección es requerida';
                isValid = false;
            } else if (value.length < 10) {
                errorMsg = 'La dirección debe ser más específica (mín. 10 caracteres)';
                isValid = false;
            }
            break;
    }
    
    // Mostrar error si es inválido
    if (!isValid) {
        showFieldError(field, errorMsg);
    } else {
        clearFieldError({ target: field });
    }
    
    return isValid;
}

function showFieldError(field, message) {
    field.style.borderColor = 'var(--danger-color)';
    
    // Remover mensaje de error anterior si existe
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Crear nuevo mensaje de error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = 'var(--danger-color)';
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.style.marginTop = '5px';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(e) {
    const field = e.target;
    field.style.borderColor = '#e9ecef';
    
    const errorMsg = field.parentNode.querySelector('.field-error');
    if (errorMsg) {
        errorMsg.remove();
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showSuccess(message) {
    // Cambiar el mensaje de error a success
    errorMessage.textContent = message;
    errorMessage.className = 'success-message';
    errorMessage.style.display = 'block';
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showLoading(show, customMessage) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
    submitBtn.disabled = show;
    
    if (show) {
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${customMessage || 'Guardando...'}`;
    } else {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Completar Registro';
    }
}

function redirectToOriginalDestination() {
    if (tg) {
        // Si estamos en Telegram, cerrar la WebApp para volver al bot
        tg.close();
    } else {
        // Si no estamos en Telegram, redirigir al inicio
        window.location.href = '/';
    }
}

function goToBot() {
    if (tg) {
        // Si estamos en Telegram, cerrar la WebApp
        tg.close();
    } else {
        // Si no estamos en Telegram, mostrar mensaje
        showError('Esta función solo está disponible desde Telegram');
    }
}

function getErrorMessage(errorCode) {
    const messages = {
        'no_user_id': 'No se pudo identificar tu usuario. Por favor, accede desde Telegram.',
        'invalid_user_id': 'ID de usuario inválido. Por favor, inténtalo de nuevo.',
        'not_registered': 'No tienes una cuenta registrada. Por favor, completa el formulario.',
        'incomplete_registration': 'Tu registro está incompleto. Por favor, completa todos los campos.',
        'server_error': 'Error del servidor. Por favor, inténtalo más tarde.'
    };
    
    return messages[errorCode] || 'Ha ocurrido un error. Por favor, inténtalo de nuevo.';
}

// Manejar errores globales
window.addEventListener('error', function(e) {
    console.error('Error en registro:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada:', e.reason);
});

function hideRegistrationForm() {
    const form = document.getElementById('registerForm');
    const infoSection = document.querySelector('.info-section');
    const botLink = document.querySelector('.bot-link');
    
    if (form) form.style.display = 'none';
    if (infoSection) infoSection.style.display = 'none';
    if (botLink) botLink.style.display = 'none';
}

function hideRegistrationInfo() {
    // Ocultar el enlace del bot ya que el usuario llegó aquí desde la webapp
    const botLink = document.querySelector('.bot-link');
    if (botLink) {
        botLink.style.display = 'none';
    }
}