import XCTest

final class LaunchLifecycleTests: XCTestCase {
    @MainActor
    func testEmailLinkEntryKeepsPasswordOptionWithoutSendingMail() {
        let app = XCUIApplication(bundleIdentifier: "com.pawssible.chorely")
        app.launch()
        let entry = app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Sign in with an email link")).firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 20))
        entry.tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Email me a sign-in link")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(app.secureTextFields.count, 0)
        app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Back to sign in")).firstMatch.tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Sign In")).firstMatch.waitForExistence(timeout: 5))
        XCTAssertGreaterThan(app.secureTextFields.count, 0)
    }

    @MainActor
    func testColdLaunchRelaunchAndBackgroundRestore() {
        let app = XCUIApplication(bundleIdentifier: "com.pawssible.chorely")
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Sign In")).firstMatch.waitForExistence(timeout: 20))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Sign In")).firstMatch.waitForExistence(timeout: 20))
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 5))
        app.activate()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Sign In")).firstMatch.waitForExistence(timeout: 15))
        XCTAssertEqual(app.state, .runningForeground)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Nesmi after cold launch, relaunch and resume"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
