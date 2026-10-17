// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "7.6.9"),
        .package(name: "CapacitorCommunityKeepAwake", path: "Plugins/CapacitorCommunityKeepAwake"),
        .package(name: "CapacitorApp", path: "Plugins/CapacitorApp"),
        .package(name: "CapacitorHaptics", path: "Plugins/CapacitorHaptics"),
        .package(name: "CapacitorKeyboard", path: "Plugins/CapacitorKeyboard"),
        .package(name: "CapacitorLocalNotifications", path: "Plugins/CapacitorLocalNotifications"),
        .package(name: "CapacitorPreferences", path: "Plugins/CapacitorPreferences"),
        .package(name: "CapacitorSplashScreen", path: "Plugins/CapacitorSplashScreen"),
        .package(name: "CapacitorStatusBar", path: "Plugins/CapacitorStatusBar")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityKeepAwake", package: "CapacitorCommunityKeepAwake"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar")
            ]
        )
    ]
)
