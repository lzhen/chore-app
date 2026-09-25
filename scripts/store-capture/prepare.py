from pathlib import Path
# Worktree-only instrumentation: product components and styles are untouched.
index=Path('dist/index.html');text=index.read_text();assert '</head>' in text
index.write_text(text.replace('</head>','<script src="./capture-fixture.js"></script></head>'))
Path('dist/capture-fixture.js').write_text(Path('scripts/store-capture/fixture.js').read_text())
p=Path('ios/App/App/AppDelegate.swift');swift=p.read_text();assert 'func applicationDidBecomeActive' in swift
swift=swift.replace('import Capacitor','import Capacitor\nimport WebKit',1)
needle='func applicationDidBecomeActive(_ application: UIApplication) {'
swift=swift.replace(needle,needle+'\n        if let scene = ProcessInfo.processInfo.environment["CHORELY_CAPTURE_SCENE"] { capturePoll(scene, attempt: 0) }',1)
swift+=r'''
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
    private func captureRead(_ web: WKWebView, scene: String, attempt: Int) {
        guard attempt < 120 else { captureResult(["error":"Scene timeout", "scene":scene]); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            web.evaluateJavaScript("JSON.stringify(window.__chorelyCaptureResult || null)") { value, error in
                if let text = value as? String, let data = text.data(using: .utf8), let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.captureResult(payload) }
                } else { self.captureRead(web, scene: scene, attempt: attempt + 1) }
            }
        }
    }
    private func capturePoll(_ scene: String, attempt: Int) {
        guard attempt < 120 else { captureResult(["error": "WebView not ready", "scene": scene]); return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            guard let web = self.captureWebView(self.window) else { self.capturePoll(scene, attempt: attempt + 1); return }
            web.evaluateJavaScript("typeof window.__chorelyCapture === 'function'") { value, error in
                guard let ready = value as? Bool, ready else { self.capturePoll(scene, attempt: attempt + 1); return }
                let script = "window.__chorelyCapture('\(scene)').then(v => { window.__chorelyCaptureResult = v; }).catch(e => { window.__chorelyCaptureResult = {error:String(e)}; }); true;"
                web.evaluateJavaScript(script) { value, error in
                    if let error = error { self.captureResult(["error":String(describing:error)]); return }
                    self.captureRead(web, scene:scene, attempt:0)
                }
            }
        }
    }
}
'''
p.write_text(swift)
