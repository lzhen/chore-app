from pathlib import Path
# Worktree-only instrumentation: product components and styles are untouched.
index=Path('dist/index.html')
text=index.read_text()
assert '</head>' in text
text=text.replace('</head>','<script src="./capture-fixture.js"></script></head>')
index.write_text(text)
Path('dist/capture-fixture.js').write_text(Path('scripts/store-capture/fixture.js').read_text())
p=Path('ios/App/App/AppDelegate.swift');swift=p.read_text();assert 'func applicationDidBecomeActive' in swift
swift=swift.replace('import Capacitor','import Capacitor\nimport WebKit',1)
needle='func applicationDidBecomeActive(_ application: UIApplication) {'
swift=swift.replace(needle,needle+'\n        if let scene = ProcessInfo.processInfo.environment["CHORELY_CAPTURE_SCENE"] { capturePoll(scene, attempt: 0) }',1)
swift+='''
// Temporary Simulator screenshot automation. Never used in release builds.
extension AppDelegate {
    private func captureWebView(_ view: UIView?) -> WKWebView? {
        guard let view = view else { return nil }
        if let web = view as? WKWebView { return web }
        for child in view.subviews { if let web = captureWebView(child) { return web } }
        return nil
    }
    private func captureResult(_ value: [String: Any]) {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        if let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: directory.appendingPathComponent("capture-ready.json"), options: .atomic)
        }
    }
    private func capturePoll(_ scene: String, attempt: Int) {
        guard attempt < 120 else { captureResult(["error": "WebView not ready", "scene": scene]); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            guard let web = self.captureWebView(self.window) else { self.capturePoll(scene, attempt: attempt + 1); return }
            web.evaluateJavaScript("typeof window.__chorelyCapture === 'function'") { value, error in
                guard let ready = value as? Bool, ready else { self.capturePoll(scene, attempt: attempt + 1); return }
                web.callAsyncJavaScript("return await window.__chorelyCapture(scene)", arguments: ["scene": scene], in: nil, contentWorld: .page) { result in
                    switch result {
                    case .success(let value):
                        let payload = value as? [String: Any] ?? ["error": "No capture metadata"]
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.captureResult(payload) }
                    case .failure(let error): self.captureResult(["error": String(describing: error), "scene": scene])
                    }
                }
            }
        }
    }
}
'''
p.write_text(swift)
