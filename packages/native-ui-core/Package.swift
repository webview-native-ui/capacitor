// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "NativeUICore", platforms: [.iOS(.v15)],
    products: [.library(name: "NativeUICore", targets: ["NativeUICore"])],
    dependencies: [.package(url: "https://github.com/webview-native-ui/engine.git", from: "1.0.0")],
    targets: [.target(name: "NativeUICore", dependencies: [.product(name: "WebViewNativeUIEngine", package: "engine")], path: "ios/Sources/NativeUICore"),
              .testTarget(name: "NativeUICoreTests", dependencies: ["NativeUICore"], path: "ios/Tests/NativeUICoreTests")]
)
