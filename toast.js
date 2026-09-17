// toast.js - Модуль для toast уведомлений

let toastQueue = [];
const MAX_TOASTS = 2;

// Показать toast уведомление
function showToast(message, type = 'success') {
  const toast = {
    message,
    type,
    id: Date.now()
  };
  
  // Ограничиваем количество toast в очереди
  if (toastQueue.length >= MAX_TOASTS) {
    toastQueue.shift(); // Удаляем самый старый
  }
  
  toastQueue.push(toast);
  processToastQueue();
}

// Обработка очереди toast
function processToastQueue() {
  if (toastQueue.length === 0) return;
  
  // Проверяем количество видимых toast
  const visibleToasts = document.querySelectorAll('.toast.show');
  if (visibleToasts.length >= MAX_TOASTS) {
    return; // Ждём пока освободится место
  }
  
  const toastData = toastQueue.shift();
  createToastElement(toastData);
}

// Создание элемента toast
function createToastElement(toastData) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${toastData.type}`;
  toast.id = `toast-${toastData.id}`;
  
  const icon = toastData.type === 'success' ? 'fa-check' : 'fa-xmark';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${toastData.message}</span>`;
  
  container.appendChild(toast);
  
  // Force reflow
  toast.offsetHeight;
  
  // Показываем toast
  toast.classList.add('show');
  
  // Автоматически скрываем через 2 секунды
  setTimeout(() => {
    hideToast(toast);
  }, 2000);
}

// Скрытие toast
function hideToast(toast) {
  toast.classList.remove('show');
  toast.classList.add('hide');
  
  setTimeout(() => {
    toast.remove();
    processToastQueue();
  }, 200);
}
