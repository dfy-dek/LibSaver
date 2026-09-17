// CBZ Formatter for manga
class CbzFormatter extends BaseFormatter {
  constructor(options) {
    super(options);
    this.zip = new JSZip();
  }

  async format(chapters, metadata) {
    const addLog = this.options.addLog || (() => {});
    const imageServer = this.options.imageServer || 'normal';
    const format = this.options.format || 'cbz';

    // Настройки перевода
    const chapterBranchOverrides = this.options.chapterBranchOverrides || {};
    const translatorPriority = this.options.translatorPriority || [];

    // Группируем главы по томам
    const chaptersByVolume = {};
    for (const chapter of chapters) {
      if (!chapter.selected) continue;
      const volume = chapter.volume || '1';
      if (!chaptersByVolume[volume]) {
        chaptersByVolume[volume] = [];
      }
      chaptersByVolume[volume].push(chapter);
    }

    const volumes = Object.keys(chaptersByVolume).sort((a, b) => parseInt(a) - parseInt(b));

    // Вычисляем общее количество глав для прогресс-бара
    let totalChaptersCount = 0;
    for (const volume of volumes) {
      totalChaptersCount += chaptersByVolume[volume].length;
    }
    
    // Инициализируем прогресс-бар с общим количеством глав
    if (this.options.updateProgress) {
      this.options.updateProgress(0, totalChaptersCount);
    }
    
    // Если только один том - создаем прямой архив
    if (volumes.length === 1) {
      const volume = volumes[0];
      const volumeChapters = chaptersByVolume[volume];
      let globalProcessedCount = 0;
      const selectedCount = volumeChapters.length;
      const volumeResult = await this.createVolumeArchive(volume, volumeChapters, metadata, imageServer, chapterBranchOverrides, translatorPriority, globalProcessedCount, selectedCount, true);

      // Обновляем статистику (картинки без обложек)
      if (window.setTotalChapters) {
        window.setTotalChapters(totalChaptersCount);
      }
      if (window.setTotalCovers) {
        window.setTotalCovers(volumeResult.coversDownloaded);
      }
      if (window.setTotalImages) {
        window.setTotalImages(volumeResult.totalImages - volumeResult.coversDownloaded);
      }

      const filename = this.generateFileName(metadata) + this.getExtension();
      return { blob: volumeResult.blob, filename };
    }
    
    // Несколько томов - создаем главный ZIP с архивами томов
    const mainZip = new JSZip();
    let globalProcessedCount = 0;
    let totalImagesAllVolumes = 0;
    let totalCoversAllVolumes = 0;

    for (let i = 0; i < volumes.length; i++) {
      const volume = volumes[i];
      const volumeChapters = chaptersByVolume[volume];
      const isFirstVolume = (i === 0);
      const volumeResult = await this.createVolumeArchive(volume, volumeChapters, metadata, imageServer, chapterBranchOverrides, translatorPriority, globalProcessedCount, totalChaptersCount, isFirstVolume);
      globalProcessedCount += volumeChapters.length;
      totalImagesAllVolumes += volumeResult.totalImages;
      totalCoversAllVolumes += volumeResult.coversDownloaded;
      const volumeFilename = this.generateVolumeFilename(metadata, volume) + this.getExtension();
      mainZip.file(volumeFilename, volumeResult.blob);
    }

    // Генерируем главный архив с store compression
    const mainBlob = await mainZip.generateAsync({
      type: 'blob',
      compression: 'STORE',
      compressionOptions: { level: 0 }
    });

    // Обновляем статистику (картинки без обложек)
    if (window.setTotalChapters) {
      window.setTotalChapters(totalChaptersCount);
    }
    if (window.setTotalCovers) {
      window.setTotalCovers(totalCoversAllVolumes);
    }
    if (window.setTotalImages) {
      window.setTotalImages(totalImagesAllVolumes - totalCoversAllVolumes);
    }

    const mainFilename = this.generateFileName(metadata) + '.zip';
    return { blob: mainBlob, filename: mainFilename };
  }
  
  async createVolumeArchive(volume, chapters, metadata, imageServer, chapterBranchOverrides, translatorPriority, globalProcessedCount = 0, totalChaptersCount = 0, isFirstVolume = false) {
    const addLog = this.options.addLog || (() => {});
    const volumeZip = new JSZip();
    const tabId = this.options.tabId;
    const slug = this.options.slug;
    
    let totalImages = 0;
    let processedChapters = 0;
    let imagesFailed = 0;
    let coversStats = { downloaded: 0, failed: 0, total: 0 };
    
    // Скачиваем обложки только для первого тома
    if (isFirstVolume) {
      coversStats = await this.processCovers(volumeZip);
      totalImages += coversStats.downloaded;
      imagesFailed += coversStats.failed;
    }
    
    for (const chapter of chapters) {
      // Сбрасываем статистику картинок перед каждой главой
      this.resetImageStats();

      // Случайная пауза между главами (централизованная логика)
      if (typeof window.maybeAddRandomPause === 'function') {
        await window.maybeAddRandomPause(processedChapters, addLog);
      }

      // Определяем branch_id для текущей главы
      let branchId = null;
      let selectedTranslatorName = 'Неизвестный';

      // Функция для получения имени переводчика из chapter.branches по branch_id
      const getTranslatorNameFromBranches = (targetBranchId) => {
        if (!chapter.branches || !Array.isArray(chapter.branches)) {
          return 'Неизвестный';
        }
        const normalizedTargetId = targetBranchId === null ? 'null' : String(targetBranchId);
        const branch = chapter.branches.find(b => {
          const branchBranchId = b.branch_id === null ? 'null' : String(b.branch_id);
          return branchBranchId === normalizedTargetId;
        });
        if (branch && branch.teams && branch.teams.length > 0) {
          return branch.teams[0].name || 'Неизвестный';
        }
        return 'Неизвестный';
      };

      if (chapterBranchOverrides[chapter.id]) {
        // Индивидуальный override для этой главы
        const translatorKey = chapterBranchOverrides[chapter.id];
        branchId = translatorKey.split('_')[0];
        selectedTranslatorName = getTranslatorNameFromBranches(branchId);
      } else if (translatorPriority.length > 0 && chapter.branches && Array.isArray(chapter.branches)) {
        // Используем глобальный приоритет
        for (const translatorKey of translatorPriority) {
          const priorityBranchId = translatorKey.split('_')[0];
          const hasBranch = chapter.branches.some(branch => {
            const branchBranchId = branch.branch_id === null ? 'null' : String(branch.branch_id);
            return branchBranchId === priorityBranchId;
          });
          if (hasBranch) {
            branchId = priorityBranchId;
            selectedTranslatorName = getTranslatorNameFromBranches(branchId);
            break;
          }
        }
      } else if (chapter.branches && chapter.branches.length > 0) {
        // Если нет выбора, используем первый доступный branch
        branchId = chapter.branches[0].branch_id;
        selectedTranslatorName = getTranslatorNameFromBranches(branchId);
      }

      // Определяем правильный chapter_id для выбранного branch_id
      let chapterId = chapter.id;
      if (branchId && chapter.branches && Array.isArray(chapter.branches)) {
        const branchChapter = chapter.branches.find(b => String(b.branch_id) === String(branchId));
        if (branchChapter) {
          chapterId = branchChapter.id;
        }
      }

      addLog(`[${processedChapters + 1}/${totalChaptersCount}] Загрузка: ${chapter.displayTitle}...`);

      const volumeNum = chapter.volume || '1';
      const number = chapter.number || '0';

      let pagesResult;
      let shouldRetry = false;

      // Цикл для повторных попыток
      do {
        shouldRetry = false;
        try {
          pagesResult = await this.loadMangaChapterPages(tabId, chapterId, volumeNum, number, slug, imageServer, branchId, selectedTranslatorName);

          // Логируем переводчик если включен debugMode
          if (pagesResult.success && pagesResult.translatorInfo && this.options.debug && this.options.onTranslatorSelected) {
            const tempChapter = { volume: volumeNum, number: number };
            this.options.onTranslatorSelected(
              tempChapter,
              selectedTranslatorName,
              branchId,
              pagesResult.translatorInfo.downloadedTranslatorName,
              pagesResult.translatorInfo.downloadedBranchId
            );
          }
        } catch (error) {
          addLog(`  Ошибка при вызове loadChapterPages: ${error.message}`, true);

          // Сохраняем информацию об ошибке для retry/skip
          if (this.options.onChapterError) {
            const errorResult = await this.options.onChapterError(chapter, error, processedChapters);
            if (errorResult && errorResult.shouldRetry) {
              addLog(`  Повторная попытка загрузки главы...`);
              shouldRetry = true;
              continue;
            } else {
              // Если пользователь выбрал skip - продолжаем к следующей главе
              break;
            }
          } else {
            // Если нет обработчика ошибок - пропускаем главу как раньше
            break;
          }
        }

        if (!pagesResult || !pagesResult.success) {
          addLog(`  Ошибка загрузки страниц: ${pagesResult?.error || 'Unknown error'}`, true);

          // Сохраняем информацию об ошибке для retry/skip
          if (this.options.onChapterError) {
            const errorResult = await this.options.onChapterError(chapter, new Error(pagesResult?.error || 'Unknown error'), processedChapters);
            if (errorResult && errorResult.shouldRetry) {
              addLog(`  Повторная попытка загрузки главы...`);
              shouldRetry = true;
              continue;
            } else {
              // Если пользователь выбрал skip - продолжаем к следующей главе
              break;
            }
          } else {
            // Если нет обработчика ошибок - пропускаем главу как раньше
            break;
          }
        }
      } while (shouldRetry);

      // Если после retry всё равно не удалось загрузить - пропускаем главу
      if (!pagesResult || !pagesResult.success) {
        continue;
      }

      // Обновляем прогресс с глобальным счётчиком
      if (this.options.updateProgress) {
        this.options.updateProgress(globalProcessedCount + processedChapters, totalChaptersCount);
      }
      
      // Обновляем индекс текущей главы
      if (this.options.updateChapterIndex) {
        this.options.updateChapterIndex(globalProcessedCount + processedChapters);
      }
      
      // Записываем время загрузки главы
      if (this.options.recordChapterTime) {
        this.options.recordChapterTime();
      }
      
      // Скачиваем и добавляем изображения в архив
      let pageIndex = 0;
      while (pageIndex < pagesResult.pages.length) {
        const page = pagesResult.pages[pageIndex];
        try {
          const imageBlob = await this.downloadImage(page.url);
          if (imageBlob) {
            const imageFormat = this.options.imageFormat || 'original';
            const imgExtension = this.getImageExtension(imageBlob, imageFormat, page.url);
            const filename = this.generatePageFilename(chapter, page, imgExtension);
            volumeZip.file(filename, imageBlob);
            totalImages++;
            if (window.incrementTotalImages) {
              window.incrementTotalImages();
            }

            // Статистика
            if (this.options.addFileSize) {
              this.options.addFileSize(imageBlob.size);
            }

            // Случайная пауза между картинками (централизованная логика)
            if (typeof window.maybeAddImagePause === 'function') {
              await window.maybeAddImagePause(addLog);
            }
            pageIndex++; // Переходим к следующей картинке
          } else {
            addLog(`    Не удалось загрузить изображение`, true);
            imagesFailed++;
            // Для манги останавливаем главу при ошибке картинки
            if (this.options.onImageError) {
              const errorResult = await this.options.onImageError(chapter, new Error('Не удалось загрузить изображение'), processedChapters, page.url);
              if (errorResult && errorResult.shouldRetry) {
                addLog(`Повторная попытка загрузки изображения...`);
                // Не увеличиваем pageIndex - повторяем ту же картинку
                continue;
              } else {
                addLog(`Изображение пропущено пользователем`);
                if (this.options.incrementSkippedImagesCount) {
                  this.options.incrementSkippedImagesCount();
                }
                pageIndex++; // Переходим к следующей картинке
                continue;
              }
            } else {
              break;
            }
          }
        } catch (error) {
          addLog(`    Ошибка загрузки изображения ${page.image}: ${error.message}`, true);
          imagesFailed++;
          // Для манги останавливаем главу при ошибке картинки
          if (this.options.onImageError) {
            const errorResult = await this.options.onImageError(chapter, error, processedChapters, page.url);
            if (errorResult && errorResult.shouldRetry) {
              addLog(`Повторная попытка загрузки изображения...`);
              // Не увеличиваем pageIndex - повторяем ту же картинку
              continue;
            } else {
              addLog(`Изображение пропущено пользователем`);
              if (this.options.incrementSkippedImagesCount) {
                this.options.incrementSkippedImagesCount();
              }
              pageIndex++; // Переходим к следующей картинке
              continue;
            }
          } else {
            break;
          }
        }
      }
      processedChapters++;
      if (window.incrementTotalChapters) {
        window.incrementTotalChapters();
      }
    }

    // Генерируем архив тома с store compression
    const volumeBlob = await volumeZip.generateAsync({
      type: 'blob',
      compression: 'STORE',
      compressionOptions: { level: 0 }
    });

    // Возвращаем статистику для агрегации
    return {
      blob: volumeBlob,
      totalImages: totalImages,
      coversDownloaded: coversStats.downloaded
    };
  }
  
  generateVolumeFilename(metadata, volume) {
    const originalMetadata = this.options.originalMetadata || {};
    const titleRu = metadata.titleRu || originalMetadata.titleRu || originalMetadata.titleEn || originalMetadata.titleOriginal || 'Без названия';
    const cleanTitle = titleRu.replace(/[\\/:*?"<>|]/g, '#');
    const volumeNum = String(volume).padStart(2, '0');
    return `${cleanTitle} - Vol. ${volumeNum}`;
  }
  
  
  async downloadImage(url) {
    try {
      const result = await this.downloadAndResizeImage(url, this.options.quality || 'ORIGINAL', this.options.imageFormat, 'картинка');
      return result.blob;
    } catch (error) {
      if (this.options.addLog) {
        this.options.addLog(`Ошибка скачивания ${url}: ${error.message}`, true);
      }
      throw error;
    }
  }

  async processCovers(volumeZip) {
    const metadata = this.options.metadata || {};
    const coverQuality = this.options.coverQuality || 'ORIGINAL';

    if (coverQuality === 'NONE') {
      if (this.options.addLog) {
        this.options.addLog('Скачивание обложек отключено (выбрано "Без обложек")');
      }
      return { downloaded: 0, failed: 0, total: 0 };
    }

    const allCovers = this.options.allCovers ? this.options.allCovers : [metadata.cover || this.options.originalCover || ''];

    if (allCovers.length === 0) {
      return { downloaded: 0, failed: 0, total: 0 };
    }

    let coversDownloaded = 0;
    let coversFailed = 0;

    for (let i = 0; i < allCovers.length; i++) {
      const coverItem = allCovers[i];
      if (!coverItem) continue;

      // Если это объект с dataUrl (локальный файл), используем dataUrl
      const coverUrl = typeof coverItem === 'object' && coverItem.dataUrl
        ? coverItem.dataUrl
        : coverItem;

      const actualUrl = this.extractCoverUrl(coverUrl);

      if (!actualUrl) {
        if (this.options.addLog) {
          this.options.addLog(`Пропуск обложки ${i + 1}: неверный формат URL`);
        }
        coversFailed++;
        if (this.options.incrementSkippedImagesCount) {
          this.options.incrementSkippedImagesCount();
        }
        continue;
      }

      try {
        const coverBlob = await this.downloadCoverWithFallback(actualUrl, coverQuality);

        if (coverBlob) {
          const imageFormat = this.options.imageFormat || 'original';
          const coverExtension = this.getImageExtension(coverBlob, imageFormat);
          const coverFileName = allCovers.length > 1 ? `cover-${i + 1}${coverExtension}` : `000_cover${coverExtension}`;
          volumeZip.file(coverFileName, coverBlob);

          coversDownloaded++;
          if (window.incrementTotalCovers) {
            window.incrementTotalCovers();
          }
        }
      } catch (e) {
        console.error(`Ошибка загрузки обложки ${i + 1}:`, e);
        coversFailed++;
        if (this.options.incrementSkippedImagesCount) {
          this.options.incrementSkippedImagesCount();
        }
        if (this.options.addLog) {
          this.options.addLog(`Ошибка загрузки обложки ${i + 1}: ${e.message}`, true);
        }
      }
    }
    
    return { downloaded: coversDownloaded, failed: coversFailed, total: allCovers.length };
  }

  generatePageFilename(chapter, page, extension) {
    // Формируем имя файла: volXXX_chXXXX_Y_pageZZZZ.расширение
    const volume = String(chapter.volume || '1').padStart(3, '0');
    const chapterNum = chapter.number || '0';

    // Разбираем номер главы на целую и дробную части
    let chapterWhole, chapterFraction;
    if (String(chapterNum).includes('.')) {
      const parts = String(chapterNum).split('.');
      chapterWhole = parts[0];
      chapterFraction = parts[1] || '0';
      // Дробная часть - одна цифра без ведущих нулей
      chapterFraction = chapterFraction.substring(0, 1);
    } else {
      chapterWhole = chapterNum;
      chapterFraction = '0';
    }

    // Целая часть главы до 4 цифр
    chapterWhole = String(chapterWhole).padStart(4, '0');

    const pageNum = String(page.slug).padStart(4, '0');

    return `vol${volume}_ch${chapterWhole}_${chapterFraction}_page${pageNum}${extension}`;
  }
  
  getExtension() {
    const format = this.options.format || 'cbz';
    return format === 'zip' ? '.zip' : '.cbz';
  }
  
  getMimeType() {
    return 'application/vnd.comicbook+zip';
  }
}
