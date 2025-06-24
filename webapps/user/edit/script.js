document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    let userId = urlParams.get('user_id');
    
    // Función para obtener el user_id correcto
    function getUserId() {
        // Primero intentar obtener de parámetros URL
        if (userId) {
            console.log('Usuario ID encontrado en URL:', userId);
            return parseInt(userId);
        }
        
        // Intentar obtener el ID del usuario de Telegram WebApp
        const tg = window.Telegram?.WebApp;
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            console.log('Usuario de Telegram encontrado:', tg.initDataUnsafe.user);
            return tg.initDataUnsafe.user.id;
        }
        
        // Si estamos en desarrollo, permitir ID de prueba solo si está en localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('Modo desarrollo detectado, usando ID de prueba');
            return 1870169979; // ID de superadmin para pruebas
        }
        
        console.error('No se pudo obtener el ID del usuario');
        return null;
    }
    
    // Obtener el userId usando la nueva función
    userId = getUserId();
    
    const form = document.getElementById('editForm');
    const messageDiv = document.getElementById('message');
    const loadingSpinner = document.getElementById('loadingSpinner');

    if (!userId) {
        showMessage('Error: No se pudo identificar el usuario', 'error');
        return;
    }

    // Cargar información actual del usuario
    loadUserInfo();

    // Configurar validaciones en tiempo real
    setupValidations();

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (validateForm()) {
            updateUserInfo();
        }
    });

    function setupValidations() {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');
        const addressInput = document.getElementById('address');

        // Validación del nombre en tiempo real
        nameInput.addEventListener('input', function() {
            validateName();
        });

        nameInput.addEventListener('blur', function() {
            validateName();
        });

        // Validación del email en tiempo real
        emailInput.addEventListener('blur', function() {
            validateEmail();
        });

        // Validación del teléfono en tiempo real
        phoneInput.addEventListener('blur', function() {
            validatePhone();
        });

        // Validación de la dirección en tiempo real
        addressInput.addEventListener('blur', function() {
            validateAddress();
        });
    }

    function validateName() {
        const nameInput = document.getElementById('name');
        const name = nameInput.value.trim();
        const formGroup = nameInput.closest('.form-group');

        // Limpiar errores previos
        clearFieldError(formGroup);

        if (!name) {
            showFieldError(formGroup, 'El nombre completo es requerido');
            return false;
        }

        if (name.length < 2) {
            showFieldError(formGroup, 'El nombre debe tener al menos 2 caracteres');
            return false;
        }

        // Validar que no contenga números
        if (/\d/.test(name)) {
            showFieldError(formGroup, 'El nombre no puede contener números');
            return false;
        }

        // Validar que solo contenga letras, espacios y algunos caracteres especiales
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(name)) {
            showFieldError(formGroup, 'El nombre solo puede contener letras y espacios');
            return false;
        }

        showFieldSuccess(formGroup);
        return true;
    }

    function validateEmail() {
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim();
        const formGroup = emailInput.closest('.form-group');

        clearFieldError(formGroup);

        if (!email) {
            showFieldError(formGroup, 'El correo electrónico es requerido');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showFieldError(formGroup, 'Ingresa un correo electrónico válido');
            return false;
        }

        showFieldSuccess(formGroup);
        return true;
    }

    function validatePhone() {
        const phoneInput = document.getElementById('phone');
        const phone = phoneInput.value.trim();
        const formGroup = phoneInput.closest('.form-group');

        clearFieldError(formGroup);

        if (!phone) {
            showFieldError(formGroup, 'El teléfono es requerido');
            return false;
        }

        // CORREGIR: Permitir números con espacios, guiones y paréntesis
        const phoneClean = phone.replace(/\D/g, ''); // Extraer solo dígitos

        if (phoneClean.length < 8) {
            showFieldError(formGroup, 'El teléfono debe tener al menos 8 dígitos');
            return false;
        }

        if (phoneClean.length > 15) {
            showFieldError(formGroup, 'El teléfono debe tener máximo 15 dígitos');
            return false;
        }

        showFieldSuccess(formGroup);
        return true;
    }

    function validateAddress() {
        const addressInput = document.getElementById('address');
        const address = addressInput.value.trim();
        const formGroup = addressInput.closest('.form-group');

        clearFieldError(formGroup);

        if (!address) {
            showFieldError(formGroup, 'La dirección es requerida');
            return false;
        }

        if (address.length < 10) {
            showFieldError(formGroup, 'La dirección debe ser más específica (mín. 10 caracteres)');
            return false;
        }

        showFieldSuccess(formGroup);
        return true;
    }

    function validateForm() {
        const nameValid = validateName();
        const emailValid = validateEmail();
        const phoneValid = validatePhone();
        const addressValid = validateAddress();

        return nameValid && emailValid && phoneValid && addressValid;
    }

    function showFieldError(formGroup, message) {
        formGroup.classList.add('error');
        formGroup.classList.remove('success');
        
        // Create or update error message
        let errorDiv = formGroup.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            formGroup.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
    }

    function showFieldSuccess(formGroup) {
        formGroup.classList.remove('error');
        formGroup.classList.add('success');
        
        // Remove error message
        const errorDiv = formGroup.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = '';
        }
    }

    function clearFieldError(formGroup) {
        formGroup.classList.remove('error', 'success');
        
        // Clear error message
        const errorDiv = formGroup.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = '';
        }
    }

    function loadUserInfo() {
        showLoadingSpinner(true);
        
        fetch(`/api/user/${userId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Datos del usuario recibidos:', data);
                
                if (data.success && data.user) {
                    document.getElementById('name').value = data.user.name || '';
                    document.getElementById('email').value = data.user.email || '';
                    document.getElementById('phone').value = data.user.phone || '';
                    document.getElementById('address').value = data.user.address || '';
                    
                    console.log('Información del usuario cargada correctamente');
                } else {
                    throw new Error(data.message || 'Error al cargar información del usuario');
                }
            })
            .catch(error => {
                console.error('Error cargando información del usuario:', error);
                showMessage(error.message || 'Error de conexión al cargar información', 'error');
            })
            .finally(() => {
                showLoadingSpinner(false);
            });
    }

    function updateUserInfo() {
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim()
        };

        console.log('Enviando datos actualizados:', formData);
        showLoadingSpinner(true);

        fetch(`/api/user/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Respuesta del servidor:', data);
            
            if (data.success) {
                showMessage('Información actualizada correctamente', 'success');
                
                // Cerrar la ventana después de 2 segundos
                setTimeout(() => {
                    if (window.Telegram?.WebApp) {
                        window.Telegram.WebApp.close();
                    } else {
                        window.close();
                    }
                }, 2000);
            } else {
                throw new Error(data.message || 'Error al actualizar información');
            }
        })
        .catch(error => {
            console.error('Error actualizando información:', error);
            showMessage(error.message || 'Error de conexión al actualizar', 'error');
        })
        .finally(() => {
            showLoadingSpinner(false);
        });
    }

    function showLoadingSpinner(show) {
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (show) {
            loadingSpinner.style.display = 'flex';
            submitBtn.disabled = true;
            
            // Disable all form inputs
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => input.disabled = true);
        } else {
            loadingSpinner.style.display = 'none';
            submitBtn.disabled = false;
            
            // Enable all form inputs
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => input.disabled = false);
        }
    }

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
        
        // Scroll to top to show the message
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});