# NestMe platform delivery

- Web app: https://empathie.ai/nestme/ (routes to the live NestMe app)
- PWA: manifest + service worker in `public/`.
- Chrome extension: source in `chrome-extension/` for unpacked testing and later Chrome Web Store submission.
- iOS: existing Capacitor project/tooling in this repository.
- Android: same Capacitor web bundle and config are Android-compatible; generate the native Android project with Capacitor 7.4.x before signing/release. Store publishing still requires owner signing credentials and store-console review.
