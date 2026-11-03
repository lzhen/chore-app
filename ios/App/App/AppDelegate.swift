import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
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

// Main.storyboard creates the window and NesmiBridgeViewController for this scene.
// UIKit continues posting UIApplication foreground/background notifications, which
// Capacitor observes to deliver resume/pause. Do not post duplicate notifications.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // Initial connection carries links for a cold launch; the callbacks below
        // carry links received while the scene already exists.
        forward(connectionOptions.urlContexts)
        for activity in connectionOptions.userActivities {
            forward(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        forward(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forward(userActivity)
    }

    private func forward(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace
            ]
            if let source = context.options.sourceApplication {
                options[.sourceApplication] = source
            }
            if let annotation = context.options.annotation {
                options[.annotation] = annotation
            }
            ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
        }
    }

    private func forward(_ activity: NSUserActivity) {
        ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}

// Match native safe-area surfaces to the existing web theme-color token.
// CSS owns safe-area spacing; preserve the device appearance preference.
class NesmiBridgeViewController: CAPBridgeViewController {
    private var themeObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        if #available(iOS 15.0, *), let webView = webView {
            themeObservation = webView.observe(\.themeColor, options: [.initial, .new]) { [weak self] webView, _ in
                guard let self = self, let color = webView.themeColor else { return }
                self.view.backgroundColor = color
                webView.backgroundColor = color
                webView.scrollView.backgroundColor = color
                var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
                if color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) {
                    self.setStatusBarStyle(0.2126 * red + 0.7152 * green + 0.0722 * blue < 0.5 ? .lightContent : .darkContent)
                }
            }
        }
    }
}
