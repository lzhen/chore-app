import CryptoKit
import Foundation
import CoreGraphics
import ImageIO

// Approved black-background nest master, resized to 1024px without artwork changes.
let approvedSHA256 = "3c64d0e94fab8bb076576ff33e252e919fbc19c14aef40e375cc035943062990"

func require(_ condition: Bool, _ message: String) {
    if !condition {
        fputs("error: \(message)\n", stderr)
        exit(1)
    }
}

func image(_ url: URL) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let result = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        require(false, "Cannot decode app icon at \(url.path)")
        fatalError()
    }
    return result
}

func pixels(_ image: CGImage) -> [UInt8] {
    let side = 128
    var bytes = [UInt8](repeating: 0, count: side * side * 4)
    bytes.withUnsafeMutableBytes { buffer in
        let context = CGContext(data: buffer.baseAddress, width: side, height: side,
                                bitsPerComponent: 8, bytesPerRow: side * 4,
                                space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(side), height: CGFloat(side)))
    }
    return bytes
}

let arguments = CommandLine.arguments
require(arguments.count == 2 || arguments.count == 3, "Usage: verify_app_icon.swift SOURCE_PNG [BUILT_APP]")
let sourceURL = URL(fileURLWithPath: arguments[1])
let data = try Data(contentsOf: sourceURL)
let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
require(digest == approvedSHA256, "AppIcon differs from the approved nest export; regenerate intentionally before changing this checksum.")
let source = image(sourceURL)
require(source.width == 1024 && source.height == 1024, "AppIcon must be 1024x1024.")
require(data.count > 26 && data[25] == 2, "AppIcon must be opaque RGB PNG without an alpha channel.")
print("PASS: approved opaque 1024x1024 nest source (\(digest)).")

if arguments.count == 3 {
    let appURL = URL(fileURLWithPath: arguments[2], isDirectory: true)
    let plistData = try Data(contentsOf: appURL.appendingPathComponent("Info.plist"))
    let plist = try PropertyListSerialization.propertyList(from: plistData, format: nil) as! [String: Any]
    let icons = plist["CFBundleIcons"] as? [String: Any]
    let primary = icons?["CFBundlePrimaryIcon"] as? [String: Any]
    require(primary?["CFBundleIconName"] as? String == "AppIcon", "Release bundle must select the AppIcon asset catalog.")
    require(FileManager.default.fileExists(atPath: appURL.appendingPathComponent("Assets.car").path), "Release bundle is missing its compiled asset catalog.")
    let files = try FileManager.default.contentsOfDirectory(at: appURL, includingPropertiesForKeys: nil)
        .filter { $0.lastPathComponent.hasPrefix("AppIcon") && $0.pathExtension == "png" }
    require(!files.isEmpty, "Release bundle contains no compiled AppIcon PNG renditions.")
    let expected = pixels(source)
    for file in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
        let compiled = image(file)
        require(compiled.width == compiled.height, "Compiled icon must be square: \(file.lastPathComponent)")
        let actual = pixels(compiled)
        var difference = 0
        for index in stride(from: 0, to: expected.count, by: 4) {
            for channel in 0..<3 {
                difference += abs(Int(expected[index + channel]) - Int(actual[index + channel]))
            }
        }
        let error = Double(difference) / Double(128 * 128 * 3 * 255)
        require(error < 0.05, "Compiled icon does not match the approved nest: \(file.lastPathComponent), mean pixel error \(error)")
        print("PASS: built \(file.lastPathComponent) \(compiled.width)x\(compiled.height) matches nest, mean pixel error \(String(format: "%.5f", error)).")
    }
}
