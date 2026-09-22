// Глобальные переменные
let allChapters = [];
let originalChapters = [];
let userChapters = [];
let currentSlug = null;
let wasSaved = false;
let translatorPriority = [];

// Слушатель сообщений для обновления темы
setupThemeMessageListener();

let tocFormat = 'default';
let customTocFormat = '';
let hideChapterName = false;
let hideVolumeNumber = false;

function getUniqueChapters(chapters) {
  const uniqueChapterIds = new Set();
  const uniqueChapters = [];
  
  chapters.forEach(ch => {
    if (!uniqueChapterIds.has(ch.id)) {
      uniqueChapterIds.add(ch.id);
      uniqueChapters.push(ch);
    }
  });
  
  return uniqueChapters;
}

function extractBranches() {
  branches = {};
  
  allChapters.forEach(ch => {
    // Нормализуем branches: если это объект, конвертируем в массив
    let branchesList = ch.branches;
    if (branchesList && !Array.isArray(branchesList)) {
      branchesList = Object.values(branchesList);
    }
    
    if (branchesList && Array.isArray(branchesList) && branchesList.length > 0) {
      branchesList.forEach(branch => {
        const translatorKey = getTranslatorKey(branch);
        const translatorName = getTranslatorName(branch);
        
        if (!branches[translatorKey]) {
          branches[translatorKey] = translatorName;
        }
      });
    } else {
      const branchId = ch.branchId === null ? 'null' : ch.branchId;
      const teamName = ch.branchTeamName || 'Основной перевод';
      const translatorKey = `${branchId}_unknown`;
      if (!branches[translatorKey]) {
        branches[translatorKey] = teamName;
      }
    }
  });
}

function getTranslatorKey(branch) {
  const branchId = branch.branch_id === null ? 'null' : branch.branch_id;
  let teamId = 'unknown';
  if (branch.teams && branch.teams[0]) {
    teamId = branch.teams[0].id;
  } else if (branch.team) {
    teamId = branch.team.id;
  }
  return `${branchId}_${teamId}`;
}

function getTranslatorName(branch) {
  if (branch.teams && branch.teams[0]) {
    const teamName = branch.teams[0].name;
    // Если команда "Неизвестный", но есть пользователь, добавляем никнейм в скобках
    if (teamName === 'Неизвестный' && branch.user?.username) {
      return `${teamName} (${branch.user.username})`;
    }
    return teamName;
  } else if (branch.team) {
    const teamName = branch.team.name;
    if (teamName === 'Неизвестный' && branch.user?.username) {
      return `${teamName} (${branch.user.username})`;
    }
    return teamName;
  }
  return branch.user?.username || 'Основной перевод';
}

function getChapterVariants(chapterId) {
  const variants = new Map();
  allChapters.forEach(ch => {
    if (ch.id === chapterId && ch.branches && Array.isArray(ch.branches)) {
      ch.branches.forEach(branch => {
        const key = getTranslatorKey(branch);
        const name = getTranslatorName(branch);
        variants.set(key, name);
      });
    }
  });
  return variants;
}

function populateTranslators() {
  const translatorSelect = document.getElementById('translator-select');
  const translatorField = document.getElementById('translator-field');
  
  const branchIds = Object.keys(branches);
  if (branchIds.length === 0) {
    if (translatorField) translatorField.style.display = 'none';
    if (translatorSelect) translatorSelect.textContent = 'Основной перевод';
    return;
  }

  if (translatorField) translatorField.style.display = 'block';

  if (translatorPriority.length === 0) {
    const translatorCounts = {};
    allChapters.forEach(ch => {
      if (ch.branches && Array.isArray(ch.branches)) {
        ch.branches.forEach(branch => {
          const key = getTranslatorKey(branch);
          if (!translatorCounts[key]) {
            translatorCounts[key] = 0;
          }
          translatorCounts[key]++;
        });
      }
    });
    
    translatorPriority = Object.keys(translatorCounts).sort((a, b) => translatorCounts[b] - translatorCounts[a]);
  }
  
  let priorityTranslatorName = null;
  if (translatorPriority.length > 0) {
    // Находим имя переводчика для первого ключа из приоритета
    const priorityTranslatorKey = translatorPriority[0];
    priorityTranslatorName = branches[priorityTranslatorKey];
  }
  
  if (translatorSelect) {
    if (priorityTranslatorName) {
      translatorSelect.textContent = priorityTranslatorName;
    } else if (branchIds.length > 0) {
      // Если приоритет пуст или не найден, используем первый из branches
      translatorSelect.textContent = branches[branchIds[0]];
    } else {
      translatorSelect.textContent = 'Основной перевод';
    }
  }
  
  initTranslatorPriorityPopup();
}

// Загружаем и применяем тему
document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем и применяем тему
  await loadAndApplyTheme();
  
  // Применяем акцентный цвет по сайту (из storage)
  const result = await chrome.storage.local.get(['sourceUrl', 'titleData', 'originalTitleData', 'currentSlug', 'tocFormat', 'customTocFormat', 'hideChapterName', 'hideVolumeNumber']);
  const sourceUrl = result.sourceUrl;
  if (sourceUrl) {
    window.applySiteAccent(sourceUrl);
  }
  
  currentSlug = result.currentSlug || '';
  
  if (result.titleData && result.titleData[currentSlug]) {
    chapterBranchOverrides = result.titleData[currentSlug].chapterBranchOverrides || {};
    translatorPriority = result.titleData[currentSlug].translatorPriority || [];
  } else {
    chapterBranchOverrides = {};
    translatorPriority = [];
  }
  
  allChapters = [];
  originalChapters = [];
  wasSaved = false;
  branches = {};
  
  if (result.tocFormat) {
    tocFormat = result.tocFormat;
  }
  if (result.customTocFormat) {
    customTocFormat = result.customTocFormat;
  }
  if (result.hideChapterName !== undefined) {
    hideChapterName = result.hideChapterName;
  }
  if (result.hideVolumeNumber !== undefined) {
    hideVolumeNumber = result.hideVolumeNumber;
  }
  
  let totalChapters = 0;
  if (result.originalTitleData && result.originalTitleData[currentSlug] && result.originalTitleData[currentSlug].metadata) {
    totalChapters = result.originalTitleData[currentSlug].metadata.totalChapters || 0;
  }
  updateTotalChapters(totalChapters);
  
  if (result.titleData && result.titleData[currentSlug] && result.titleData[currentSlug].filteredChapters) {
    // Используем отфильтрованные главы из popup (по диапазону)
    allChapters = result.titleData[currentSlug].filteredChapters || [];
  } else if (result.titleData && result.titleData[currentSlug] && result.titleData[currentSlug].chapters) {
    // Fallback: используем все главы если filteredChapters нет
    allChapters = result.titleData[currentSlug].chapters || [];
  }
  
  if (result.originalTitleData && result.originalTitleData[currentSlug] && result.originalTitleData[currentSlug].chapters) {
    originalChapters = (result.originalTitleData[currentSlug].chapters || []).map(ch => ({
      id: ch.id,
      volume: ch.volume,
      number: ch.number,
      name: ch.name,
      branchId: ch.branchId
    }));
  } else {
    originalChapters = (result.titleData && result.titleData[currentSlug] && result.titleData[currentSlug].chapters || []).map(ch => ({
      id: ch.id,
      volume: ch.volume,
      number: ch.number,
      name: ch.name,
      branchId: ch.branchId
    }));
  }
  
  extractBranches();
  
  // Фильтруем translatorPriority, оставляя только те ключи, которые существуют в branches
  if (translatorPriority.length > 0) {
    const validPriority = [];
    for (const translatorKey of translatorPriority) {
      if (branches[translatorKey]) {
        validPriority.push(translatorKey);
      }
    }
    translatorPriority = validPriority;
  }
  
  const uniqueChapters = getUniqueChapters(allChapters);
  const uniqueOriginalChapters = getUniqueChapters(originalChapters);
  
  renderChaptersList(uniqueChapters, uniqueOriginalChapters);
  populateTranslators();
  
  // Применяем сохраненные настройки переводчиков к загруженным главам
  if (translatorPriority.length > 0 || Object.keys(chapterBranchOverrides).length > 0) {
    applyTranslatorPriority(false); // false = не перезаписывать индивидуальные override
  }
  
  const totalChaptersOnSite = result.titleData && result.titleData[currentSlug] && result.titleData[currentSlug].itemsCount ? result.titleData[currentSlug].itemsCount : allChapters.length;
  updateTotalChapters(totalChaptersOnSite);
  updateEditorChaptersCount(uniqueChapters.length);
  
  // Инициализируем кнопку Очистить всё
  initClearAllButton();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    let settingsChanged = false;
    
    if (changes.tocFormat) {
      tocFormat = changes.tocFormat.newValue;
      settingsChanged = true;
    }
    if (changes.customTocFormat) {
      customTocFormat = changes.customTocFormat.newValue;
      settingsChanged = true;
    }
    if (changes.hideChapterName) {
      hideChapterName = changes.hideChapterName.newValue;
      settingsChanged = true;
    }
    if (changes.hideVolumeNumber) {
      hideVolumeNumber = changes.hideVolumeNumber.newValue;
      settingsChanged = true;
    }
    
    if (settingsChanged) {
      const inputs = document.querySelectorAll('.chapter-input');
      const uniqueOriginalChapters = getUniqueChapters(originalChapters);
      inputs.forEach((input) => {
        const index = parseInt(input.dataset.index);
        const originalCh = uniqueOriginalChapters[index];
        if (originalCh) {
          const defaultValue = formatChapterTitle(originalCh.volume, originalCh.number, originalCh.name, tocFormat, customTocFormat, hideChapterName, hideVolumeNumber);
          input.dataset.default = defaultValue;
        }
      });
    }
  }
});

function renderChaptersList(chapters, originalChapters) {
  const container = document.getElementById('chapters-list');
  container.innerHTML = '';
  
  chapters.forEach((ch, i) => {
    const originalCh = originalChapters[i] || ch;
    const div = document.createElement('div');
    div.className = 'chapter-item';
    div.dataset.index = i;
    
    const header = document.createElement('div');
    header.className = 'chapter-header';
    
    const label = document.createElement('div');
    label.className = 'chapter-title';
    label.textContent = `Том ${originalCh.volume}. Глава ${originalCh.number}.${originalCh.name ? ' ' + originalCh.name : ''}`;
    
    header.appendChild(label);
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'chapter-reset-btn';
    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
    resetBtn.dataset.index = i;
    
    header.appendChild(resetBtn);
    div.appendChild(header);
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'chapter-input-wrapper';
    
    const input = document.createElement('input');
    input.className = 'chapter-input';
    input.type = 'text';
    const defaultValue = formatChapterTitle(originalCh.volume, originalCh.number, originalCh.name, tocFormat, customTocFormat, hideChapterName, hideVolumeNumber);
    input.dataset.default = defaultValue;
    input.value = ch.displayTitle || defaultValue;
    input.dataset.index = i;
    
    inputWrapper.appendChild(input);
    
    const variants = getChapterVariants(ch.id);
    let currentTranslatorKey = chapterBranchOverrides[ch.id];
    let currentTranslator = '';
    
    // Если нет индивидуального выбора, используем приоритет переводчиков
    if (!currentTranslatorKey && translatorPriority.length > 0) {
      for (const priorityKey of translatorPriority) {
        if (variants.has(priorityKey)) {
          currentTranslatorKey = priorityKey;
          break;
        }
      }
    }
    
    // Если всё ещё нет выбора, используем первый из branches
    if (!currentTranslatorKey && ch.branches && ch.branches[0]) {
      currentTranslatorKey = getTranslatorKey(ch.branches[0]);
    }
    
    if (currentTranslatorKey && variants.has(currentTranslatorKey)) {
      currentTranslator = variants.get(currentTranslatorKey);
    } else if (ch.branches && ch.branches[0]) {
      currentTranslator = getTranslatorName(ch.branches[0]);
    } else {
      currentTranslator = ch.branchTeamName || 'Основной перевод';
    }
    
    if (variants.size > 1) {
      const translatorSelect = document.createElement('div');
      translatorSelect.className = 'chapter-translator';
      translatorSelect.textContent = currentTranslator;
      translatorSelect.dataset.chapterId = ch.id;
      
      const dropdown = document.createElement('div');
      dropdown.className = 'chapter-translator-dropdown';
      dropdown.style.display = 'none';
      dropdown.style.position = 'absolute';
      dropdown.style.zIndex = '1000';
      
      variants.forEach((name, translatorKey) => {
        const option = document.createElement('div');
        option.className = 'chapter-translator-option';
        if (translatorKey === currentTranslatorKey) {
          option.classList.add('selected');
        }
        option.textContent = name;
        option.dataset.translatorKey = translatorKey;
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          chapterBranchOverrides[ch.id] = translatorKey;
          translatorSelect.textContent = name;
          dropdown.querySelectorAll('.chapter-translator-option').forEach(opt => opt.classList.remove('selected'));
          option.classList.add('selected');
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(option);
      });
      
      inputWrapper.appendChild(dropdown);
      inputWrapper.appendChild(translatorSelect);
      
      // ResizeObserver для динамического расчёта padding
      const resizeObserver = new ResizeObserver(() => {
        const translatorWidth = translatorSelect.offsetWidth;
        input.style.paddingRight = (translatorWidth + 12) + 'px';
      });
      resizeObserver.observe(translatorSelect);
      
      translatorSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.chapter-translator-dropdown').forEach(dd => {
          if (dd !== dropdown) dd.style.display = 'none';
        });
        const rect = translatorSelect.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = (rect.bottom + 2) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.display = dropdown.style.display !== 'none' ? 'none' : 'block';
      });
      
      document.addEventListener('click', (e) => {
        if (!translatorSelect.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
      
      inputWrapper.appendChild(translatorSelect);
    }
    
    div.appendChild(inputWrapper);
    container.appendChild(div);
  });
  
  updateEditorChaptersCount(chapters.length);
  initChapterResetButtons();
}

function updateTotalChapters(count) {
  const countElement = document.getElementById('total-chapters');
  if (countElement) {
    countElement.textContent = count;
  }
}

function updateEditorChaptersCount(count) {
  const countElement = document.getElementById('chapter-count');
  if (countElement) {
    countElement.textContent = count;
  }
}

document.getElementById('btn-save').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.chapter-input');
  const uniqueChapters = getUniqueChapters(allChapters);

  inputs.forEach((input, i) => {
    const originalCh = uniqueChapters[i];
    if (originalCh) {
      const value = input.value.trim() || input.dataset.default;
      originalCh.displayTitle = value;
    }
  });

  chrome.storage.local.get(['titleData', 'currentSlug'], (result) => {
    const titleData = result.titleData || {};
    const currentSlug = result.currentSlug;
    
    if (!titleData[currentSlug]) {
      titleData[currentSlug] = { chapters: null, metadata: {}, covers: [] };
    }
    
    // Сохраняем все главы с изменёнными названиями (для popup и prepare)
    // popup.js восстанавливает displayTitle по ключу ${id}_${branchId}
    titleData[currentSlug].chapters = allChapters;
    // Сохраняем отфильтрованные главы для редактора (чтобы знать диапазон)
    titleData[currentSlug].filteredChapters = allChapters;
    // Сохраняем настройки переводчиков
    titleData[currentSlug].chapterBranchOverrides = chapterBranchOverrides;
    titleData[currentSlug].translatorPriority = translatorPriority;
    
    chrome.storage.local.set({ titleData }, () => {
      wasSaved = true;
      chrome.runtime.sendMessage({ action: 'showToast', message: 'Сохранено!', type: 'success' });
      chrome.windows.getCurrent((window) => {
        if (window && window.id) {
          chrome.windows.remove(window.id);
        }
      });
    });
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.chapter-input');

  inputs.forEach((input) => {
    input.value = input.dataset.default;
  });
  
  const uniqueChapters = getUniqueChapters(allChapters);
  uniqueChapters.forEach(ch => {
    delete ch.displayTitle;
  });
  
  chapterBranchOverrides = {};
  translatorPriority = [];
  
  const uniqueOriginalChapters = getUniqueChapters(originalChapters);
  renderChaptersList(uniqueChapters, uniqueOriginalChapters);
  
  // Пересчитываем приоритет по количеству глав (как при первом открытии)
  const translatorCounts = {};
  allChapters.forEach(ch => {
    if (ch.branches && Array.isArray(ch.branches)) {
      ch.branches.forEach(branch => {
        const key = getTranslatorKey(branch);
        if (!translatorCounts[key]) {
          translatorCounts[key] = 0;
        }
        translatorCounts[key]++;
      });
    }
  });
  
  translatorPriority = Object.keys(translatorCounts).sort((a, b) => translatorCounts[b] - translatorCounts[a]);
  populateTranslators();
  applyTranslatorPriority();
});


function initChapterResetButtons() {
  const resetButtons = document.querySelectorAll('.chapter-reset-btn');
  resetButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const index = parseInt(button.dataset.index);
      const input = document.querySelector(`.chapter-input[data-index="${index}"]`);
      if (input) {
        input.value = input.dataset.default || '';
      }
      
      // Сбрасываем индивидуальный выбор переводчика для этой главы
      const uniqueChapters = getUniqueChapters(allChapters);
      const chapter = uniqueChapters[index];
      if (chapter) {
        delete chapterBranchOverrides[chapter.id];
        
        // Применяем приоритет переводчиков для этой главы
        const variants = getChapterVariants(chapter.id);
        applyTranslatorPriorityToChapter(chapter, variants, false);
        
        // Обновляем селектор переводчика в UI
        const translatorSelect = document.querySelector(`.chapter-translator[data-chapter-id="${chapter.id}"]`);
        if (translatorSelect) {
          const currentTranslatorKey = chapterBranchOverrides[chapter.id];
          let currentTranslator = '';
          
          if (currentTranslatorKey && variants.has(currentTranslatorKey)) {
            currentTranslator = variants.get(currentTranslatorKey);
          } else if (chapter.branches && chapter.branches[0]) {
            currentTranslator = getTranslatorName(chapter.branches[0]);
          } else {
            currentTranslator = chapter.branchTeamName || 'Основной перевод';
          }
          translatorSelect.textContent = currentTranslator;
          
          // Обновляем выделение в dropdown
          const dropdown = translatorSelect.nextElementSibling;
          if (dropdown) {
            dropdown.querySelectorAll('.chapter-translator-option').forEach(opt => {
              opt.classList.remove('selected');
              if (opt.dataset.translatorKey === currentTranslatorKey) {
                opt.classList.add('selected');
              }
            });
          }
        }
      }
    });
  });
}


window.addEventListener('beforeunload', () => {
  if (!wasSaved) {
    chrome.runtime.sendMessage({ action: 'showToast', message: 'Отменено!', type: 'cancel' });
  }
});

function updatePriorityList(listElement) {
  if (!listElement) {
    console.error('updatePriorityList: listElement is null');
    return;
  }
  
  listElement.innerHTML = '';
  
  const translatorCounts = {};
  const translatorNames = {};
  
  allChapters.forEach(ch => {
    if (ch.branches && Array.isArray(ch.branches)) {
      ch.branches.forEach(branch => {
        const key = getTranslatorKey(branch);
        const name = getTranslatorName(branch);
        
        if (!translatorCounts[key]) {
          translatorCounts[key] = 0;
        }
        translatorCounts[key]++;
        
        if (!translatorNames[key]) {
          translatorNames[key] = name;
        }
      });
    }
  });
  
  let priorityList = [...translatorPriority];
  if (priorityList.length === 0) {
    priorityList = Object.keys(translatorCounts).sort((a, b) => translatorCounts[b] - translatorCounts[a]);
    translatorPriority = priorityList;
  }
  
  Object.keys(translatorCounts).forEach(translatorKey => {
    if (!priorityList.includes(translatorKey)) {
      priorityList.push(translatorKey);
    }
  });
  
  priorityList = priorityList.filter(translatorKey => translatorCounts[translatorKey]);
  translatorPriority = priorityList;
  
  priorityList.forEach((translatorKey, index) => {
    const item = document.createElement('div');
    item.className = 'translator-priority-item';
    item.dataset.translatorKey = translatorKey;
    item.dataset.index = index;
    
    const name = document.createElement('span');
    name.className = 'translator-priority-name';
    name.textContent = translatorNames[translatorKey] || 'Основной перевод';
    
    const count = document.createElement('span');
    count.className = 'translator-priority-count';
    count.textContent = translatorCounts[translatorKey] + ' гл.';
    
    const controls = document.createElement('div');
    controls.className = 'translator-priority-controls';
    
    const upBtn = document.createElement('button');
    upBtn.className = 'translator-priority-btn translator-priority-up';
    upBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    upBtn.title = 'Увеличить приоритет';
    upBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveTranslatorUp(listElement, item);
    });
    
    const downBtn = document.createElement('button');
    downBtn.className = 'translator-priority-btn translator-priority-down';
    downBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    downBtn.title = 'Уменьшить приоритет';
    downBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveTranslatorDown(listElement, item);
    });
    
    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    
    item.appendChild(name);
    item.appendChild(count);
    item.appendChild(controls);
    listElement.appendChild(item);
  });
  
  updateButtonStates(listElement);
}

function moveTranslatorUp(listElement, item) {
  const prevItem = item.previousElementSibling;
  if (prevItem) {
    listElement.insertBefore(item, prevItem);
    updatePriorityFromList(listElement);
    updateButtonStates(listElement);
  }
}

function moveTranslatorDown(listElement, item) {
  const nextItem = item.nextElementSibling;
  if (nextItem) {
    listElement.insertBefore(nextItem, item);
    updatePriorityFromList(listElement);
    updateButtonStates(listElement);
  }
}

function updateButtonStates(listElement) {
  const items = listElement.querySelectorAll('.translator-priority-item');
  const itemsCount = items.length;
  
  items.forEach((item, index) => {
    const upBtn = item.querySelector('.translator-priority-up');
    const downBtn = item.querySelector('.translator-priority-down');
    
    // Если всего один перевод - скрываем кнопки полностью (display: none)
    // Если больше одного переводов - скрываем только визуально (visibility: hidden)
    const useDisplayNone = itemsCount === 1;
    
    if (upBtn) {
      if (index === 0) {
        if (useDisplayNone) {
          upBtn.style.display = 'none';
        } else {
          upBtn.style.visibility = 'hidden';
          upBtn.style.cursor = 'default';
        }
      } else {
        upBtn.style.display = 'flex';
        upBtn.style.visibility = 'visible';
        upBtn.style.cursor = 'pointer';
      }
    }
    if (downBtn) {
      if (index === itemsCount - 1) {
        if (useDisplayNone) {
          downBtn.style.display = 'none';
        } else {
          downBtn.style.visibility = 'hidden';
          downBtn.style.cursor = 'default';
        }
      } else {
        downBtn.style.display = 'flex';
        downBtn.style.visibility = 'visible';
        downBtn.style.cursor = 'pointer';
      }
    }
  });
}

function updatePriorityFromList(listElement) {
  const items = listElement.querySelectorAll('.translator-priority-item');
  const newPriority = [];
  items.forEach(item => {
    newPriority.push(item.dataset.translatorKey);
  });
  translatorPriority = newPriority;
  
  const translatorSelect = document.getElementById('translator-select');
  if (translatorSelect && newPriority.length > 0) {
    const priorityTranslatorKey = newPriority[0];
    // Используем branches для получения имени переводчика
    const priorityTranslatorName = branches[priorityTranslatorKey];
    if (priorityTranslatorName) {
      translatorSelect.textContent = priorityTranslatorName;
    }
  }
  
  // Если глав меньше 800, обновляем сразу (старая схема)
  const uniqueChapters = getUniqueChapters(allChapters);
  if (uniqueChapters.length < 800) {
    applyTranslatorPriority(true);
  }
}

// Очистить все названия глав с двухэтапным подтверждением
function initClearAllButton() {
  let clearAllTimeout = null;
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    const btn = document.getElementById('btn-clear-all');
    
    if (btn.textContent.includes('Уверены?')) {
      // Второй клик - подтверждение
      clearTimeout(clearAllTimeout);
      clearAllTimeout = null;
      
      // Очищаем все поля (делаем пустыми)
      const inputs = document.querySelectorAll('.chapter-input');
      inputs.forEach(input => {
        input.value = '';
      });
      
      // Сбрасываем кнопку
      btn.innerHTML = '<i class="fa-solid fa-eraser"></i> Очистить всё';
    } else {
      // Первый клик - показываем подтверждение
      btn.innerHTML = '<i class="fa-solid fa-eraser"></i> Уверены?';
      
      // Таймаут 8 секунд для возврата в исходное состояние
      clearAllTimeout = setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-eraser"></i> Очистить всё';
        clearAllTimeout = null;
      }, 8000);
    }
  });
}

function initTranslatorPriorityPopup() {
  const translatorSelect = document.getElementById('translator-select');
  if (!translatorSelect) return;

  if (typeof window.tippy === 'undefined') {
    console.error('Tippy library not loaded');
    return;
  }

  if (translatorSelect._tippy) {
    translatorSelect._tippy.destroy();
  }

  const popupContent = document.createElement('div');
  popupContent.className = 'translator-priority-popup';

  const list = document.createElement('div');
  list.className = 'translator-priority-list';
  popupContent.appendChild(list);

  const isDark = !document.documentElement.hasAttribute('data-theme');

  try {
    window.tippy(translatorSelect, {
      content: popupContent,
      placement: 'bottom',
      trigger: 'mouseenter',
      interactive: true,
      arrow: false,
      maxWidth: 420,
      theme: isDark ? 'dark' : 'light',
      onShow: () => {
        updatePriorityList(list);
      },
      onHide: () => {
        // Обновляем список глав только при закрытии tippy (уход мыши) если глав >= 800
        const uniqueChapters = getUniqueChapters(allChapters);
        if (uniqueChapters.length >= 800) {
          applyTranslatorPriority(true);
        }
      }
    });
    console.log('Tippy instance created successfully');
  } catch (error) {
    console.error('Error creating tippy instance:', error);
  }
}

function applyTranslatorPriorityToChapter(chapter, variants, allowOverride = true) {
  if (translatorPriority.length === 0 || variants.size <= 1) return;
  
  // При изменении глобального приоритета перезаписываем все индивидуальные override
  // allowOverride = true по умолчанию для этого поведения
  if (allowOverride) {
    for (const translatorKey of translatorPriority) {
      if (variants.has(translatorKey)) {
        chapterBranchOverrides[chapter.id] = translatorKey;
        break;
      }
    }
  } else if (!chapterBranchOverrides[chapter.id]) {
    // Если allowOverride = false, применяем приоритет только к главам без override
    for (const translatorKey of translatorPriority) {
      if (variants.has(translatorKey)) {
        chapterBranchOverrides[chapter.id] = translatorKey;
        break;
      }
    }
  }
}

function applyTranslatorPriority(allowOverride = true) {
  if (translatorPriority.length === 0) return;
  
  const uniqueChapters = getUniqueChapters(allChapters);
  
  uniqueChapters.forEach(ch => {
    const variants = getChapterVariants(ch.id);
    applyTranslatorPriorityToChapter(ch, variants, allowOverride);
  });
  
  const uniqueOriginalChapters = getUniqueChapters(originalChapters);
  renderChaptersList(uniqueChapters, uniqueOriginalChapters);
}
