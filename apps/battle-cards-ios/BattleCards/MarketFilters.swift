// Pre-Market filters and sorting, ported from apps/pre-market/src/listings.js so the app and the
// website answer the same query the same way.

import Foundation

struct MarketFilters: Equatable {
    var currency: Currency?
    var rarities: Set<Rarity> = []
    var types: Set<CardType> = []
    var search = ""

    func matches(_ listing: Listing) -> Bool {
        let card = listing.card
        if let currency, listing.price.currency != currency { return false }
        if !rarities.isEmpty, !rarities.contains(card.rarity) { return false }
        if !types.isEmpty {
            guard let type = card.hints?.type, types.contains(type) else { return false }
        }
        let digits = String(search.drop(while: { $0 == "0" || $0 == "#" }))
        if !digits.isEmpty, !String(card.serial).contains(digits) { return false }
        return true
    }
}

enum MarketSort: String, CaseIterable, Identifiable {
    case recent, priceLow, priceHigh, rarity
    var id: String { rawValue }

    var label: String {
        switch self {
        case .recent: return "Recently listed"
        case .priceLow: return "Price: low to high"
        case .priceHigh: return "Price: high to low"
        case .rarity: return "Rarity"
        }
    }

    func areInOrder(_ a: Listing, _ b: Listing) -> Bool {
        switch self {
        case .recent:
            return a.listedAt > b.listedAt
        case .priceLow, .priceHigh:
            // Prices in different currencies never compare by amount (no oracle): ETH first.
            guard a.price.currency == b.price.currency else { return a.price.currency == .eth }
            return self == .priceLow ? a.price.units < b.price.units : a.price.units > b.price.units
        case .rarity:
            let order = Rarity.allCases
            let ra = order.firstIndex(of: a.card.rarity) ?? 0
            let rb = order.firstIndex(of: b.card.rarity) ?? 0
            return ra == rb ? a.listedAt > b.listedAt : ra > rb
        }
    }
}

extension Array where Element == Listing {
    func filtered(by filters: MarketFilters, sort: MarketSort) -> [Listing] {
        filter(filters.matches).sorted(by: sort.areInOrder)
    }

    /// Cheapest listing in a currency, for the "Floor" figure.
    func floor(in currency: Currency) -> Price? {
        filter { $0.price.currency == currency }.map(\.price).min(by: { $0.units < $1.units })
    }
}
