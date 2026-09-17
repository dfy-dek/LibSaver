// SiteMenuRestorer.js - Content script для восстановления меню сайтов LIB

(function() {
    'use strict';

    // Проверяем настройку отключения
    chrome.storage.local.get(['disableSiteMenu'], function(result) {
        if (result.disableSiteMenu === true) {
            return; // Скрипт отключен
        }
        initSiteMenuRestorer();
    });

    function initSiteMenuRestorer() {
        // Кэш для SVG файлов
        const svgCache = new Map();

        // Информация о сайтах
        const sites = [
            { name: 'MangaLIB', url: 'https://mangalib.me', color: '1', svgFile: 'MangaLIB.svg' },
            { name: 'HentaiLIB', url: 'https://hentailib.me', color: '4', svgFile: 'HentaiLIB.svg' },
            { name: 'SlashLIB', url: 'https://v2.shlib.life', color: '2', svgFile: 'SlashLIB.svg' },
            { name: 'RanobeLIB', url: 'https://ranobelib.me', color: '3', svgFile: 'RanobeLIB.svg' },
            { name: 'AnimeLIB', url: 'https://v5.animelib.org', color: '5', svgFile: 'AnimeLIB.svg' }
        ];

        // Определить текущий сайт
        function getCurrentSite() {
            const hostname = window.location.hostname;
            if (hostname.includes('mangalib.me')) return 'mangalib';
            if (hostname.includes('hentailib.me')) return 'hentailib';
            if (hostname.includes('ranobelib.me')) return 'ranobelib';
            if (hostname.includes('animelib.org')) return 'animelib';
            if (hostname.includes('shlib.life')) return 'slashlib';
            return 'ranobelib';
        }

        // Динамически определить CSS классы из существующих элементов конкретного меню
        function detectSiteClasses(menuList) {
            const classes = {
                menuItem: null,
                menuItemMobile: null,
                logo: null,
                corner: null,
                words: null
            };

            // Ищем существующие элементы меню в этом конкретном menuList
            const menuItems = menuList.querySelectorAll('.menu-item');
            
            if (menuItems.length === 0) {
                console.log('[SiteMenuRestorer] Не найдены существующие элементы меню для определения классов');
                return null;
            }

            const firstItem = menuItems[0];
            
            // Извлекаем классы menu-item (исключаем базовый класс 'menu-item')
            const itemClasses = firstItem.classList;
            const classArray = Array.from(itemClasses);
            
            // Первый нестандартный класс - основной класс меню
            for (const cls of classArray) {
                if (cls !== 'menu-item' && !cls.startsWith('is-') && !cls.startsWith('text-')) {
                    if (!classes.menuItem) {
                        classes.menuItem = cls;
                    } else if (!classes.menuItemMobile) {
                        // Второй нестандартный класс - мобильный класс
                        classes.menuItemMobile = cls;
                    }
                }
            }

            // Извлекаем классы logo
            const logoDiv = firstItem.querySelector('.site-logo');
            if (logoDiv) {
                const logoClasses = logoDiv.classList;
                logoClasses.forEach(cls => {
                    if (cls !== 'site-logo') {
                        classes.logo = cls;
                    }
                });

                // Извлекаем классы corner и words из SVG
                const cornerPath = logoDiv.querySelector('.site-logo__corner');
                const wordsPath = logoDiv.querySelector('.site-logo__words');
                
                if (cornerPath) {
                    cornerPath.classList.forEach(cls => {
                        if (cls !== 'site-logo__corner') {
                            classes.corner = cls;
                        }
                    });
                }
                
                if (wordsPath) {
                    wordsPath.classList.forEach(cls => {
                        if (cls !== 'site-logo__words') {
                            classes.words = cls;
                        }
                    });
                }
            }

            // Проверяем, удалось ли определить все необходимые классы
            if (!classes.menuItem || !classes.logo || !classes.corner || !classes.words) {
                console.log('[SiteMenuRestorer] Не удалось определить все необходимые классы:', classes);
                return null;
            }

            console.log('[SiteMenuRestorer] Определены классы:', classes);
            
            return classes;
        }

        // Загрузить SVG файл и заменить классы на динамически определенные классы с кэшированием
        async function loadSvgFile(svgFile, detectedClasses) {
            const cacheKey = `${svgFile}_${JSON.stringify(detectedClasses)}`;
            
            // Проверяем кэш
            if (svgCache.has(cacheKey)) {
                return svgCache.get(cacheKey);
            }
            
            try {
                const svgUrl = chrome.runtime.getURL(`svg/${svgFile}`);
                const response = await fetch(svgUrl);
                if (!response.ok) {
                    console.error(`Ошибка загрузки SVG ${svgFile}:`, response.statusText);
                    return null;
                }
                let svgContent = await response.text();
                
                // Заменяем классы на динамически определенные классы
                svgContent = svgContent.replace(/class="[^"]*site-logo__corner[^"]*"/g, 
                    `class="${detectedClasses.corner} site-logo__corner"`);
                svgContent = svgContent.replace(/class="[^"]*site-logo__words[^"]*"/g, 
                    `class="${detectedClasses.words} site-logo__words"`);
                
                // Сохраняем в кэш
                svgCache.set(cacheKey, svgContent);
                
                return svgContent;
            } catch (error) {
                console.error(`Ошибка загрузки SVG ${svgFile}:`, error);
                return null;
            }
        }

        // Создать HTML для пункта меню
        async function createMenuItem(site, detectedClasses, isMobile) {
            const a = document.createElement('a');
            let menuItemClass = `menu-item ${detectedClasses.menuItem}`;
            if (isMobile && detectedClasses.menuItemMobile) {
                menuItemClass += ` ${detectedClasses.menuItemMobile}`;
            }
            a.className = menuItemClass;
            a.href = site.url;
            
            const logoDiv = document.createElement('div');
            logoDiv.className = `${detectedClasses.logo} site-logo`;
            logoDiv.setAttribute('data-site-color', site.color);
            
            const svgContent = await loadSvgFile(site.svgFile, detectedClasses);
            if (svgContent) {
                logoDiv.innerHTML = svgContent;
            } else {
                logoDiv.textContent = site.name.charAt(0);
            }
            
            const textDiv = document.createElement('div');
            textDiv.className = 'menu-item__text';
            textDiv.textContent = ' ' + site.name;
            
            a.appendChild(logoDiv);
            a.appendChild(textDiv);
            
            return a;
        }

        // Флаг для предотвращения множественных вызовов
        let isRestoring = false;

        // Восстановить меню сайтов
        async function restoreSiteMenu() {
            if (isRestoring) return;
            
            isRestoring = true;
            
            // Ищем меню с правильной структурой
            // 1. Tippy dropdown: .tippy-box > .tippy-content > .dropdown-menu > .menu > .menu-list
            const tippyDropdownMenus = document.querySelectorAll('.tippy-box > .tippy-content > .dropdown-menu > .menu > .menu-list');
            // 2. Popup menus: .popup__content > .menu > .menu-list
            const popupMenus = document.querySelectorAll('.popup__content > .menu > .menu-list');
            // 3. Collapse menus: .collapse > .collapse__content > .menu > .menu-list
            const collapseMenus = document.querySelectorAll('.collapse > .collapse__content > .menu > .menu-list');
            // 4. Mobile menus: .menu > .menu-list
            const mobileMenus = document.querySelectorAll('.menu > .menu-list');
            
            const allMenus = [...tippyDropdownMenus, ...popupMenus, ...collapseMenus, ...mobileMenus];
            
            if (allMenus.length === 0) {
                isRestoring = false;
                setTimeout(restoreSiteMenu, 100);
                return;
            }

            for (const menuList of allMenus) {
                const existingItems = menuList.querySelectorAll('.menu-item');
                
                // Проверяем, содержит ли меню пункты с сайтами LIB
                const hasSiteItems = Array.from(existingItems).some(item => {
                    const href = item.getAttribute('href');
                    return href && sites.some(site => href.includes(site.url));
                });
                
                // Если меню не содержит пункты с сайтами LIB и не пустое, пропускаем его
                if (!hasSiteItems && existingItems.length > 0) {
                    continue;
                }
                
                // Динамически определяем CSS классы для этого конкретного меню
                const detectedClasses = detectSiteClasses(menuList);
                
                // Если не удалось определить классы для этого меню - пропускаем
                if (!detectedClasses) {
                    console.log('[SiteMenuRestorer] Не удалось определить CSS классы для меню, пропускаем');
                    continue;
                }
                
                const existingItemsMap = new Map();
                
                // Определяем мобильный режим по наличию мобильного класса у существующих элементов
                let isMobile = false;
                if (existingItems.length > 0 && detectedClasses.menuItemMobile) {
                    isMobile = existingItems[0].classList.contains(detectedClasses.menuItemMobile);
                }
                
                // Сохраняем существующие элементы в Map по URL
                existingItems.forEach(item => {
                    const href = item.getAttribute('href');
                    if (href) {
                        existingItemsMap.set(href, item);
                    }
                });

                // Очищаем меню
                menuList.innerHTML = '';

                // Добавляем все сайты в правильном порядке
                for (const site of sites) {
                    // Исключаем текущий сайт (учитываем поддомены)
                    const siteHostname = new URL(site.url).hostname;
                    const currentHostname = window.location.hostname;
                    
                    // Для animelib.org и anilib.me исключаем все поддомены
                    if (siteHostname === 'v5.animelib.org' && (currentHostname.includes('animelib.org') || currentHostname.includes('anilib.me'))) continue;
                    // Для остальных сайтов - обычная проверка
                    if (currentHostname.includes(siteHostname)) continue;
                    
                    let menuItem;
                    if (existingItemsMap.has(site.url)) {
                        // Используем существующий элемент
                        menuItem = existingItemsMap.get(site.url);
                    } else {
                        // Создаем новый элемент
                        menuItem = await createMenuItem(site, detectedClasses, isMobile);
                    }
                    
                    menuList.appendChild(menuItem);
                }
            }

            isRestoring = false;
        }

        // Запускаем когда DOM готов
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', restoreSiteMenu);
        } else {
            restoreSiteMenu();
        }

        // Обработчик изменения размера окна
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(restoreSiteMenu, 300);
        });

        // Debouncing для MutationObserver
        let mutationTimeout;
        const observer = new MutationObserver(function(mutations) {
            let needsUpdate = false;
            
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            if (node.classList && node.classList.contains('menu-list')) {
                                needsUpdate = true;
                            }
                            if (node.querySelector && node.querySelector('.menu-list')) {
                                needsUpdate = true;
                            }
                        }
                    });
                }
            });
            
            if (needsUpdate) {
                clearTimeout(mutationTimeout);
                mutationTimeout = setTimeout(restoreSiteMenu, 50);
            }
        });

        // Ограничиваем наблюдение только контейнерами меню
        const menuContainers = document.querySelectorAll('.tippy-box, .popup__content, .collapse');
        if (menuContainers.length > 0) {
            menuContainers.forEach(container => {
                observer.observe(container, {
                    childList: true,
                    subtree: true
                });
            });
        } else {
            // Fallback - наблюдаем за body если контейнеры не найдены
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

})();
