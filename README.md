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

Спрайты в `public/` (подхватываются в сборке):

- **Лаванда** — [`lavanda_zoomed.png`](public/lavanda_zoomed.png) (из корневого `lavanda_zoomed.png`, для веба: `sips -Z 512 …`).
- **Корм на поле** — [`poop.png`](public/poop.png) из корневого [`poop.png`](poop.png) (`sips -Z 72 poop.png --out public/poop.png`).
- **Ольба (призрак)** — [`olba.png`](public/olba.png) из [`olba.png`](olba.png) (`sips -Z 160 olba.png --out public/olba.png`).

Старый [`public/lavanda.png`](public/lavanda.png) в коде не используется.

Иконки PWA (favicon, **На экран «Домой»**, манифест) — квадратные PNG из **корневого** [`lavanda.png`](lavanda.png) (полное фото):

```bash
npm run icons
# или: bash scripts/sync_pwa_icons.sh /путь/к/фото.png
```

Затем коммит `public/icon-*.png` и `public/apple-touch-icon.png`. Скрипт [`scripts/make_icons.py`](scripts/make_icons.py) только создаёт `.nojekyll` для Pages.

## Публикация на GitHub Pages

1. Репозиторий: [thefrol/lavanda-game](https://github.com/thefrol/lavanda-game). **Имя репо совпадает с `base` в `vite.config.ts`** (`/lavanda-game/`).
2. Один раз в репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions** (без публикации «с ветки» из корня `main`, иначе на сайте будет исходник, а не `dist`).
3. Любой пуш в **`main`** запускает [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml): `npm ci` → `npm run build` → выкладка содержимого **`dist/`** на Pages.
4. Игра: **https://thefrol.github.io/lavanda-game/**

## iPhone: добавить на экран «Домой»

1. Откройте ссылку на игру в **Safari** (не внутри другого приложения, если возможно — именно Safari).
2. Нажмите кнопку **Поделиться**.
3. Выберите **На экран «Домой»** и подтвердите название (например «Лаванда»).

Повторите то же на телефоне жены, отправив ей ссылку в сообщении.

**Иконка на экране «Домой» не обновилась** (старая картинка, хотя в Safari уже новая): iOS долго кэширует `apple-touch-icon`. После деплоя у ссылок на иконки добавляется новый `?v=` (номер сборки GitHub Actions) — удалите старую иконку с «Домой» и добавьте сайт заново из Safari; при необходимости **Настройки → Safari → Данные веб‑сайтов** → очистить данные для `github.io`.

## Только `.nojekyll` для Pages

```bash
python3 scripts/make_icons.py
```
