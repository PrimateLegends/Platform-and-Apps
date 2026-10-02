// Primate Legends: Battle Cards (iOS draft)
// Data the app shows. Shapes follow the public read-only API of primatelegends.world
// (GET /api/vault) and the Pre-Market rules in apps/pre-market.

import Foundation

enum Rarity: String, Codable, CaseIterable, Identifiable {
    case common, uncommon, rare, legendary, phantom
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum CardType: String, Codable, CaseIterable, Identifiable {
    case attack, defense, evasion, healing
    var id: String { rawValue }
    var label: String { rawValue.capitalized }

    /// The keyword this type becomes in Card Battles.
    var keyword: String {
        switch self {
        case .attack: return "Quick Blade"
        case .defense: return "Iron Skin"
        case .evasion: return "Shadowstep"
        case .healing: return "Mend"
        }
    }
}

/// A sealed card only hints its clan: each entry is a possible clan and its odds (0...100).
struct ClanHint: Codable, Hashable {
    let clan: String
    let odds: Double

    init(clan: String, odds: Double) {
        self.clan = clan
        self.odds = odds
    }

    // The API sends each hint as a two-item array: ["sakura", 55].
    init(from decoder: Decoder) throws {
        var pair = try decoder.unkeyedContainer()
        clan = try pair.decode(String.self)
        odds = try pair.decode(Double.self)
    }

    func encode(to encoder: Encoder) throws {
        var pair = encoder.unkeyedContainer()
        try pair.encode(clan)
        try pair.encode(odds)
    }
}

struct CardHints: Codable, Hashable {
    let type: CardType?
    let clans: [ClanHint]

    init(type: CardType?, clans: [ClanHint]) {
        self.type = type
        self.clans = clans
    }

    // Older cards have no type: the API sends an empty string for them.
    init(from decoder: Decoder) throws {
        let box = try decoder.container(keyedBy: CodingKeys.self)
        type = CardType(rawValue: (try? box.decode(String.self, forKey: .type)) ?? "")
        clans = (try? box.decode([ClanHint].self, forKey: .clans)) ?? []
    }

    /// Sealed cards are filed under their most likely clan.
    var likelyClan: String? {
        clans.max(by: { $0.odds < $1.odds })?.clan
    }
}

struct SealedCard: Codable, Identifiable, Hashable {
    let serial: Int
    let rarity: Rarity
    let back: String
    let source: String?
    let hints: CardHints?

    var id: Int { serial }

    /// Cards are off-chain until the migration; this is the ID shown everywhere until then.
    var preMarketID: String { String(format: "PM-%05d", serial) }

    enum CodingKeys: String, CodingKey {
        case serial = "no"
        case rarity, back, source, hints
    }
}

struct Pack: Codable, Identifiable, Hashable {
    let id: String
    let pack: String
    let source: String?
}

struct Vault: Codable {
    let cards: [SealedCard]
    let packs: [Pack]
}

enum Currency: String, Codable, CaseIterable, Identifiable {
    case eth, usdc
    var id: String { rawValue }
    var symbol: String { self == .eth ? "ETH" : "USDC" }
    var chain: String { self == .eth ? "Ethereum" : "Solana" }
    /// Decimals of the base unit: wei for ETH, micro-USDC for USDC.
    var decimals: Int { self == .eth ? 18 : 6 }
    /// Decimals sellers can type, and the most we show.
    var listingDecimals: Int { self == .eth ? 6 : 2 }
}

/// A price in integer base units. Floats never touch a price.
struct Price: Hashable {
    let units: Decimal
    let currency: Currency

    /// Base units as sent by the API (a decimal string, e.g. "15000000000000000").
    init?(baseUnits: String, currency: Currency) {
        guard let value = Decimal(string: baseUnits), value > 0 else { return nil }
        self.units = value
        self.currency = currency
    }

    /// "0.015 ETH", "12.5 USDC": no trailing zeros, never rounded up.
    var formatted: String {
        var scaled = units / pow(Decimal(10), currency.decimals)
        var rounded = Decimal()
        NSDecimalRound(&rounded, &scaled, currency.listingDecimals, .down)
        return "\(NSDecimalNumber(decimal: rounded).stringValue) \(currency.symbol)"
    }
}

struct Listing: Identifiable, Hashable {
    let id: String
    let card: SealedCard
    let seller: String
    let price: Price
    let listedAt: Date

    var shortSeller: String {
        guard seller.count > 10 else { return seller }
        return "\(seller.prefix(6))…\(seller.suffix(4))"
    }
}
