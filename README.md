# Лаванда — мини-игра в духе Pac-Man (PWA)

Веб-игра с героем-собакой. Собрана под **GitHub Pages**: после деплоя открываете ссылку в **Safari** на iPhone и добавляете на экран «Домой» — получается иконка как у приложения.

**Репозиторий:** [github.com/thefrol/lavanda-game](https://github.com/thefrol/lavanda-game)  
**Игра (после включения Pages и успешного деплоя):** [thefrol.github.io/lavanda-game/](https://thefrol.github.io/lavanda-game/)

## Локальный запуск

```bash
npm install
npm run dev
```

Откройте в браузере адрес, который выведет Vite (с учётом `base` это будет что-то вроде `http://localhost:5173/lavanda-game/`).

## Своя фотография Лаванды

Замените файл [`public/lavanda.png`](public/lavanda.png) на квадратное фото (лучше ~512×512 и выше). После `npm run build` оно попадёт в `dist/`. При желании обновите [`public/apple-touch-icon.png`](public/apple-touch-icon.png) и иконки `icon-192.png` / `icon-512.png` (можно снова сгенерировать через `python3 scripts/make_icons.py`, предварительно подставив свои изображения в скрипт или просто перезаписав PNG вручную).

## Публикация на GitHub Pages

1. Репозиторий: [thefrol/lavanda-game](https://github.com/thefrol/lavanda-game). **Имя репо совпадает с `base` в `vite.config.ts`** (`/lavanda-game/`).
2. В настройках репозитория: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Пуш в ветку `main` запускает [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) и публикует `dist`.
4. Игра: **https://thefrol.github.io/lavanda-game/**

## iPhone: добавить на экран «Домой»

1. Откройте ссылку на игру в **Safari** (не внутри другого приложения, если возможно — именно Safari).
2. Нажмите кнопку **Поделиться**.
3. Выберите **На экран «Домой»** и подтвердите название (например «Лаванда»).

Повторите то же на телефоне жены, отправив ей ссылку в сообщении.

## Иконки для сборки

Чтобы пересоздать заглушки PNG в `public/`:

```bash
python3 scripts/make_icons.py
```

Требуется только стандартная библиотека Python 3.
