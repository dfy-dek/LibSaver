// Загрузка сохраненных настроек
let wasSaved = false;

// Функция сохранения темы
async function saveTheme(theme) {
  await chrome.storage.local.set({ theme });
  // Сохраняем в localStorage для синхронного доступа при загрузке
  localStorage.setItem('theme', theme);
  // Отправляем сообщение всем открытым окнам для обновления темы
  chrome.runtime.sendMessage({ action: 'updateTheme', theme });
}

// Функция применения выбранного пользователем акцентного цвета
function applyUserAccent(accent) {
  const root = document.documentElement;
  const isDark = !document.documentElement.hasAttribute('data-theme');

  const colors = {
    'manga': { dark: '#ef6c00', light: '#ff9100', hoverDark: '#d86201', hoverLight: '#fe9b18' },
    'hentai': { dark: '#b71c1c', light: '#f44336', hoverDark: '#a61a1a', hoverLight: '#f45449' },
    'slash': { dark: '#ad1457', light: '#d81b60', hoverDark: '#9d134f', hoverLight: '#da306e' },
    'ranobe': { dark: '#1565c0', light: '#2196f3', hoverDark: '#145cae', hoverLight: '#369ff3' },
    'anime': { dark: '#5e35b1', light: '#5e35b1', hoverDark: '#5631a0', hoverLight: '#6d48b7' },
    'social': { dark: '#526cfe', light: '#526cfe', hoverDark: '#425efa', hoverLight: '#425efa' },
    'pink': { dark: '#e91e63', light: '#e91e63', hoverDark: '#c2185b', hoverLight: '#c2185b' },
    'beige': { dark: '#d4a574', light: '#d4a574', hoverDark: '#b89564', hoverLight: '#b89564' },
    'yellow': { dark: '#ffc107', light: '#ffc107', hoverDark: '#ffb300', hoverLight: '#ffb300' },
    'green': { dark: '#4caf50', light: '#4caf50', hoverDark: '#43a047', hoverLight: '#43a047' },
    'mint': { dark: '#4db6ac', light: '#4db6ac', hoverDark: '#4db6ac', hoverLight: '#4db6ac' }
  };

  const color = colors[accent];
  if (color) {
    if (isDark) {
      root.style.setProperty('--accent-color', color.dark);
      root.style.setProperty('--accent-hover', color.hoverDark);
      root.style.setProperty('--accent-soft', `${color.dark}33`);
      root.style.setProperty('--checkbox-color', color.dark);
    } else {
      root.style.setProperty('--accent-color', color.light);
      root.style.setProperty('--accent-hover', color.hoverLight);
      root.style.setProperty('--accent-soft', `${color.light}33`);
      root.style.setProperty('--checkbox-color', color.light);
    }
  }
}

// Слушатель сообщений для обновления темы
setupThemeMessageListener();

// Дефолтные поля метаданных
const DEFAULT_METADATA_FIELDS = {
  'title-ru': true,
  'title-en': true,
  'title-original': true,
  'title-alt': true,
  'author': true,
  'artist': true,
  'year': true,
  'status': true,
  'country': true,
  'publisher': true,
  'age-restriction': true,
  'description': true,
  'genres': true,
  'tags': true
};

// Применение настроек к UI
function applySettingsToUI(settings, metadataFields) {
  document.getElementById('cover-quality').value = settings.coverQuality || 'ORIGINAL';
  document.getElementById('image-quality').value = settings.imageQuality || 'ORIGINAL';
  document.getElementById('resize-method').value = settings.resizeMethod || 'MIN_SIDE';
  document.getElementById('adaptive-ratio').value = settings.adaptiveRatio || 3;
  document.getElementById('adaptive-ratio-value').textContent = (settings.adaptiveRatio || 3) + ':1';
  document.getElementById('jpeg-quality').value = settings.jpegQuality || 1.0;
  document.getElementById('jpeg-quality-value').textContent = settings.jpegQuality || 1.0;
  document.getElementById('image-format').value = settings.imageFormat || 'original';
  document.getElementById('disable-toc').checked = settings.disableToc || false;
  document.getElementById('disable-site-menu').checked = settings.disableSiteMenu || false;
  document.getElementById('debug-logging').checked = settings.debugLogging || false;

  // PDF settings
  document.getElementById('pdf-font').value = settings.pdfFont || 'merriweather';
  // Применяем шрифт к select
  const fontSelect = document.getElementById('pdf-font');
  if (fontSelect) {
    const selectedOption = fontSelect.options[fontSelect.selectedIndex];
    if (selectedOption) {
      const fontName = selectedOption.textContent;
      fontSelect.style.fontFamily = fontName;
    }
  }
  document.getElementById('pdf-font-size').value = settings.pdfFontSize || 12;
  document.getElementById('pdf-page-size').value = settings.pdfPageSize || 'A5';
  document.getElementById('pdf-line-spacing').value = settings.pdfLineSpacing !== undefined ? String(settings.pdfLineSpacing) : '2';
  document.getElementById('pdf-paragraph-spacing').value = settings.pdfParagraphSpacing !== undefined ? String(settings.pdfParagraphSpacing) : '1';
  document.getElementById('pdf-image-format').value = settings.pdfImageFormat || 'original-png';
  document.getElementById('pdf-jpeg-quality').value = settings.pdfJpegQuality || 1.0;
  document.getElementById('pdf-jpeg-quality-value').textContent = settings.pdfJpegQuality || 1.0;

  // TOC format settings
  document.getElementById('toc-format').value = settings.tocFormat || 'default';
  document.getElementById('custom-toc-format').value = settings.customTocFormat || '';
  document.getElementById('hide-chapter-name').checked = settings.hideChapterName || false;
  document.getElementById('hide-volume-number').checked = settings.hideVolumeNumber || false;

  // TXT settings
  document.getElementById('txt-image-marker').value = settings.txtImageMarker || 'numbered';

  // Show/hide custom format field and disable/enable checkboxes
  updateTocFormatFields();
  
  // Save original option texts
  saveOriginalOptionTexts();
  
  // Update option texts based on checkboxes
  updateTocOptionTexts();
  
  // Metadata fields
  const fieldsData = metadataFields || {};
  const metadataCheckboxes = document.querySelectorAll('[data-field]');
  metadataCheckboxes.forEach(checkbox => {
    const fieldId = checkbox.getAttribute('data-field');
    checkbox.checked = fieldsData[fieldId] !== false;
  });
  
  // Update resize method visibility
  updateResizeMethodVisibility();
}

// Показать/скрыть метод сжатия в зависимости от качества
function updateResizeMethodVisibility() {
  const coverQuality = document.getElementById('cover-quality')?.value || 'ORIGINAL';
  const imageQuality = document.getElementById('image-quality')?.value || 'ORIGINAL';
  const resizeMethodField = document.getElementById('resize-method')?.closest('.field');
  const adaptiveField = document.getElementById('adaptive-ratio-field');
  
  if (!resizeMethodField || !adaptiveField) return;
  
  // Скрываем метод сжатия только если нет сжатия вообще:
  // - Оба ORIGINAL (без сжатия)
  // - Оба NONE (без картинок/обложек)
  // - Один ORIGINAL, другой NONE
  const hasCompression = (coverQuality !== 'ORIGINAL' && coverQuality !== 'NONE') || 
                         (imageQuality !== 'ORIGINAL' && imageQuality !== 'NONE');
  
  if (!hasCompression) {
    resizeMethodField.style.display = 'none';
    adaptiveField.style.display = 'none';
  } else {
    resizeMethodField.style.display = 'flex';
    // Показать/скрыть адаптивное поле в зависимости от выбранного метода
    if (document.getElementById('resize-method').value === 'ADAPTIVE') {
      adaptiveField.style.display = 'block';
    } else {
      adaptiveField.style.display = 'none';
    }
  }
}

// Показать/скрыть ползунок качества в зависимости от формата
function updateJpegQualityFieldVisibility() {
  const imageFormat = document.getElementById('image-format')?.value || 'original';
  const jpegQualityField = document.getElementById('jpeg-quality-field');
  const jpegQualityLabel = document.getElementById('jpeg-quality-label');
  if (!jpegQualityField) return;

  if (imageFormat === 'jpeg' || imageFormat === 'webp') {
    jpegQualityField.style.display = 'block';
    // Обновляем название в зависимости от формата
    if (jpegQualityLabel) {
      jpegQualityLabel.textContent = imageFormat === 'jpeg' ? 'Качество JPEG' : 'Качество WebP';
    }
  } else {
    jpegQualityField.style.display = 'none';
  }
}

// Показать/скрыть ползунок качества JPEG для PDF в зависимости от формата
function updatePdfJpegQualityFieldVisibility() {
  const pdfImageFormat = document.getElementById('pdf-image-format')?.value || 'original-png';
  const pdfJpegQualityField = document.getElementById('pdf-jpeg-quality-field');
  if (!pdfJpegQualityField) return;

  // Ползунок нужен только для "Исходный, иначе JPEG" (для WebP/AVIF/GIF)
  if (pdfImageFormat === 'original-jpeg') {
    pdfJpegQualityField.style.display = 'block';
  } else {
    pdfJpegQualityField.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем и применяем тему
  const theme = await loadAndApplyTheme();
  
  // Применяем акцентный цвет по сайту (из storage)
  const result = await chrome.storage.local.get(['sourceUrl']);
  const sourceUrl = result.sourceUrl;
  if (sourceUrl) {
    window.applySiteAccent(sourceUrl);
  }
  
  // Настраиваем dropdown для темы
  const themeSelect = document.getElementById('theme-select');
  const themeDropdown = document.getElementById('theme-dropdown');
  const themeOptions = document.querySelectorAll('.theme-dropdown-option');
  
  if (themeSelect && themeDropdown) {
    // Устанавливаем текущую тему
    const themeLabels = {
      'dark': 'Тёмная',
      'light': 'Светлая',
      'system': 'Системная'
    };
    themeSelect.textContent = themeLabels[theme] || 'Тёмная';
    
    // Обновляем selected класс
    themeOptions.forEach(option => {
      option.classList.remove('selected');
      if (option.dataset.value === theme) {
        option.classList.add('selected');
      }
    });
    
    // Открытие dropdown при клике
    themeSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      themeDropdown.style.display = themeDropdown.style.display === 'none' ? 'block' : 'none';
      // Закрываем accent dropdown если открыт
      if (accentDropdown) {
        accentDropdown.style.display = 'none';
      }
    });
    
    // Выбор опции
    themeOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const newTheme = option.dataset.value;
        
        // Обновляем UI
        themeSelect.textContent = themeLabels[newTheme];
        themeOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        themeDropdown.style.display = 'none';
        
        // Применяем и сохраняем тему
        applyTheme(newTheme);
        saveTheme(newTheme);
      });
    });
    
    // Закрытие dropdown при клике вне
    document.addEventListener('click', () => {
      themeDropdown.style.display = 'none';
    });
  }

  // Настраиваем dropdown для акцентного цвета
  const accentSelect = document.getElementById('accent-select');
  const accentDropdown = document.getElementById('accent-dropdown');
  const accentOptions = document.querySelectorAll('.accent-dropdown-option');

  if (accentSelect && accentDropdown) {
    // Загружаем сохранённый акцентный цвет
    const accentResult = await chrome.storage.local.get(['accentColor']);
    const userAccent = accentResult.accentColor || 'auto';

    // Названия цветов
    const accentLabels = {
      'auto': 'Авто',
      'manga': 'MangaLIB',
      'hentai': 'HentaiLIB',
      'slash': 'SlashLIB',
      'ranobe': 'RanobeLIB',
      'anime': 'AnimeLIB',
      'social': 'SocialLIB',
      'pink': 'Розовый',
      'beige': 'Бежевый',
      'yellow': 'Жёлтый',
      'green': 'Зелёный',
      'mint': 'Мятный'
    };

    accentSelect.textContent = accentLabels[userAccent] || 'Авто';

    // Обновляем selected класс
    accentOptions.forEach(option => {
      option.classList.remove('selected');
      if (option.dataset.value === userAccent) {
        option.classList.add('selected');
      }
    });

    // Открытие dropdown при клике
    accentSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      accentDropdown.style.display = accentDropdown.style.display === 'none' ? 'block' : 'none';
      // Закрываем theme dropdown если открыт
      if (themeDropdown) {
        themeDropdown.style.display = 'none';
      }
    });

    // Выбор опции
    accentOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const newAccent = option.dataset.value;

        // Обновляем UI
        accentSelect.textContent = accentLabels[newAccent];
        accentOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        accentDropdown.style.display = 'none';

        // Сохраняем и применяем акцентный цвет
        chrome.storage.local.set({ accentColor: newAccent });

        if (newAccent === 'auto') {
          // При выборе "Авто" применяем цвет по сайту
          window.applySiteAccent(sourceUrl);
        } else {
          window.applyUserAccent(newAccent);
        }

        // Отправляем сообщение всем открытым окнам для обновления цвета
        chrome.runtime.sendMessage({ action: 'updateAccent', accent: newAccent });
      });
    });

    // Закрытие dropdown при клике вне
    document.addEventListener('click', () => {
      accentDropdown.style.display = 'none';
    });
  }

  const settings = await chrome.storage.local.get([
    'coverQuality',
    'imageQuality',
    'resizeMethod',
    'adaptiveRatio',
    'jpegQuality',
    'imageFormat',
    'disableToc',
    'disableSiteMenu',
    'debugLogging',
    'tocFormat',
    'customTocFormat',
    'hideChapterName',
    'hideVolumeNumber',
    'txtImageMarker',
    'pdfFont',
    'pdfFontSize',
    'pdfPageSize',
    'pdfLineSpacing',
    'pdfParagraphSpacing',
    'pdfImageFormat',
    'pdfJpegQuality'
  ]);
  
  const metadataFields = await chrome.storage.local.get(['metadataFields']);

  // Применяем сохраненные настройки
  applySettingsToUI(settings, metadataFields.metadataFields);

  // Инициализация видимости полей
  updateJpegQualityFieldVisibility();
  updatePdfJpegQualityFieldVisibility();

  // Обновление значения ползунка адаптивного соотношения
  document.getElementById('adaptive-ratio').addEventListener('input', (e) => {
    document.getElementById('adaptive-ratio-value').textContent = e.target.value + ':1';
  });

  // Обновление значения ползунка качества JPEG
  document.getElementById('jpeg-quality').addEventListener('input', (e) => {
    document.getElementById('jpeg-quality-value').textContent = e.target.value;
  });

  // Обновление значения ползунка качества JPEG для PDF
  document.getElementById('pdf-jpeg-quality').addEventListener('input', (e) => {
    document.getElementById('pdf-jpeg-quality-value').textContent = e.target.value;
  });

  document.getElementById('image-format').addEventListener('change', updateJpegQualityFieldVisibility);
  document.getElementById('pdf-image-format').addEventListener('change', updatePdfJpegQualityFieldVisibility);

  // Отслеживаем изменения качества
  document.getElementById('cover-quality').addEventListener('change', updateResizeMethodVisibility);
  document.getElementById('image-quality').addEventListener('change', updateResizeMethodVisibility);
  document.getElementById('resize-method').addEventListener('change', updateResizeMethodVisibility);

  // Инициализация отображения
  updateResizeMethodVisibility();
  updateJpegQualityFieldVisibility();
  updatePdfJpegQualityFieldVisibility();
  
  // TOC format change handler
  document.getElementById('toc-format').addEventListener('change', updateTocFormatFields);
  
  // Checkbox change handlers for visual option updates
  document.getElementById('hide-chapter-name').addEventListener('change', updateTocOptionTexts);
  document.getElementById('hide-volume-number').addEventListener('change', updateTocOptionTexts);

  // Показать предупреждение о перезагрузке при изменении настройки меню
  const originalDisableSiteMenu = document.getElementById('disable-site-menu').checked;
  document.getElementById('disable-site-menu').addEventListener('change', function() {
    const currentValue = this.checked;
    if (currentValue !== originalDisableSiteMenu) {
      document.getElementById('reload-warning').style.display = 'flex';
    } else {
      document.getElementById('reload-warning').style.display = 'none';
    }
  });

  // Обработчики кнопок сброса по группам
  document.querySelectorAll('.btn-reset-group').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.getAttribute('data-group');
      resetGroupSettings(group);
    });
  });
});

// Show/hide custom format fields based on selection
function updateTocFormatFields() {
  const tocFormat = document.getElementById('toc-format').value;
  const customField = document.getElementById('custom-toc-format-field');
  const hideChapterNameCheckbox = document.getElementById('hide-chapter-name');
  const hideVolumeNumberCheckbox = document.getElementById('hide-volume-number');
  
  if (tocFormat === 'custom') {
    customField.style.display = 'flex';
    // Блокируем галочки при пользовательском формате
    hideChapterNameCheckbox.disabled = true;
    hideVolumeNumberCheckbox.disabled = true;
  } else {
    customField.style.display = 'none';
    // Разблокируем галочки для встроенных форматов
    hideChapterNameCheckbox.disabled = false;
    hideVolumeNumberCheckbox.disabled = false;
  }
}

// Save original option texts
function saveOriginalOptionTexts() {
  const tocSelect = document.getElementById('toc-format');
  const options = tocSelect.querySelectorAll('option');
  options.forEach(option => {
    option.setAttribute('data-original-text', option.textContent);
  });
}

// Update option texts based on checkboxes
function updateTocOptionTexts() {
  const hideChapterName = document.getElementById('hide-chapter-name').checked;
  const hideVolumeNumber = document.getElementById('hide-volume-number').checked;
  const tocSelect = document.getElementById('toc-format');
  const options = tocSelect.querySelectorAll('option');
  
  // Сначала показываем все option'ы
  options.forEach(option => {
    option.style.display = '';
  });
  
  const textCounts = {};
  
  options.forEach(option => {
    const originalText = option.getAttribute('data-original-text');
    if (!originalText) return;
    
    // Не меняем текст для пользовательского формата
    if (option.value === 'custom') {
      option.textContent = originalText;
      return;
    }
    
    let text = originalText;
    
    // Применяем те же преобразования, что и в popup.js
    if (hideVolumeNumber) {
      // Убираем всё до "Глава" включительно
      text = text.replace(/.*Глава\s*/, 'Глава ');
    }
    
    if (hideChapterName) {
      // Убираем всё после номера главы (в option'ах используется Y как номер)
      // Сначала проверяем, есть ли точка сразу после Y
      const hasDotAfterY = /Глава\s+Y\./.test(text);
      
      // Убираем всё после номера главы
      text = text.replace(/(Глава\s+Y).*$/, '$1').trim();
      
      // Если была точка сразу после Y, возвращаем её
      if (hasDotAfterY) {
        text += '.';
      }
    }
    
    option.textContent = text.trim();
    
    // Считаем количество одинаковых текстов (кроме пользовательского формата)
    if (option.value !== 'custom') {
      textCounts[text] = (textCounts[text] || 0) + 1;
    }
  });
  
  // Скрываем дубликаты (оставляем первый из каждого)
  const seenTexts = new Set();
  options.forEach(option => {
    if (option.value === 'custom') return; // Пользовательский формат всегда видим
    
    const text = option.textContent;
    if (textCounts[text] > 1) {
      if (seenTexts.has(text)) {
        option.style.display = 'none';
      } else {
        seenTexts.add(text);
      }
    }
  });
}

// Сохранение настроек
document.getElementById('btn-save').addEventListener('click', async () => {
  // Metadata fields
  const metadataFields = {};
  const metadataCheckboxes = document.querySelectorAll('[data-field]');
  metadataCheckboxes.forEach(checkbox => {
    const fieldId = checkbox.getAttribute('data-field');
    metadataFields[fieldId] = checkbox.checked;
  });

  const settings = {
    coverQuality: document.getElementById('cover-quality').value,
    imageQuality: document.getElementById('image-quality').value,
    resizeMethod: document.getElementById('resize-method').value,
    adaptiveRatio: parseFloat(document.getElementById('adaptive-ratio').value),
    jpegQuality: parseFloat(document.getElementById('jpeg-quality').value),
    imageFormat: document.getElementById('image-format').value,
    disableToc: document.getElementById('disable-toc').checked,
    disableSiteMenu: document.getElementById('disable-site-menu').checked,
    debugLogging: document.getElementById('debug-logging').checked,
    tocFormat: document.getElementById('toc-format').value,
    customTocFormat: document.getElementById('custom-toc-format').value,
    hideChapterName: document.getElementById('hide-chapter-name').checked,
    hideVolumeNumber: document.getElementById('hide-volume-number').checked,
    txtImageMarker: document.getElementById('txt-image-marker').value,
    pdfFont: document.getElementById('pdf-font').value,
    pdfFontSize: parseInt(document.getElementById('pdf-font-size').value),
    pdfPageSize: document.getElementById('pdf-page-size').value,
    pdfLineSpacing: parseInt(document.getElementById('pdf-line-spacing').value),
    pdfParagraphSpacing: parseFloat(document.getElementById('pdf-paragraph-spacing').value),
    pdfImageFormat: document.getElementById('pdf-image-format').value,
    pdfJpegQuality: parseFloat(document.getElementById('pdf-jpeg-quality').value)
  };

  await chrome.storage.local.set(settings);
  await chrome.storage.local.set({ metadataFields: metadataFields });

  wasSaved = true;
  
  // Отправляем сообщение в popup для показа toast
  chrome.runtime.sendMessage({ action: 'showToast', message: 'Сохранено!', type: 'success' });
  
  // Закрываем окно настроек
  if (window && window.close) {
    window.close();
  }
});

// Дефолтные значения по группам
const DEFAULT_SETTINGS_BY_GROUP = {
  general: {
    'disable-toc': false,
    'disable-site-menu': false,
    'debug-logging': false
  },
  images: {
    'cover-quality': 'ORIGINAL',
    'image-quality': 'ORIGINAL',
    'resize-method': 'MIN_SIDE',
    'adaptive-ratio': 3,
    'jpeg-quality': 1.0,
    'image-format': 'original'
  },
  toc: {
    'disable-toc': false,
    'toc-format': 'default',
    'custom-toc-format': '',
    'hide-chapter-name': false,
    'hide-volume-number': false
  },
  txt: {
    'txt-image-marker': 'numbered'
  },
  pdf: {
    'pdf-font': 'merriweather',
    'pdf-font-size': 12,
    'pdf-page-size': 'A5',
    'pdf-line-spacing': 2,
    'pdf-paragraph-spacing': 1,
    'pdf-image-format': 'original-png',
    'pdf-jpeg-quality': 1.0
  },
  metadata: DEFAULT_METADATA_FIELDS
};

// Сброс настроек конкретной группы
function resetGroupSettings(group) {
  const defaults = DEFAULT_SETTINGS_BY_GROUP[group];
  if (!defaults) return;

  if (group === 'metadata') {
    // Сброс чекбоксов метаданных
    const metadataCheckboxes = document.querySelectorAll('[data-field]');
    metadataCheckboxes.forEach(checkbox => {
      const fieldId = checkbox.getAttribute('data-field');
      checkbox.checked = defaults[fieldId] !== false;
      // Убираем inline стили, чтобы CSS работал корректно
      const indicator = checkbox.parentElement.querySelector('.control__indicator');
      if (indicator) {
        const checkedIcon = indicator.querySelector('svg[data-state="checked"]');
        const defaultIcon = indicator.querySelector('svg[data-state="default"]');
        if (checkedIcon) checkedIcon.style.display = '';
        if (defaultIcon) defaultIcon.style.display = '';
        if (checkedIcon) checkedIcon.style.color = '';
      }
    });
  } else if (group === 'toc') {
    // Сброс настроек оглавления с восстановлением текстов option'ов
    const tocSelect = document.getElementById('toc-format');
    const options = tocSelect.querySelectorAll('option');
    options.forEach(option => {
      option.style.display = '';
      const originalText = option.getAttribute('data-original-text');
      if (originalText) {
        option.textContent = originalText;
      }
    });

    for (const [key, value] of Object.entries(defaults)) {
      const element = document.getElementById(key);
      if (!element) continue;

      if (element.type === 'checkbox') {
        element.checked = value;
        // Убираем inline стили, чтобы CSS работал корректно
        const indicator = element.parentElement.querySelector('.control__indicator');
        if (indicator) {
          const checkedIcon = indicator.querySelector('i[data-state="checked"]');
          const defaultIcon = indicator.querySelector('i[data-state="default"]');
          if (checkedIcon) checkedIcon.style.display = '';
          if (defaultIcon) defaultIcon.style.display = '';
          if (checkedIcon) checkedIcon.style.color = '';
        }
      } else if (element.tagName === 'SELECT' || element.tagName === 'INPUT') {
        element.value = value;
      }
    }

    // Обновляем видимость полей после сброса
    updateTocFormatFields();

    // Отправляем сообщение для обновления полей в редакторе оглавления
    chrome.runtime.sendMessage({ action: 'tocSettingsReset', settings: defaults });
  } else if (group === 'txt') {
    // Сброс настроек TXT
    for (const [key, value] of Object.entries(defaults)) {
      const element = document.getElementById(key);
      if (!element) continue;

      if (element.tagName === 'SELECT' || element.tagName === 'INPUT') {
        element.value = value;
      }
    }

    // Обновляем видимость полей после сброса
    updateJpegQualityFieldVisibility();
  } else if (group === 'pdf') {
    // Сброс настроек PDF
    for (const [key, value] of Object.entries(defaults)) {
      const element = document.getElementById(key);
      if (!element) continue;

      if (element.tagName === 'SELECT' || element.tagName === 'INPUT') {
        // Используем String() для правильной конвертации чисел
        element.value = String(value);
      }
    }

    // Обновляем видимость полей после сброса
    updatePdfJpegQualityFieldVisibility();
  } else {
    // Сброс обычных настроек
    for (const [key, value] of Object.entries(defaults)) {
      const element = document.getElementById(key);
      if (!element) continue;

      if (element.type === 'checkbox') {
        element.checked = value;
        // Убираем inline стили, чтобы CSS работал корректно
        const indicator = element.parentElement.querySelector('.control__indicator');
        if (indicator) {
          const checkedIcon = indicator.querySelector('i[data-state="checked"]');
          const defaultIcon = indicator.querySelector('i[data-state="default"]');
          if (checkedIcon) checkedIcon.style.display = '';
          if (defaultIcon) defaultIcon.style.display = '';
          if (checkedIcon) checkedIcon.style.color = '';
        }
      } else if (element.type === 'range' || element.tagName === 'SELECT') {
        element.value = value;
        // Обновляем отображение значений для range
        if (key === 'adaptive-ratio') {
          document.getElementById('adaptive-ratio-value').textContent = value + ':1';
        }
        if (key === 'jpeg-quality') {
          document.getElementById('jpeg-quality-value').textContent = value;
        }
        if (key === 'pdf-jpeg-quality') {
          document.getElementById('pdf-jpeg-quality-value').textContent = value;
        }
      }
    }
  }

  // Обновляем видимость полей после сброса (для групп без специальной обработки)
  if (group === 'general' || group === 'images') {
    updateResizeMethodVisibility();
    updateJpegQualityFieldVisibility();
  }

  // Применяем шрифт к select после сброса PDF группы
  if (group === 'pdf') {
    const fontSelect = document.getElementById('pdf-font');
    if (fontSelect) {
      const selectedOption = fontSelect.options[fontSelect.selectedIndex];
      if (selectedOption) {
        const fontName = selectedOption.textContent;
        fontSelect.style.fontFamily = fontName;
      }
    }
  }

  // Устанавливаем флаг, что изменения не сохранены
  wasSaved = false;
}

// Сброс настроек к значениям по умолчанию
document.getElementById('btn-reset').addEventListener('click', async () => {
  const defaultSettings = {
    coverQuality: 'ORIGINAL',
    imageQuality: 'ORIGINAL',
    resizeMethod: 'MIN_SIDE',
    adaptiveRatio: 3,
    enableMetadataEditor: true,
    enableCoverEditor: true,
    enableChaptersEditor: true,
    disableToc: false, // Включено по умолчанию - оглавление + отдельная страница
    tocFormat: 'default',
    customTocFormat: '',
    hideChapterName: false,
    hideVolumeNumber: false,
    pdfImageFormat: 'original-png',
    pdfJpegQuality: 1.0
  };

  // Сбрасываем тексты option'ов к оригинальным
  const tocSelect = document.getElementById('toc-format');
  const options = tocSelect.querySelectorAll('option');
  options.forEach(option => {
    option.style.display = '';
    const originalText = option.getAttribute('data-original-text');
    if (originalText) {
      option.textContent = originalText;
    }
  });

  // Применяем дефолтные настройки к UI (но не сохраняем в storage)
  applySettingsToUI(defaultSettings, DEFAULT_METADATA_FIELDS);

  // Применяем шрифт к select после полного сброса
  const fontSelect = document.getElementById('pdf-font');
  if (fontSelect) {
    const selectedOption = fontSelect.options[fontSelect.selectedIndex];
    if (selectedOption) {
      const fontName = selectedOption.textContent;
      fontSelect.style.fontFamily = fontName;
    }
  }

  // Обновляем видимость полей после сброса
  updateTocFormatFields();
  updateResizeMethodVisibility();
  updateJpegQualityFieldVisibility();
  updatePdfJpegQualityFieldVisibility();
  updateTocOptionTexts();

  // Устанавливаем флаг, что изменения не сохранены
  wasSaved = false;
});

// Переопределяем слушатель сообщений для обновления темы
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateTheme' && message.theme) {
    applyTheme(message.theme);
  }
});

// Инициализируем после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  // Загружаем шрифты для превью в селекторе
  const fontSelect = document.getElementById('pdf-font');
  if (fontSelect) {
    const fonts = [
      { name: 'DejaVu Sans', path: 'assets/fonts/DejaVuSans.ttf' },
      { name: 'Inter', path: 'assets/fonts/Inter-Regular.ttf' },
      { name: 'Merriweather', path: 'assets/fonts/Merriweather-Regular.ttf' },
      { name: 'Montserrat', path: 'assets/fonts/Montserrat-Regular.ttf' },
      { name: 'Open Sans', path: 'assets/fonts/OpenSans-Regular.ttf' },
      { name: 'Roboto', path: 'assets/fonts/Roboto-Regular.ttf' },
      { name: 'Playfair Display', path: 'assets/fonts/PlayfairDisplay-Regular.ttf' },
      { name: 'Noto Serif', path: 'assets/fonts/NotoSerif-Regular.ttf' },
      { name: 'Lora', path: 'assets/fonts/Lora-Regular.ttf' },
      { name: 'Crimson Text', path: 'assets/fonts/CrimsonText-Regular.ttf' }
    ];

    // Загружаем каждый шрифт через FontFace API
    fonts.forEach(font => {
      const fontUrl = chrome.runtime.getURL(font.path);
      const fontFace = new FontFace(font.name, `url(${fontUrl})`);
      fontFace.load().then(loadedFace => {
        document.fonts.add(loadedFace);
      }).catch(err => {
        console.error(`Failed to load font ${font.name}:`, err);
      });
    });

    // Применяем шрифт к селектору при изменении
    fontSelect.addEventListener('change', () => {
      const selectedOption = fontSelect.options[fontSelect.selectedIndex];
      const fontName = selectedOption.textContent;
      fontSelect.style.fontFamily = fontName;
    });

    // Применяем шрифт к текущему выбранному option
    const currentOption = fontSelect.options[fontSelect.selectedIndex];
    if (currentOption) {
      const fontName = currentOption.textContent;
      fontSelect.style.fontFamily = fontName;
    }
  }
});

// Инициализация tippy для кнопки помощи на toolbar
let tippyInstance = null;

function initToolbarTippy() {
  if (typeof window.tippy === 'undefined') {
    console.error('tippy library not loaded');
    return;
  }

  if (tippyInstance) {
    tippyInstance.destroy();
  }

  const helpButton = document.querySelector('.btn-help-toolbar');
  if (helpButton) {
    const tooltipText = helpButton.getAttribute('data-tooltip');
    if (tooltipText) {
      tippyInstance = window.tippy(helpButton, {
        content: `<div class="toolbar-tooltip-wrapper">${tooltipText}</div>`,
        allowHTML: true,
        placement: 'bottom',
        trigger: 'mouseenter',
        interactive: true,
        arrow: false,
        hideOnClick: false,
        offset: [0, 4]
      });
    }
  }
}

// Инициализируем после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  initToolbarTippy();
});

// Отправляем toast при закрытии без сохранения
window.addEventListener('beforeunload', () => {
  if (tippyInstance) {
    tippyInstance.destroy();
  }
  if (!wasSaved) {
    chrome.runtime.sendMessage({ action: 'showToast', message: 'Отменено!', type: 'cancel' });
  }
});
