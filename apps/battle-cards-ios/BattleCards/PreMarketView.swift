// Pre-Market: browse sealed cards listed by other players. Read-only in the app: buying and
// listing happen on primatelegends.world, wallet to wallet.

import SwiftUI

@MainActor
final class PreMarketModel: ObservableObject {
    @Published var listings: [Listing] = []
    @Published var filters = MarketFilters()
    @Published var sort: MarketSort = .recent

    private let source: ListingsSource

    init(source: ListingsSource = SampleListings()) {
        self.source = source
    }

    var visible: [Listing] { listings.filtered(by: filters, sort: sort) }

    func load() async {
        listings = (try? await source.listings()) ?? []
    }
}

struct PreMarketView: View {
    @StateObject private var model = PreMarketModel()
    @State private var selected: Listing?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Currency", selection: $model.filters.currency) {
                        Text("Any").tag(Currency?.none)
                        ForEach(Currency.allCases) { Text($0.symbol).tag(Currency?.some($0)) }
                    }
                    .pickerStyle(.segmented)
                    floorRow
                }
                Section("\(model.visible.count) listed") {
                    ForEach(model.visible) { listing in
                        Button { selected = listing } label: { ListingRow(listing: listing) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .searchable(text: $model.filters.search, prompt: "Serial number")
            .navigationTitle("Pre-Market")
            .toolbar {
                Menu("Sort") {
                    Picker("Sort", selection: $model.sort) {
                        ForEach(MarketSort.allCases) { Text($0.label).tag($0) }
                    }
                }
            }
            .sheet(item: $selected) { ListingDetail(listing: $0) }
            .task { await model.load() }
        }
    }

    private var floorRow: some View {
        HStack {
            ForEach(Currency.allCases) { currency in
                LabeledContent("Floor \(currency.symbol)", value: model.listings.floor(in: currency)?.formatted ?? "None")
                    .font(.caption)
            }
        }
    }
}

struct ListingRow: View {
    let listing: Listing

    private var subtitle: String {
        [listing.card.hints?.type?.label, listing.card.hints?.likelyClan?.capitalized]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 14) {
            Image("card-back-\(listing.card.back)")
                .interpolation(.none)
                .resizable()
                .aspectRatio(64.0 / 90.0, contentMode: .fit)
                .frame(width: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text(listing.card.preMarketID)
                    .font(.system(.subheadline, design: .monospaced).weight(.semibold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(listing.price.formatted).font(.subheadline.weight(.semibold))
                Text(listing.price.currency.chain).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct ListingDetail: View {
    let listing: Listing

    private var webURL: URL { URL(string: "https://primatelegends.world/market")! }

    var body: some View {
        VStack(spacing: 16) {
            CardTile(card: listing.card).frame(maxWidth: 180)
            LabeledContent("Price", value: listing.price.formatted)
            LabeledContent("Network", value: listing.price.currency.chain)
            LabeledContent("Seller", value: listing.shortSeller)
            LabeledContent("Fee", value: "0%")
            Link("Open on primatelegends.world", destination: webURL)
                .buttonStyle(.borderedProminent)
            Text("Payments go wallet to wallet on the website. The app only shows listings.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
    }
}
