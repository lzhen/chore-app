import XCTest
import UIKit
import WebKit
import Capacitor
@testable import Nesmi

@MainActor
final class SceneLifecycleTests: XCTestCase {
    func testSceneConfigurationLoadsExistingBridge() throws {
        let manifest = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "UIApplicationSceneManifest") as? [String: Any])
        XCTAssertEqual(manifest["UIApplicationSupportsMultipleScenes"] as? Bool, false)
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        XCTAssertTrue(scene.delegate is SceneDelegate)
        let window = try XCTUnwrap((scene.delegate as? SceneDelegate)?.window)
        XCTAssertTrue(window.rootViewController is NesmiBridgeViewController)
        XCTAssertNotNil((window.rootViewController as? NesmiBridgeViewController)?.webView)
    }

    func testWebContentLoads() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = try XCTUnwrap((scene.delegate as? SceneDelegate)?.window)
        XCTAssertFalse(window.isHidden)
        let web = try XCTUnwrap((window.rootViewController as? NesmiBridgeViewController)?.webView)
        web.configuration.userContentController.addUserScript(WKUserScript(source: "window.__testErrors=[];addEventListener('error',e=>window.__testErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__testErrors.push(String(e.reason)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web.reload()
        var text = ""
        for _ in 0..<30 {
            try await Task.sleep(nanoseconds: 500_000_000)
            text = (try? await web.evaluateJavaScript("document.body?.innerText || ''")) as? String ?? ""
            if text.contains("Sign In") { break }
        }
        let errors = (try? await web.evaluateJavaScript("JSON.stringify(window.__testErrors)")) as? String ?? "unavailable"
        XCTAssertTrue(text.contains("Sign In"), "Bundled web login did not render. JS errors: \(errors)")
    }

    func testMagicLinkWarmAndColdReturnRejectsUnrequestedLinkWithoutAuthNetwork() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let web = try XCTUnwrap(((scene.delegate as? SceneDelegate)?.window?.rootViewController as? NesmiBridgeViewController)?.webView)
        let guardScript = "window.__authRequests=0;const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>{if(String(url).includes('/auth/v1/')){window.__authRequests++;return Promise.reject(new Error('Test blocked auth network'));}return originalFetch(url,options);};"
        web.configuration.userContentController.addUserScript(WKUserScript(source: guardScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web.reload()
        for _ in 0..<40 {
            try await Task.sleep(nanoseconds: 500_000_000)
            let text = (try? await web.evaluateJavaScript("document.body?.innerText || ''")) as? String ?? ""
            if text.contains("Sign in with an email link") { break }
        }
        let url = try XCTUnwrap(URL(string: "com.pawssible.chorely://auth/magic-link?state=unrequested-test&code=synthetic-test-code"))
        let app = try XCTUnwrap(UIApplication.shared.delegate as? Nesmi.AppDelegate)
        XCTAssertTrue(app.application(UIApplication.shared, open: url, options: [:]))
        for pass in 0..<2 {
            if pass == 1 { web.reload() } // App.getLaunchUrl reads retained cold-start URL.
            var text = ""
            for _ in 0..<40 {
                try await Task.sleep(nanoseconds: 500_000_000)
                text = (try? await web.evaluateJavaScript("document.body?.innerText || ''")) as? String ?? ""
                if text.contains("invalid or expired") { break }
            }
            XCTAssertTrue(text.contains("invalid or expired"), "Expected safe callback error for pass \(pass)")
            let calls = (try? await web.evaluateJavaScript("window.__authRequests")) as? Int
            XCTAssertEqual(calls, 0, "Unrequested link must not call Auth")
        }
    }

    func testWarmUniversalLinkReachesCapacitor() throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first)
        let delegate = try XCTUnwrap(scene.delegate as? SceneDelegate)
        let activity = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        let url = try XCTUnwrap(URL(string: "https://example.invalid/nesmi-callback?code=synthetic-test"))
        activity.webpageURL = url
        let received = expectation(forNotification: .capacitorOpenUniversalLink, object: nil) { notification in
            (notification.object as? [String: Any])?["url"] as? URL == url
        }
        delegate.scene(scene, continue: activity)
        XCTAssertEqual(ApplicationDelegateProxy.shared.lastURL, url)
        wait(for: [received], timeout: 2)
    }

    func testLegacyURLForwardingPreserved() throws {
        let url = try XCTUnwrap(URL(string: "nesmi-test://callback?code=synthetic-test"))
        let received = expectation(forNotification: .capacitorOpenURL, object: nil) { notification in
            (notification.object as? [String: Any])?["url"] as? URL == url
        }
        let delegate = try XCTUnwrap(UIApplication.shared.delegate as? Nesmi.AppDelegate)
        XCTAssertTrue(delegate.application(UIApplication.shared, open: url, options: [.openInPlace: false]))
        XCTAssertEqual(ApplicationDelegateProxy.shared.lastURL, url)
        wait(for: [received], timeout: 2)
    }
}
