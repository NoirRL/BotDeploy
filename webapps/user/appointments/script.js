// Configuración global
const API_BASE_URL = window.location.origin + '/api';

// Inicialización de Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// AGREGAR manejo de errores globales
window.addEventListener('error', function(e) {
    console.error('Error global capturado en appointments:', e.error);
    console.error('Archivo:', e.filename, 'Línea:', e.lineno);
    
    // Si es error de CSS, intentar recargar
    if (e.filename && e.filename.includes('.css')) {
        console.log('Detectado error de CSS, intentando recargar...');
        location.reload();
    }
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rechazada no manejada:', e.reason);
});

// Función para obtener el user_id correcto - CORREGIDA
function getUserId() {
    // Prioridad 1: Parámetro URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('user_id');
    if (urlUserId && urlUserId !== 'guest') {
        console.log('User ID desde URL:', urlUserId);
        return urlUserId;
    }
    
    // Prioridad 2: Telegram WebApp
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const telegramUserId = tg.initDataUnsafe.user.id.toString();
        console.log('User ID desde Telegram:', telegramUserId);
        return telegramUserId;
    }
    
    // Prioridad 3: localStorage como fallback
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId && storedUserId !== 'guest') {
        console.log('User ID desde localStorage:', storedUserId);
        return storedUserId;
    }
    
    console.warn('No se pudo obtener user_id válido');
    return null;
}

// Estado de la aplicación
const state = {
    appointments: [],
    allAppointments: [], // Para mantener todas las citas sin filtrar
    loading: false,
    currentView: 'form',
    selectedDate: null,
    selectedReason: null,
    loadingAppointments: false // AGREGAR: Flag para controlar carga de citas
};

// Elementos del DOM
const elements = {
    form: null,
    appointmentsList: null,
    modal: null,
    loadingSpinner: null,
    viewFormBtn: null,
    viewListBtn: null,
    myAppointmentsBtn: null,
    appointmentsModal: null
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    setDefaultDate();
    // CORREGIR: Solo cargar citas una vez al inicio
    // loadAppointments(); // REMOVER esta llamada automática
    
    // AGREGAR: Sincronización automática con admin para citas
    setInterval(() => {
        console.log('Sincronización automática citas: verificando...');
        // Solo recargar si el modal de citas está abierto
        if (elements.appointmentsModal && elements.appointmentsModal.style.display === 'flex') {
            loadAppointments();
        }
    }, 20000); // Cada 20 segundos
    
    // AGREGAR: Detectar cambios desde admin usando localStorage
    window.addEventListener('storage', function(e) {
        if (e.key === 'admin_appointments_updated') {
            console.log('Detectado cambio en citas desde admin, recargando...');
            // Solo recargar si el modal está abierto
            if (elements.appointmentsModal && elements.appointmentsModal.style.display === 'flex') {
                loadAppointments();
            }
            // Limpiar la señal
            localStorage.removeItem('admin_appointments_updated');
        }
    });
    
    // AGREGAR: Detectar cuando regresamos a la pestaña/ventana
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('Webapp appointments visible: actualizando datos...');
            // Solo recargar si el modal está abierto
            if (elements.appointmentsModal && elements.appointmentsModal.style.display === 'flex') {
                loadAppointments();
            }
        }
    });
});

// Inicializar referencias a elementos del DOM
function initializeElements() {
    console.log('🔍 Inicializando elementos del DOM...');
    
    elements.form = document.getElementById('appointmentForm');
    elements.appointmentsList = document.getElementById('appointmentsList');
    elements.modal = document.getElementById('confirmModal');
    elements.loadingSpinner = document.getElementById('loadingSpinner');
    elements.viewFormBtn = document.getElementById('viewFormBtn');
    elements.viewListBtn = document.getElementById('viewListBtn');
    elements.myAppointmentsBtn = document.getElementById('myAppointmentsBtn');
    elements.appointmentsModal = document.getElementById('appointmentsModal');
    
    // AGREGAR: Validación de elementos críticos
    console.log('📋 Elementos encontrados:');
    console.log('- Formulario:', elements.form ? '✅ Encontrado' : '❌ NO encontrado');
    console.log('- Modal confirmación:', elements.modal ? '✅ Encontrado' : '❌ NO encontrado');
    console.log('- Loading spinner:', elements.loadingSpinner ? '✅ Encontrado' : '❌ NO encontrado');
    console.log('- Botón Mis Citas:', elements.myAppointmentsBtn ? '✅ Encontrado' : '❌ NO encontrado');
    
    // VALIDAR elementos críticos del formulario
    const dateInput = document.getElementById('appointmentDate');
    const timeSelect = document.getElementById('appointmentTime');
    const submitButton = document.querySelector('button[type="submit"]');
    
    console.log('📝 Elementos del formulario:');
    console.log('- Campo fecha:', dateInput ? '✅ Encontrado' : '❌ NO encontrado');
    console.log('- Campo hora:', timeSelect ? '✅ Encontrado' : '❌ NO encontrado');
    console.log('- Botón submit:', submitButton ? '✅ Encontrado' : '❌ NO encontrado');
    
    if (!elements.form) {
        console.error('❌ CRÍTICO: Formulario no encontrado. El botón de agendar no funcionará.');
    }
}

// Configurar event listeners
function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    // Formulario de cita - MEJORAR validación
    if (elements.form) {
        console.log('✅ Configurando listener del formulario...');
        elements.form.addEventListener('submit', handleFormSubmit);
        
        // AGREGAR: Verificar que el listener se configuró correctamente
        const hasListener = elements.form.onsubmit !== null || 
                           elements.form.addEventListener.toString().includes('submit');
        console.log('- Listener del formulario:', hasListener ? '✅ Configurado' : '❌ Error');
    } else {
        console.error('❌ No se puede configurar listener: formulario no encontrado');
    }    // AGREGAR: Event listener directo al botón como respaldo
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
        console.log('✅ Configurando listener directo del botón submit...');
        submitButton.addEventListener('click', function(e) {
            console.log('🖱️ Click detectado en botón Agendar Cita');
            
            // Validación rápida del motivo antes de enviar
            const reasonSelected = document.querySelector('input[name="reason"]:checked');
            if (!reasonSelected) {
                e.preventDefault();
                console.log('🚫 Prevenido envío - sin motivo seleccionado');
                validateAndShowReasonError();
                return false;
            }
        });
    } else {
        console.error('❌ Botón submit no encontrado');
    }

    // Botón "Mis Citas"
    elements.myAppointmentsBtn?.addEventListener('click', showMyAppointments);

    // Cerrar modal de citas
    const closeBtn = document.getElementById('closeAppointmentsModal');
    closeBtn?.addEventListener('click', hideMyAppointments);

    // Botón de refrescar en modal
    const refreshMyAppointmentsBtn = document.getElementById('refreshMyAppointmentsBtn');
    refreshMyAppointmentsBtn?.addEventListener('click', () => {
        console.log('Refrescando mis citas...');
        const icon = refreshMyAppointmentsBtn.querySelector('i');
        icon.classList.add('fa-spin');
        loadAppointments().finally(() => {
            icon.classList.remove('fa-spin');
        });
    });

    // Filtros del modal
    const myAppointmentFilter = document.getElementById('myAppointmentFilter');
    const myAppointmentDateFilter = document.getElementById('myAppointmentDateFilter');
    
    myAppointmentFilter?.addEventListener('change', filterMyAppointments);
    myAppointmentDateFilter?.addEventListener('change', filterMyAppointments);

    // Cerrar modal de citas al hacer clic fuera
    elements.appointmentsModal?.addEventListener('click', function(e) {
        if (e.target === elements.appointmentsModal) {
            hideMyAppointments();
        }
    });

    // Modal de confirmación
    document.addEventListener('click', handleModalEvents);

    // ELIMINAR: Validación en tiempo real duplicada (ya se maneja en setDefaultDate)
    // const dateInput = document.getElementById('appointmentDate');
    // dateInput?.addEventListener('change', validateDate);

    // Reason selection
    const reasonInputs = document.querySelectorAll('input[name="reason"]');
    reasonInputs.forEach(input => {
        input.addEventListener('change', function() {
            state.selectedReason = this.value;
            updateReasonCards();
            
            // Mostrar campo de notas como requerido si selecciona "otra"
            const notesGroup = document.getElementById('notesGroup');
            const notesRequired = document.getElementById('notesRequired');
            if (this.value === 'otra') {
                notesRequired.style.display = 'inline';
                notesGroup.querySelector('textarea').setAttribute('required', 'true');
            } else {
                notesRequired.style.display = 'none';
                notesGroup.querySelector('textarea').removeAttribute('required');
            }
        });
    });
      // Validación en tiempo real para el motivo de la cita
    const reasonRadios = document.querySelectorAll('input[name="reason"]');
    reasonRadios.forEach(radio => {
        radio.addEventListener('change', handleReasonChange);
    });
    
    // Validación en tiempo real para las notas cuando se selecciona "otra"
    const notesInput = document.getElementById('appointmentNotes');
    if (notesInput) {
        notesInput.addEventListener('input', handleNotesInput);
        notesInput.addEventListener('blur', handleNotesValidation);
    }
}

// Función para mostrar animación de refresh
function showRefreshAnimation(button) {
    const icon = button.querySelector('i');
    icon.classList.add('fa-spin');
    setTimeout(() => {
        icon.classList.remove('fa-spin');
    }, 1000);
}

// Mostrar modal de mis citas
function showMyAppointments() {
    console.log('Mostrando modal de mis citas');
    
    if (elements.appointmentsModal) {
        // Prevent body scroll
        document.body.classList.add('modal-open');
        
        // Asegurar que el modal se muestre correctamente
        elements.appointmentsModal.style.display = 'flex';
        elements.appointmentsModal.style.visibility = 'visible';
        elements.appointmentsModal.style.opacity = '1';
        
        // Agregar clase show si existe en el CSS
        elements.appointmentsModal.classList.add('show');
        
        console.log('Modal configurado, cargando citas...');
        loadAppointments();
    } else {
        console.error('Modal de citas no encontrado');
    }
}

// Ocultar modal de mis citas
function hideMyAppointments() {
    console.log('Ocultando modal de mis citas');
    
    if (elements.appointmentsModal) {
        // Restore body scroll
        document.body.classList.remove('modal-open');
        
        elements.appointmentsModal.style.display = 'none';
        elements.appointmentsModal.style.visibility = 'hidden';
        elements.appointmentsModal.style.opacity = '0';
        elements.appointmentsModal.classList.remove('show');
    }
}

// Establecer fecha mínima como mañana
function setDefaultDate() {
    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) {
        // CORREGIR: Crear fecha usando la zona horaria local sin desfase
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Formatear fecha correctamente para evitar problemas de zona horaria
        const year = tomorrow.getFullYear();
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        
        dateInput.min = formattedDate;
        
        // CORREGIR: Remover listeners existentes antes de agregar nuevos
        dateInput.removeEventListener('input', validateWorkingDay);
        dateInput.removeEventListener('change', validateDate);
        
        // AGREGAR: Configurar validación para días laborables (usar 'change' en lugar de 'input')
        dateInput.addEventListener('change', validateWorkingDay);
    }
}

// CORREGIR: Validar que solo se seleccionen días laborables
function validateWorkingDay(event) {
    const dateInput = event ? event.target : document.getElementById('appointmentDate');
    const selectedDate = dateInput.value;
    
    console.log('🗓️ Validando día laborable:', selectedDate);
    
    if (!selectedDate) {
        console.log('❌ No hay fecha seleccionada');
        return true; // Permitir campo vacío para que la validación general del formulario lo maneje
    }
    
    // Crear fecha usando la zona horaria local sin desfase
    const dateParts = selectedDate.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Mes en JavaScript es 0-indexado
    const day = parseInt(dateParts[2]);
    
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
    
    console.log('📅 Fecha creada:', date, 'Día de la semana:', dayOfWeek);
    
    const dateGroup = dateInput.closest('.form-group');
    
    // Validar que no sea fin de semana (sábado = 6, domingo = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log('❌ Es fin de semana');
        markFieldAsError(dateGroup);
        const dayName = dayOfWeek === 0 ? 'domingo' : 'sábado';
        showNotification(`No se pueden agendar citas los ${dayName}s. Por favor selecciona un día laborable (lunes a viernes).`, 'error');
        
        // CORREGIR: Limpiar la selección después de un pequeño delay para evitar conflictos
        setTimeout(() => {
            dateInput.value = '';
        }, 100);
        return false;
    }
    
    // Validar que sea una fecha futura
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateTime = new Date(year, month, day);
    
    if (selectedDateTime <= today) {
        console.log('❌ Fecha no es futura');
        markFieldAsError(dateGroup);
        showNotification('Debes seleccionar una fecha futura', 'error');
        
        // CORREGIR: Limpiar la selección después de un pequeño delay
        setTimeout(() => {
            dateInput.value = '';
        }, 100);
        return false;
    }
      console.log('✅ Fecha válida');
    markFieldAsSuccess(dateGroup);
    
    // Verificar disponibilidad de horarios para la fecha seleccionada
    checkTimeAvailability(selectedDate);
    
    return true;
}

// Validar fecha seleccionada
function validateDate() {
    const dateInput = document.getElementById('appointmentDate');
    const selectedDateString = dateInput.value;
    
    if (!selectedDateString) return false;
    
    // CORREGIR: Crear fecha sin problemas de zona horaria
    const dateParts = selectedDateString.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);
    
    const selectedDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dateGroup = dateInput.closest('.form-group');
    
    if (selectedDate <= today) {
        markFieldAsError(dateGroup);
        showNotification('Debes seleccionar una fecha futura', 'error');
        return false;
    } else {
        markFieldAsSuccess(dateGroup);
        return true;
    }
}

// Cambiar entre vistas
function switchView(view) {
    state.currentView = view;
    
    const formContainer = document.getElementById('formContainer');
    const listContainer = document.getElementById('listContainer');
    
    if (view === 'form') {
        formContainer?.classList.remove('hidden');
        listContainer?.classList.add('hidden');
        elements.viewFormBtn?.classList.add('btn-primary');
        elements.viewFormBtn?.classList.remove('btn-outline');
        elements.viewListBtn?.classList.remove('btn-primary');
        elements.viewListBtn?.classList.add('btn-outline');
    } else {
        formContainer?.classList.add('hidden');
        listContainer?.classList.remove('hidden');
        elements.viewListBtn?.classList.add('btn-primary');
        elements.viewListBtn?.classList.remove('btn-outline');
        elements.viewFormBtn?.classList.remove('btn-primary');
        elements.viewFormBtn?.classList.add('btn-outline');
        loadAppointments();
    }
}

// Manejar envío del formulario
async function handleFormSubmit(e) {
    console.log('🚀 handleFormSubmit ejecutado - Botón Agendar Cita presionado!');
    e.preventDefault();
    
    console.log('📊 Estado actual:', {
        loading: state.loading,
        currentView: state.currentView,
        selectedReason: state.selectedReason
    });
      if (state.loading) {
        console.log('⏳ Proceso ya en curso, ignorando click');
        return;
    }
      // Validación rápida del motivo antes de la validación completa
    if (!validateAndShowReasonError()) {
        console.log('❌ No se ha seleccionado motivo');
        return;
    }
    
    console.log('🔍 Validando formulario...');
    if (!validateForm()) {
        console.log('❌ Formulario inválido');
        showNotification('Por favor, completa todos los campos requeridos', 'error');
        return;
    }
    console.log('✅ Formulario válido');
    
    const userId = getUserId();
    console.log('👤 User ID obtenido:', userId);
    
    if (!userId || userId === 'guest') {
        console.log('❌ User ID inválido');
        showNotification('Error: No se pudo identificar el usuario. Intenta recargar la página.', 'error');
        return;
    }
    
    // Obtener datos directamente de los elementos DOM
    const dateInput = document.getElementById('appointmentDate');
    const timeSelect = document.getElementById('appointmentTime');
    const reasonRadio = document.querySelector('input[name="reason"]:checked');
    const notesTextarea = document.getElementById('appointmentNotes');
    
    console.log('📝 Elementos del formulario obtenidos:', {
        dateInput: dateInput ? 'Encontrado' : 'NO encontrado',
        timeSelect: timeSelect ? 'Encontrado' : 'NO encontrado', 
        reasonRadio: reasonRadio ? 'Encontrado' : 'NO encontrado',
        notesTextarea: notesTextarea ? 'Encontrado' : 'NO encontrado'
    });
    
    console.log('📋 Valores del formulario:', {
        date: dateInput?.value,
        time: timeSelect?.value,
        reason: reasonRadio?.value,
        notes: notesTextarea?.value
    });
    
    const appointmentData = {
        user_id: userId,
        date: dateInput?.value || '',
        time: timeSelect?.value || '',
        reason: reasonRadio?.value || '',
        notes: notesTextarea?.value || ''
    };
    
    console.log('📦 Datos de la cita preparados:', appointmentData);
    
    // Validar que todos los campos requeridos estén presentes
    if (!appointmentData.date || !appointmentData.time || !appointmentData.reason) {
        console.log('❌ Faltan datos requeridos:', {
            date: !appointmentData.date ? 'FALTA' : 'OK',
            time: !appointmentData.time ? 'FALTA' : 'OK',
            reason: !appointmentData.reason ? 'FALTA' : 'OK'
        });
        showNotification('Error: Faltan datos requeridos. Verifica que hayas completado todos los campos.', 'error');
        return;
    }
    
    console.log('✅ Todos los datos están presentes, mostrando modal de confirmación...');
    // Mostrar modal de confirmación
    showConfirmationModal(appointmentData);
}

// Validar formulario
function validateForm() {
    let isValid = true;
    let errors = [];
    
    // Validar fecha
    const dateInput = document.getElementById('appointmentDate');
    const dateGroup = dateInput.closest('.form-group');
    
    if (!dateInput.value) {
        markFieldAsError(dateGroup);
        errors.push('La fecha es requerida');
        isValid = false;
    } else {
        // Validar que la fecha sea futura y laborable
        const dateParts = dateInput.value.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        const selectedDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate <= today) {
            markFieldAsError(dateGroup);
            errors.push('Debes seleccionar una fecha futura');
            isValid = false;
        } else {
            const dayOfWeek = selectedDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                markFieldAsError(dateGroup);
                errors.push('No se pueden agendar citas los fines de semana');
                isValid = false;
            } else {
                markFieldAsSuccess(dateGroup);
            }
        }
    }
    
    // Validar hora
    const timeInput = document.getElementById('appointmentTime');
    const timeGroup = timeInput.closest('.form-group');
    
    if (!timeInput.value) {
        markFieldAsError(timeGroup);
        errors.push('La hora es requerida');
        isValid = false;
    } else {
        // Verificar si el horario seleccionado está disponible
        const selectedOption = timeInput.querySelector(`option[value="${timeInput.value}"]`);
        if (selectedOption && selectedOption.disabled) {
            markFieldAsError(timeGroup);
            errors.push('El horario seleccionado no está disponible');
            isValid = false;
        } else {
            markFieldAsSuccess(timeGroup);
        }
    }    // Validar motivo de la cita
    const reasonInputs = document.querySelectorAll('input[name="reason"]');
    const reasonSelected = Array.from(reasonInputs).some(input => input.checked);
    const reasonContainer = document.querySelector('.reason-options');
    const reasonError = document.getElementById('reasonError');
    
    if (!reasonSelected) {
        reasonContainer.classList.add('error');
        if (reasonError) {
            reasonError.style.display = 'flex';
        }
        errors.push('Debes seleccionar un motivo para la cita');
        isValid = false;
        
        // Hacer scroll hacia las opciones de motivo para mayor visibilidad
        reasonContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    } else {
        reasonContainer.classList.remove('error');
        if (reasonError) {
            reasonError.style.display = 'none';
        }
    }
    
    // Validar notas si es "otra" razón
    const selectedReason = Array.from(reasonInputs).find(input => input.checked)?.value;
    if (selectedReason === 'otra') {
        const notesInput = document.getElementById('appointmentNotes');
        const notesGroup = notesInput.closest('.form-group');
        
        if (!notesInput.value.trim()) {
            markFieldAsError(notesGroup);
            errors.push('Debes especificar el motivo en las notas cuando seleccionas "Otra razón"');
            isValid = false;
        } else if (notesInput.value.trim().length < 10) {
            markFieldAsError(notesGroup);
            errors.push('El motivo debe tener al menos 10 caracteres');
            isValid = false;
        } else {
            markFieldAsSuccess(notesGroup);
        }
    }
    
    // Mostrar errores específicos
    if (!isValid && errors.length > 0) {
        const errorMessage = errors.join('\n• ');
        showNotification(`Por favor, corrige los siguientes errores:\n• ${errorMessage}`, 'error');
    }
    
    return isValid;
}

// Mostrar modal de confirmación
function showConfirmationModal(appointmentData) {
    const modal = document.getElementById('confirmModal'); 
    if (!modal) return;
    
    // Prevent body scroll
    document.body.classList.add('modal-open');
    
    // CORREGIR: Formatear fecha sin problemas de zona horaria
    const dateParts = appointmentData.date.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Mes en JavaScript es 0-indexado
    const day = parseInt(dateParts[2]);
    
    const date = new Date(year, month, day);
    const formattedDate = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Obtener texto de la razón
    const reasonText = getReasonText(appointmentData.reason);
    
    // Actualizar contenido del modal
    document.getElementById('confirmDate').textContent = formattedDate;
    document.getElementById('confirmTime').textContent = appointmentData.time;
    document.getElementById('confirmReason').textContent = reasonText;
    document.getElementById('confirmNotes').textContent = appointmentData.notes || 'Sin notas adicionales';
    
    // Configurar botones
    const confirmBtn = document.getElementById('confirmAppointment');
    const cancelBtn = document.getElementById('cancelConfirmation');
    
    if (confirmBtn) confirmBtn.onclick = () => submitAppointment(appointmentData);
    if (cancelBtn) cancelBtn.onclick = hideConfirmationModal;
    
    // Mostrar modal
    modal.classList.add('show');
}

// Ocultar modal de confirmación
function hideConfirmationModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        // Restore body scroll
        document.body.classList.remove('modal-open');
        
        modal.classList.remove('show');
    }
}

// Manejar eventos del modal
function handleModalEvents(e) {
    const modal = document.getElementById('confirmModal');
    
    // Cerrar modal al hacer clic fuera
    if (e.target === modal) {
        hideConfirmationModal();
    }
    
    // Cerrar modal con botón X o cancelar
    if (e.target.classList.contains('close-btn') || e.target.id === 'cancelConfirmation') {
        hideConfirmationModal();
    }
}

// Obtener texto de la razón
function getReasonText(reason) {
    const reasonTexts = {
        'toma_medidas': 'Toma de medidas',
        'asesoria': 'Asesoría de estilos',
        'otra': 'Otros motivos'
    };
    return reasonTexts[reason] || reason;
}

// Enviar cita al servidor
async function submitAppointment(appointmentData) {
    setLoading(true);
    
    try {
        console.log('Enviando cita al servidor:', appointmentData);
        
        const response = await fetch(`${API_BASE_URL}/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appointmentData)
        });
        
        const responseText = await response.text();
        console.log('Respuesta del servidor:', response.status, responseText);
        
        if (!response.ok) {
            let errorMessage = 'Error al agendar la cita';
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = responseText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const result = JSON.parse(responseText);
        
        hideConfirmationModal();
        resetForm();
        showNotification('¡Cita agendada exitosamente! Te contactaremos pronto para confirmar.', 'success');
        
        // Recargar citas si el modal está abierto
        if (elements.appointmentsModal && elements.appointmentsModal.style.display === 'flex') {
            loadAppointments();
        }
        
    } catch (error) {
        console.error('Error al agendar cita:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

// Cargar citas del usuario
async function loadAppointments() {
    // AGREGAR: Evitar múltiples llamadas simultáneas
    if (state.loadingAppointments) return;
    state.loadingAppointments = true;
    
    setLoading(true);
    
    try {
        const userId = getUserId();
        if (!userId || userId === 'guest') {
            renderError('Usuario no autenticado');
            return;
        }
        
        console.log('Cargando citas para usuario:', userId);
        
        // CORREGIR: Usar el endpoint correcto con el userId en la URL
        const response = await fetch(`${API_BASE_URL}/appointments/user/${userId}`);
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }
        
        const appointments = await response.json();
        console.log('Citas cargadas:', appointments);
        
        // Ordenar por fecha más reciente primero
        const sortedAppointments = appointments.sort((a, b) => {
            const dateA = new Date(a.date + ' ' + a.time);
            const dateB = new Date(b.date + ' ' + b.time);
            return dateB - dateA;
        });
        
        state.appointments = sortedAppointments;
        state.allAppointments = sortedAppointments; // Guardar todas las citas sin filtrar
        renderAppointments();
        
    } catch (error) {
        console.error('Error al cargar citas:', error);
        renderError('Error al cargar las citas');
    } finally {
        setLoading(false);
        state.loadingAppointments = false; // LIBERAR el flag al finalizar
    }
}

// Función para validar disponibilidad de horarios
async function checkTimeAvailability(selectedDate) {
    if (!selectedDate) return;
    
    try {
        console.log('🕐 Verificando disponibilidad para fecha:', selectedDate);
        
        // Mostrar indicador de carga en el select de tiempo
        const timeSelect = document.getElementById('appointmentTime');
        if (timeSelect) {
            timeSelect.disabled = true;
            timeSelect.innerHTML = '<option value="">Verificando disponibilidad...</option>';
        }
        
        // Obtener todas las citas para la fecha seleccionada
        const response = await fetch(`${API_BASE_URL}/appointments?date=${selectedDate}`);
        if (!response.ok) {
            console.error('Error al verificar disponibilidad:', response.status);
            return;
        }
        
        const appointments = await response.json();
        console.log('📅 Citas existentes para', selectedDate, ':', appointments);
        
        // Obtener horarios ocupados
        const occupiedTimes = appointments
            .filter(apt => apt.status !== 'cancelled') // Excluir canceladas
            .map(apt => apt.time);
        
        console.log('⏰ Horarios ocupados:', occupiedTimes);
        
        // Restaurar opciones de tiempo
        if (timeSelect) {
            timeSelect.disabled = false;
            timeSelect.innerHTML = `
                <option value="">Selecciona una hora</option>
                <option value="09:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="13:00">1:00 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
            `;
            
            // Deshabilitar horarios ocupados
            occupiedTimes.forEach(time => {
                const option = timeSelect.querySelector(`option[value="${time}"]`);
                if (option) {
                    option.disabled = true;
                    option.textContent += ' (No disponible)';
                }
            });
            
            // Mostrar mensaje si todos los horarios están ocupados
            const availableOptions = Array.from(timeSelect.options).filter(option => 
                option.value && !option.disabled
            );
            
            if (availableOptions.length === 0) {
                showNotification('No hay horarios disponibles para esta fecha. Por favor, selecciona otra fecha.', 'warning');
            }
        }
        
    } catch (error) {
        console.error('Error al verificar disponibilidad de horarios:', error);
        
        // Restaurar opciones en caso de error
        const timeSelect = document.getElementById('appointmentTime');
        if (timeSelect) {
            timeSelect.disabled = false;
            timeSelect.innerHTML = `
                <option value="">Selecciona una hora</option>
                <option value="09:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="13:00">1:00 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
            `;
        }
        showNotification('Error al verificar disponibilidad. Por favor, intenta de nuevo.', 'error');
    }
}

// Filtrar citas en el modal de "Mis Citas"
function filterMyAppointments() {
    const statusFilter = document.getElementById('myAppointmentFilter')?.value || 'all';
    const dateFilter = document.getElementById('myAppointmentDateFilter')?.value || 'all';
    
    let filteredAppointments = state.allAppointments.filter(appointment => {
        // Filtro por estado
        const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
        
        // Filtro por fecha
        let matchesDate = true;
        if (dateFilter !== 'all') {
            // CORREGIR: Crear fecha de la cita sin problemas de zona horaria
            const dateParts = appointment.date.split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1;
            const day = parseInt(dateParts[2]);
            
            const appointmentDate = new Date(year, month, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            switch (dateFilter) {
                case 'upcoming':
                    matchesDate = appointmentDate >= today;
                    break;
                case 'past':
                    matchesDate = appointmentDate < today;
                    break;
                case 'week':
                    const weekFromNow = new Date(today);
                    weekFromNow.setDate(weekFromNow.getDate() + 7);
                    matchesDate = appointmentDate >= today && appointmentDate <= weekFromNow;
                    break;
                case 'month':
                    const monthFromNow = new Date(today);
                    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
                    matchesDate = appointmentDate >= today && appointmentDate <= monthFromNow;
                    break;
            }
        }
        
        return matchesStatus && matchesDate;
    });
    
    state.appointments = filteredAppointments;
    renderAppointments();
}

// Renderizar lista de citas
function renderAppointments() {
    const container = elements.appointmentsList;
    if (!container) return;
    
    if (state.appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No tienes citas agendadas</h3>
                <p>Agenda tu primera cita usando el formulario</p>
            </div>
        `;
        return;
    }
    
    const appointmentsHTML = state.appointments.map(appointment => {
        // CORREGIR: Formatear fecha sin problemas de zona horaria
        const dateParts = appointment.date.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        
        const date = new Date(year, month, day);
        const formattedDate = date.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        const reasonText = getReasonText(appointment.reason);
        const statusText = getStatusText(appointment.status);
        
        return `
            <div class="appointment-item ${appointment.status}">
                <div class="appointment-header">
                    <div class="appointment-info">
                        <h4>${reasonText}</h4>
                        <div class="datetime">
                            <i class="fas fa-calendar-alt"></i>
                            ${formattedDate}
                        </div>
                    </div>
                    <span class="appointment-status ${appointment.status}">
                        ${statusText}
                    </span>
                </div>
                
                ${appointment.notes ? `
                    <div class="appointment-notes">
                        <i class="fas fa-sticky-note"></i>
                        ${appointment.notes}
                    </div>
                ` : ''}

                ${appointment.status === 'pending' ? `
                    <div class="appointment-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" onclick="cancelAppointment('${appointment.id}')" style="font-size: 0.8rem; padding: 0.5rem 1rem;">
                            <i class="fas fa-times"></i>
                            Cancelar
                        </button>
                    </div>
                ` : ''}

                ${appointment.status === 'confirmed' ? `
                    <div class="appointment-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button class="btn btn-danger" onclick="cancelAppointment('${appointment.id}')" style="font-size: 0.8rem; padding: 0.5rem 1rem;">
                            <i class="fas fa-times"></i>
                            Cancelar cita
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = appointmentsHTML;
}

// Obtener texto del estado
function getStatusText(status) {
    const statusTexts = {
        'pending': 'Pendiente',
        'confirmed': 'Confirmada',
        'cancelled': 'Cancelada'
    };
    return statusTexts[status] || status;
}

// Renderizar error
function renderError(message) {
    const container = elements.appointmentsList;
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="loadAppointments()" style="margin-top: 1rem;">
                <i class="fas fa-redo"></i>
                Intentar nuevamente
            </button>
        </div>
    `;
}

// Cancelar cita
async function cancelAppointment(appointmentId) {
    // Removed confirmation dialog for immediate action
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }
        
        showNotification('Cita cancelada exitosamente', 'success');
        loadAppointments();
        
    } catch (error) {
        console.error('Error al cancelar cita:', error);
        showNotification('Error al cancelar la cita. Por favor, intenta nuevamente.', 'error');
    } finally {
        setLoading(false);
    }
}

// Resetear formulario
function resetForm() {
    elements.form?.reset();
    
    // Limpiar validaciones
    const formGroups = document.querySelectorAll('.form-group');
    formGroups.forEach(group => {
        group.classList.remove('error', 'success');
    });
    
    // Limpiar selección de razón
    const reasonContainer = document.querySelector('.reason-options');
    if (reasonContainer) {
        reasonContainer.style.border = 'none';
    }
    
    updateReasonCards();
    setDefaultDate();
}

// AGREGAR: Función faltante para actualizar tarjetas de razón
function updateReasonCards() {
    const reasonCards = document.querySelectorAll('.reason-card');
    reasonCards.forEach(card => {
        const input = card.previousElementSibling;
        if (input && input.checked) {
            card.style.borderColor = 'var(--primary-color)';
            card.style.background = 'rgba(52, 152, 219, 0.05)';
        } else {
            card.style.borderColor = 'var(--border-color)';
            card.style.background = 'white';
        }
    });
}

// Marcar campo como error
function markFieldAsError(fieldGroup) {
    fieldGroup.classList.remove('success');
    fieldGroup.classList.add('error');
}

// Marcar campo como éxito
function markFieldAsSuccess(fieldGroup) {
    fieldGroup.classList.remove('error');
    fieldGroup.classList.add('success');
}

// Controlar estado de carga
function setLoading(loading) {
    state.loading = loading;
    
    if (elements.loadingSpinner) {
        if (loading) {
            elements.loadingSpinner.style.display = 'flex';
        } else {
            elements.loadingSpinner.style.display = 'none';
        }
    }
    
    // Deshabilitar formulario durante carga
    const formElements = elements.form?.querySelectorAll('input, select, textarea, button');
    formElements?.forEach(el => {
        el.disabled = loading;
    });
}

// Mostrar notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow);
        z-index: 10000;
        max-width: 300px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    // Icono según tipo
    const icon = type === 'success' ? 'fas fa-check-circle' : 
                 type === 'error' ? 'fas fa-exclamation-circle' : 
                 'fas fa-info-circle';
      notification.innerHTML = `
        <i class="${icon}"></i>
        <span style="white-space: pre-line;">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
}

// Funciones de utilidad
function formatDate(dateString) {
    // CORREGIR: Formatear fecha sin problemas de zona horaria
    const dateParts = dateString.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);
    
    const date = new Date(year, month, day);
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    return timeString ? new Date(`2000-01-01T${timeString}`).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
}

// Agregar clase hidden al CSS si no existe
if (!document.querySelector('style[data-hidden]')) {
    const style = document.createElement('style');
    style.setAttribute('data-hidden', 'true');
    style.textContent = '.hidden { display: none !important; }';
    document.head.appendChild(style);
}

// Manejar cambios en el motivo de la cita
function handleReasonChange(event) {
    const selectedReason = event.target.value;
    const reasonContainer = document.querySelector('.reason-options');
    const notesGroup = document.getElementById('notesGroup');
    const notesInput = document.getElementById('appointmentNotes');
    const notesRequired = document.getElementById('notesRequired');
    const notesHelp = document.getElementById('notesHelp');    // Limpiar estilo de error si se selecciona un motivo
    if (reasonContainer) {
        reasonContainer.classList.remove('error');
    }
    
    // Ocultar mensaje de error específico
    const reasonError = document.getElementById('reasonError');
    if (reasonError) {
        reasonError.style.display = 'none';
    }
    
    // Mostrar/ocultar indicador de requerido para notas
    if (selectedReason === 'otra') {
        if (notesRequired) notesRequired.style.display = 'inline';
        if (notesHelp) notesHelp.textContent = 'Requerido - Especifica el motivo de tu cita';
        if (notesInput) {
            notesInput.placeholder = 'Especifica el motivo de tu cita (mínimo 10 caracteres)...';
            notesInput.required = true;
        }
    } else {
        if (notesRequired) notesRequired.style.display = 'none';
        if (notesHelp) notesHelp.textContent = 'Opcional - Proporciona detalles adicionales sobre tu cita';
        if (notesInput) {
            notesInput.placeholder = 'Describe cualquier información adicional...';
            notesInput.required = false;
        }
        
        // Limpiar error de notas si ya no es requerido
        if (notesGroup) {
            markFieldAsSuccess(notesGroup);
        }
    }
}

// Manejar entrada de texto en notas
function handleNotesInput(event) {
    const selectedReason = document.querySelector('input[name="reason"]:checked')?.value;
    
    if (selectedReason === 'otra') {
        const notesGroup = event.target.closest('.form-group');
        const text = event.target.value.trim();
        
        if (text.length === 0) {
            markFieldAsError(notesGroup);
        } else if (text.length < 10) {
            // Mostrar un estilo intermedio (ni error ni éxito)
            notesGroup.classList.remove('error', 'success');
        } else {
            markFieldAsSuccess(notesGroup);
        }
    }
}

// Validar notas al perder el foco
function handleNotesValidation(event) {
    const selectedReason = document.querySelector('input[name="reason"]:checked')?.value;
    
    if (selectedReason === 'otra') {
        const notesGroup = event.target.closest('.form-group');
        const text = event.target.value.trim();
        
        if (text.length === 0) {
            markFieldAsError(notesGroup);
            showNotification('Las notas son requeridas cuando seleccionas "Otra razón"', 'error');
        } else if (text.length < 10) {
            markFieldAsError(notesGroup);
            showNotification('El motivo debe tener al menos 10 caracteres', 'error');
        } else {
            markFieldAsSuccess(notesGroup);
        }
    }
}

// Función específica para validar y mostrar error de motivo
function validateAndShowReasonError() {
    const reasonSelected = document.querySelector('input[name="reason"]:checked');
    const reasonContainer = document.querySelector('.reason-options');
    const reasonError = document.getElementById('reasonError');
    
    if (!reasonSelected) {
        // Añadir clase de error con animación
        if (reasonContainer) {
            reasonContainer.classList.add('error');
            
            // Hacer scroll suave hacia el motivo
            reasonContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
        }
        
        // Mostrar mensaje de error específico
        if (reasonError) {
            reasonError.style.display = 'flex';
        }
        
        // Mostrar notificación prominente
        showNotification('⚠️ Debes seleccionar un motivo para tu cita:\n• Toma de medidas\n• Asesoría\n• Otra (especifica en notas)', 'error');
        
        return false;
    }
    
    return true;
}