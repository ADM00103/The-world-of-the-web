# Project Backbone — клон

Визуальный клон [project-backbone-fai.vercel.app](https://project-backbone-fai.vercel.app/) на чистом HTML/CSS/JS + Three.js (через ESM с CDN).

## Запуск

Статика без сборки. Любой http-сервер из этой папки:

```sh
python3 -m http.server 8000
# или
npx serve .
```

И открыть `http://localhost:8000/`.

## Деплой на GitHub Pages

1. Запушить содержимое папки в репозиторий.
2. Settings → Pages → Source: `main` / root → Save.
3. Дождаться билда, перейти по выданной ссылке.

Никакой сборки и зависимостей не требуется — `index.html` грузит Three.js напрямую с unpkg через importmap.

## Структура

- `index.html` — разметка и обвязка
- `styles.css` — стили
- `globe.js` — 3D-сцена (Земля, кабели, ДЦ, спутники и т.п.)
