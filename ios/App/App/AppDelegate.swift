import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// Keep the native canvas/status bar in sync with the app's selected appearance.
// This bridge accepts only a theme name from the bundled main frame, never credentials.
import WebKit
private final class AppearanceMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: NesmiViewController?
    init(_ owner: NesmiViewController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "capacitor",
              let theme = message.body as? String,
              ["light", "dark", "system"].contains(theme) else { return }
        owner?.applyAppearance(theme)
    }
}

class NesmiViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        if let saved = UserDefaults.standard.string(forKey: "NesmiAppearance") {
            applyAppearance(saved)
        } else {
            applyAppearance("system")
        }
        let controller = webView?.configuration.userContentController
        controller?.add(AppearanceMessageHandler(self), name: "nesmiAppearance")
        let script = """
        (() => {
          const send = () => window.webkit.messageHandlers.nesmiAppearance.postMessage(
            localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme') ? 'system' : (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
          new MutationObserver(send).observe(document.documentElement, {attributes:true, attributeFilter:['class','data-theme']});
          send();
        })();
        """
        controller?.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
    }
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if UserDefaults.standard.string(forKey: "NesmiAppearance") == "system",
           previousTraitCollection?.userInterfaceStyle != traitCollection.userInterfaceStyle {
            applyAppearance("system")
        }
    }
    fileprivate func applyAppearance(_ theme: String) {
        overrideUserInterfaceStyle = theme == "system" ? .unspecified : (theme == "dark" ? .dark : .light)
        let dark = theme == "system" ? traitCollection.userInterfaceStyle == .dark : theme == "dark"
        let background = dark ? UIColor(red: 8/255, green: 8/255, blue: 9/255, alpha: 1) : UIColor.white
        view.backgroundColor = background
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        setStatusBarStyle(dark ? .lightContent : .darkContent)
        UserDefaults.standard.set(theme, forKey: "NesmiAppearance")
    }
}
