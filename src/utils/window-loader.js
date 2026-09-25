// Управление задержкой при открытии окон для уменьшения мерцания
(function() {
  // После загрузки DOM - создаём экран загрузки
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoader);
  } else {
    initLoader();
  }

  function initLoader() {
    if (!document.body) {
      return;
    }

    // Создаём экран загрузки с skeleton toolbar
    const loader = document.createElement('div');
    loader.className = 'window-loader';
    loader.innerHTML = '<div class="skeleton-toolbar"></div>';
    document.documentElement.appendChild(loader);

    // Задержка 240ms для загрузки данных
    setTimeout(() => {
      document.body.style.opacity = '1';
      loader.remove();
    }, 120);
  }
})();
