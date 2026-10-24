// Battle Card Legends (iOS draft)
// Katana Master on the phone, read-only: a player's duel record (wins, losses, draws) as the DuelRecords contract
// tallies it, and the damage a combo deals, with the same integer rules as apps/katana-master (HP in hundredths).
// Duels themselves are played on the site; the app shows the record and links out.

import SwiftUI

enum KatanaRules {
    /// floor(100 * 1.25^n) for n = hits already in the combo; it stops growing at the 5th hit.
    static let hit = [100, 125, 156, 195, 244]
    static let hp = 5_000

    static func cutDamage(comboHits: Int, aerial: Bool = false, mulPct: Int = 100) -> Int {
        let base = hit[min(max(comboHits, 0), hit.count - 1)]
        return base * (aerial ? 120 : 100) * mulPct / 10_000
    }

    /// Damage of a whole combo of `hits` cuts, e.g. 5 cuts = 1 + 1.25 + 1.56 + 1.95 + 2.44 HP.
    static func comboDamage(hits: Int) -> Int { (0..<max(0, hits)).reduce(0) { $0 + cutDamage(comboHits: $1) } }
}

struct DuelRecord: Equatable, Decodable {
    let wins: Int
    let losses: Int
    let draws: Int

    var played: Int { wins + losses + draws }
    /// Wins out of decided duels, in whole percent; nil before the first decided duel.
    var winRate: Int? { wins + losses == 0 ? nil : wins * 100 / (wins + losses) }
    var label: String { "\(wins)W · \(losses)L · \(draws)D" }
}

struct DuelRecordRow: View {
    let record: DuelRecord

    var body: some View {
        HStack {
            Image(systemName: "figure.fencing")
            VStack(alignment: .leading, spacing: 2) {
                Text("Katana Master").font(.headline)
                Text(record.label).font(.caption.monospaced()).foregroundStyle(.secondary)
            }
            Spacer()
            if let rate = record.winRate {
                Text("\(rate)%").font(.title3.bold()).foregroundStyle(Color(red: 0.91, green: 0.75, blue: 0.40))
            } else {
                Text("No duels yet").font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
