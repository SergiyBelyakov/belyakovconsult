# Базові речі — production static landing

Структура:

- `index.html` — основний лендінг книги та воркбуку.
- `calculator.html` — інтерактивний калькулятор самообману як лід-магніт.
- `assets/css/styles.css` — стилі лендінгу.
- `assets/js/main.js` — меню, анімація появи блоків, фронтенд-поведінка форми.
- `assets/images/` — оптимізовані зображення у WebP/JPG, favicon, OG image.
- `robots.txt`, `sitemap.xml` — базові SEO-файли.

Що замінити перед публікацією:

1. У `index.html` замінити `href="#lead-form"` на реальні посилання оплати, PDF-прев’ю, Telegram або checkout.
2. У `assets/js/main.js` замінити демонстраційну обробку форми на інтеграцію з SendPulse, Mailchimp, Google Sheets, Telegram bot, Formspree або CRM webhook.
3. У `sitemap.xml` і `robots.txt` замінити `https://example.com/` на реальний домен.
4. Додати Meta Pixel, Google Analytics або GTM перед закривальним тегом `</head>` чи через GTM.
5. Додати сторінки політики конфіденційності й умов перед запуском реклами.

Локальний запуск:

Відкрити `index.html` у браузері або запустити локальний сервер:

```bash
python3 -m http.server 8080
```

Потім відкрити `http://localhost:8080`.
