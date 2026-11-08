import XCTest
import WebKit
@testable import NativeUICore

final class ImageRailOwnershipTests: XCTestCase {
    @MainActor func testNewRailMemberCannotRevealAnImageOwnedRenderer() async throws {
        guard #available(iOS 26.0, *) else { return }
        let owner = UIViewController()
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 400, height: 800))
        window.rootViewController = owner
        window.makeKeyAndVisible()
        defer { window.isHidden = true }
        let web = WKWebView(frame: owner.view.bounds)
        owner.view.addSubview(web)
        let controller = NativeUIController(environment: NativeUIEnvironment(
            webView: { web }, viewController: { owner }, emit: { _, _ in }, hasListeners: { _ in false }, trigger: { _, _ in }))
        func control(_ id: String) -> [String: Any] {
            ["id": id, "kind": "button", "placement": "vertical-bars", "toolbarSlot": "start",
             "x": 0, "y": 0, "width": 48, "height": 48, "dark": false, "rtl": false,
             "items": [["id": id, "x": 0, "y": 0, "width": 48, "height": 48, "label": id,
                        "accessibilityLabel": id, "disabled": false, "selected": false,
                        "fontSize": 17, "fontWeight": 400, "color": "#000000"]]]
        }
        func update(_ revision: Int, ids: [String], images: [String], frame: CGRect? = nil) async throws {
            var options: [String: Any] = ["revision": revision, "viewportWidth": 400, "transitionDuration": 0,
                                          "controls": ids.map(control), "imageSourceIds": images]
            if let frame { options["verticalBarFrame"] = ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height] }
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                controller.update(NativeUICall(options: options, resolve: { result in
                    XCTAssertEqual(result["revision"] as? Int, revision)
                    XCTAssertTrue((result["rejectedControls"] as? [String] ?? []).isEmpty)
                    continuation.resume()
                }, reject: { continuation.resume(throwing: NSError(domain: $0, code: 1)) }))
            }
        }
        let movingFrame = CGRect(x: 0, y: 160, width: 400, height: 640)
        try await update(1, ids: ["close"], images: [], frame: movingFrame)
        let rail = try XCTUnwrap(owner.view.subviews.first { $0 !== web })
        XCTAssertEqual(rail.frame, movingFrame)
        XCTAssertNil(rail.layer.mask)
        try await update(2, ids: ["close"], images: ["close"])
        XCTAssertNotNil(rail.layer.mask)
        XCTAssertFalse(rail.isUserInteractionEnabled)
        XCTAssertEqual(rail.frame, movingFrame)
        // The new member has no image lease. The shared renderer must remain
        // concealed and retain its frame until every image lease is released.
        try await update(3, ids: ["close", "extra"], images: ["close"])
        XCTAssertTrue(rail === owner.view.subviews.first { $0 !== web })
        XCTAssertNotNil(rail.layer.mask)
        XCTAssertFalse(rail.isUserInteractionEnabled)
        XCTAssertTrue(rail.accessibilityElementsHidden)
        XCTAssertEqual(rail.frame, movingFrame)
        try await update(4, ids: ["close", "extra"], images: [])
        XCTAssertNil(rail.layer.mask)
        XCTAssertTrue(rail.isUserInteractionEnabled)
        XCTAssertFalse(rail.accessibilityElementsHidden)
        XCTAssertEqual(rail.frame, owner.view.bounds)
    }
}
