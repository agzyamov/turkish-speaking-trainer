# Изолированные UI-прогоны

`pnpm test:e2e:mock` запускает через Playwright отдельные браузеры (см. «Браузеры и профили устройств») и production build режима `e2e` с preview на `127.0.0.1:5179`. Все `/api/*` ответы определены в тесте; Supabase session существует только в тестовом browser context. Прогон проверяет выбор темы, первую фразу, синтетический STT, ввод ответа, результат и следующую видимую фразу. Неизвестный API endpoint приводит к ошибке теста. Реальные AI-провайдеры и production-сервисы не вызываются.

## Браузеры и профили устройств

`playwright.config.mjs` задаёт четыре проекта, и `pnpm test:e2e:mock` (и `just e2e-all`) без аргументов запускает набор в каждом. `just e2e` запускает только `chromium`: это проверка каждого pull request в CI. Все четыре проекта CI прогоняет каждую ночь и по кнопке (workflow `e2e-browsers.yml`, Actions → «E2E in all browsers» → Run workflow):

| Проект     | Движок                                                                                                                                       | Что эмулирует                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `chromium` | Chromium; локально установленный Google Chrome (`channel: chrome`), в CI встроенный Chromium Playwright через `E2E_BROWSER_CHANNEL=chromium` | настольный браузер 1280×720                     |
| `webkit`   | WebKit Playwright (`devices["Desktop Safari"]`)                                                                                              | настольный Safari 1280×720                      |
| `iphone`   | WebKit Playwright (`devices["iPhone 15"]`)                                                                                                   | экран, user agent, touch и `isMobile` iPhone 15 |
| `pixel`    | Chromium (`devices["Pixel 7"]`), канал как у `chromium`                                                                                      | экран, user agent, touch и `isMobile` Pixel 7   |

Один проект: `pnpm test:e2e:mock --project webkit`. Браузеры ставятся один раз: `pnpm exec playwright install chromium webkit`. Живой testlab-прогон (`TESTLAB_BASE_URL`) по-прежнему использует только `chromium`.

Ограничения. WebKit Playwright — это сборка движка WebKit, а не iOS Safari: он не воспроизводит системный запрос доступа к микрофону iOS, настройки разрешений iOS, Chrome для iOS, встроенные браузеры приложений (Telegram, Instagram и т. п.) и поведение настоящего устройства. Профили `iphone` и `pixel` меняют размер экрана, user agent и touch, но не операционную систему. Микрофон во всех проектах заменён заглушкой; реальный звук не записывается.

Пропуски по проектам названы причиной из `e2e/projects.mjs`:

- в `iphone` и `pixel` пропускаются тесты, которые опираются на настольную раскладку при размере окна по умолчанию (`desktopLayoutOnly`): на ширине телефона приложение сразу открывает первую тему без списка тем. Это `mocked.spec.mjs` (полный поток практики), `feedback-activity.spec.mjs` (вариант `desktop`), `lazy-panels.spec.mjs` (загрузка разделов по требованию) и семь тестов `network.spec.mjs`, начинающихся со списка тем;
- в `webkit` и `iphone` помечены `fixme` два дефекта WebKit: повтор загрузки раздела после сбоя загрузки чанка (`webkitLazyRetry`) и переполнение карточки эксперимента распознавания на 320px (`webkitSelectOverflow`). Метку снимают после исправления приложения.

`microphone-failures.spec.mjs` проверяет поведение при ошибках микрофона через заглушки: `getUserMedia` отклоняется с `NotAllowedError` и с `NotFoundError`, и отсутствует `navigator.mediaDevices` (нет API записи). Тексты кнопок, от которых зависит спек, собраны в одном объекте `labels` в начале файла.

## Метрики

Для сопоставимого набора из 30 измеренных проходов с тремя прогревами на каждый вариант раскладки:

```powershell
$env:E2E_SAMPLES_PER_SCRIPT = '10'
$env:E2E_WARMUP_PER_SCRIPT = '3'
pnpm test:e2e:mock
Remove-Item Env:E2E_SAMPLES_PER_SCRIPT, Env:E2E_WARMUP_PER_SCRIPT
node e2e/summary.mjs --platform web
```

Каждый проход создаёт отдельный browser context с одинаковым фиктивным каталогом. В `test-results/metrics/*.json` находятся только названия этапов, длительности, шаблоны путей API, HTTP-статусы, числовые `Server-Timing` и размеры ответов. `summary.json` содержит p50/p95. `test-results/` игнорируется Git. HAR, traces, screenshots, токены, текст ответов и аудио не сохраняются. `?perf` включает метки User Timing только на время конкретного запуска.

Для проверки настоящих локальных API/SQLite с тестовым входом и подменёнными AI/STT используйте из корня репозитория `scripts/run-testlab.ps1 web`. Скрипт читает учётные данные из игнорируемого `.env.testlab` и подключается только к `127.0.0.1:5178`, `:8765`, `:8766`. Тот же сценарий на установленном Android testlab debug APK запускается через `scripts/run-testlab.ps1 android`; это экспериментальный [Playwright Android WebView API](https://playwright.dev/docs/api/class-android). Драйвер требует включённый ADB и один доступный emulator/device. Android тест не является проверкой production Google OAuth, настоящего микрофона или AI-провайдеров.

Перед сравнением производительности очистите `test-results/metrics`, запускайте серии отдельно и сохраняйте `summary.json` с пометкой версии, условий сети и типа прогона. Локальный поток создаёт попытки в изолированной БД, поэтому повторные серии на одной БД не являются сопоставимыми без восстановления одинакового начального состояния.
