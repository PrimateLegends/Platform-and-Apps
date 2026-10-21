// Battle Card Legends (iOS draft)
// Player level from XP, the same curve as apps/progression: each step costs 100 XP more than the previous one
// (280, 380, 480, ...), up to level 300. The XP total comes from the site; the app only turns it into a level,
// a progress bar and the round level badge shown on the player's avatar.

import SwiftUI

struct PlayerLevel: Equatable {
    static let stepBase = 180
    static let stepGrowth = 100
    static let maxLevel = 300

    let xp: Int
    let level: Int
    let inLevel: Int
    let toNext: Int

    var isMax: Bool { level == Self.maxLevel }
    var progress: Double { isMax ? 1 : Double(inLevel) / Double(toNext) }

    /// XP from `level` to `level + 1`.
    static func stepCost(_ level: Int) -> Int { stepBase + stepGrowth * level }

    /// Total XP to stand at `level` (level 1 = 0).
    static func total(for level: Int) -> Int { (level - 1) * (stepGrowth * level / 2 + stepBase) }

    init(xp: Int) {
        let total = max(0, xp)
        var level = 1
        // Integer walk from a square-root guess: exact at every boundary.
        let guess = Int((-130.0 + (16_900.0 + 200.0 * Double(180 + total)).squareRoot()) / 100.0)
        level = min(Self.maxLevel, max(1, guess))
        while level < Self.maxLevel && Self.total(for: level + 1) <= total { level += 1 }
        while level > 1 && Self.total(for: level) > total { level -= 1 }
        self.xp = total
        self.level = level
        self.inLevel = total - Self.total(for: level)
        self.toNext = level == Self.maxLevel ? 0 : Self.stepCost(level)
    }

    /// "Level 3 · 25 / 480 XP"
    var label: String {
        isMax ? "Level \(level) · \(xp.formatted()) XP · max level" : "Level \(level) · \(inLevel.formatted()) / \(toNext.formatted()) XP"
    }
}

/// Violet XP bar with a grey track, like the wallet panel on the site.
struct XPBar: View {
    let level: PlayerLevel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color(red: 0.23, green: 0.27, blue: 0.28))
                    Rectangle().fill(Color(red: 0.55, green: 0.36, blue: 0.96))
                        .frame(width: geo.size.width * level.progress)
                }
            }
            .frame(height: 8)
            Text(level.label).font(.caption).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(level.label)
    }
}

/// Round level number for the avatar's bottom-left corner.
struct LevelBadge: View {
    let level: Int

    var body: some View {
        Text("\(level)")
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundStyle(.white)
            .padding(.horizontal, 5)
            .frame(minWidth: 22, minHeight: 22)
            .background(Capsule().fill(Color(red: 0.48, green: 0.31, blue: 0.88)))
            .overlay(Capsule().stroke(Color(red: 0.66, green: 0.55, blue: 1.0), lineWidth: 1))
            .accessibilityLabel("Level \(level)")
    }
}
