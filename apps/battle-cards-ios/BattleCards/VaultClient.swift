// Read-only client for the public Primate Legends API. It never signs and never sends
// transactions: the app only needs an Ethereum address to show what that profile owns.

import Foundation

enum VaultError: LocalizedError {
    case badAddress
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .badAddress: return "That doesn't look like an Ethereum address."
        case .server(let code): return "The vault didn't answer (\(code)). Try again in a moment."
        }
    }
}

struct VaultClient {
    var baseURL = URL(string: "https://primatelegends.world/api")!
    var session: URLSession = .shared

    static func isAddress(_ text: String) -> Bool {
        text.range(of: "^0x[0-9a-fA-F]{40}$", options: .regularExpression) != nil
    }

    /// Every sealed card and unopened pack of a profile.
    func vault(of address: String) async throws -> Vault {
        guard Self.isAddress(address) else { throw VaultError.badAddress }
        var parts = URLComponents(url: baseURL.appendingPathComponent("vault"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "address", value: address.lowercased())]
        let (data, response) = try await session.data(from: parts.url!)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { throw VaultError.server(status) }
        return try JSONDecoder().decode(Vault.self, from: data)
    }
}

/// Where Pre-Market listings come from. The live listings endpoint isn't public yet, so the
/// draft ships with sample data behind the same protocol the real client will implement.
protocol ListingsSource {
    func listings() async throws -> [Listing]
}

struct SampleListings: ListingsSource {
    func listings() async throws -> [Listing] {
        let now = Date()
        let rows: [(Int, Rarity, CardType, String, Currency, String)] = [
            (144, .rare, .evasion, "void", .eth, "15000000000000000"),
            (2071, .common, .attack, "crimson", .usdc, "12500000"),
            (88310, .legendary, .healing, "sakura", .eth, "120000000000000000"),
            (5120, .uncommon, .defense, "earth", .usdc, "30000000"),
            (40777, .common, .evasion, "onyx", .eth, "4000000000000000"),
            (911, .phantom, .attack, "ember", .eth, "900000000000000000")
        ]
        return rows.enumerated().compactMap { index, row in
            let (serial, rarity, type, clan, currency, units) = row
            guard let price = Price(baseUnits: units, currency: currency) else { return nil }
            let hints = CardHints(type: type, clans: [ClanHint(clan: clan, odds: 60)])
            let card = SealedCard(serial: serial, rarity: rarity, back: "classic", source: nil, hints: hints)
            return Listing(
                id: "sample-\(serial)",
                card: card,
                seller: "0x0000000000000000000000000000000000000000",
                price: price,
                listedAt: now.addingTimeInterval(TimeInterval(-3600 * index))
            )
        }
    }
}
