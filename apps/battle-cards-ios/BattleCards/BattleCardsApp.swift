// Primate Legends: Battle Cards. First build: Inventory and Pre-Market. Battles come later.

import SwiftUI

@main
struct BattleCardsApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                InventoryView()
                    .tabItem { Label("Inventory", systemImage: "square.grid.3x3.fill") }
                PreMarketView()
                    .tabItem { Label("Pre-Market", systemImage: "tag.fill") }
            }
        }
    }
}
