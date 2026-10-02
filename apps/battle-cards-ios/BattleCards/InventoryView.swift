// Inventory: the sealed cards and unopened packs of one profile.

import SwiftUI

@MainActor
final class InventoryModel: ObservableObject {
    @Published var vault: Vault?
    @Published var message: String?
    @Published var isLoading = false

    private let client = VaultClient()

    func load(address: String) async {
        isLoading = true
        message = nil
        defer { isLoading = false }
        do {
            vault = try await client.vault(of: address)
        } catch {
            message = error.localizedDescription
        }
    }
}

struct InventoryView: View {
    @AppStorage("profileAddress") private var address = ""
    @StateObject private var model = InventoryModel()
    @State private var rarity: Rarity?
    @State private var inspected: SealedCard?

    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 14)]

    private var cards: [SealedCard] {
        let all = model.vault?.cards ?? []
        guard let rarity else { return all }
        return all.filter { $0.rarity == rarity }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    addressField
                    if let message = model.message {
                        Text(message).font(.footnote).foregroundStyle(.red)
                    }
                    if let vault = model.vault {
                        summary(vault)
                        rarityChips
                        LazyVGrid(columns: columns, spacing: 14) {
                            ForEach(cards) { card in
                                Button { inspected = card } label: { CardTile(card: card) }
                                    .buttonStyle(.plain)
                            }
                        }
                        if cards.isEmpty {
                            Text("No cards here yet.").foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(20)
            }
            .navigationTitle("Inventory")
            .overlay { if model.isLoading { ProgressView() } }
            .sheet(item: $inspected) { CardDetail(card: $0) }
            .task { if VaultClient.isAddress(address) { await model.load(address: address) } }
        }
    }

    private var addressField: some View {
        HStack {
            TextField("0x… your Ethereum address", text: $address)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(.footnote, design: .monospaced))
                .textFieldStyle(.roundedBorder)
            Button("Load") { Task { await model.load(address: address) } }
                .buttonStyle(.borderedProminent)
        }
    }

    private func summary(_ vault: Vault) -> some View {
        HStack(spacing: 24) {
            Stat(value: vault.cards.count, label: "Sealed cards")
            Stat(value: vault.packs.count, label: "Packs to open")
        }
    }

    private var rarityChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Chip(label: "All", isOn: rarity == nil) { rarity = nil }
                ForEach(Rarity.allCases) { option in
                    Chip(label: option.label, isOn: rarity == option) { rarity = option }
                }
            }
        }
    }
}

struct Stat: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)").font(.title2.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct Chip: View {
    let label: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(isOn ? Color.accentColor : Color.secondary.opacity(0.15), in: Capsule())
                .foregroundStyle(isOn ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }
}

/// A sealed card: only the back is shown, with its serial underneath.
struct CardTile: View {
    let card: SealedCard

    var body: some View {
        VStack(spacing: 6) {
            Image("card-back-\(card.back)")
                .interpolation(.none) // pixel art stays crisp
                .resizable()
                .aspectRatio(64.0 / 90.0, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            Text(card.preMarketID)
                .font(.system(.caption2, design: .monospaced))
                .foregroundStyle(.secondary)
        }
    }
}

struct CardDetail: View {
    let card: SealedCard

    var body: some View {
        VStack(spacing: 16) {
            CardTile(card: card).frame(maxWidth: 200)
            if let type = card.hints?.type {
                LabeledContent("Type", value: "\(type.label) · \(type.keyword)")
            }
            if let clans = card.hints?.clans, !clans.isEmpty {
                LabeledContent("Possible clans") {
                    Text(clans.map { "\($0.clan.capitalized) \(Int($0.odds))%" }.joined(separator: ", "))
                }
            }
            LabeledContent("Rarity", value: "To be revealed")
        }
        .padding(24)
        .presentationDetents([.medium])
    }
}
