// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title PrimatesGate
/// @notice Holder rule shared by the $RYO market contracts: an action is open only to wallets that
/// hold at least `minPrimates` Primate Legends warriors (ERC-721) at the moment of the call.
///
/// The collection and the minimum are fixed at deployment. The check reads `balanceOf` live, so
/// selling or moving warriors away closes access right away, and nothing is cached or signed off-chain.
abstract contract PrimatesGate {
    IERC721Balance public immutable primates;
    uint256 public immutable minPrimates;

    error ZeroAddress();
    error BadMinimum();
    /// The caller holds `held` warriors and needs `needed`.
    error NotEnoughPrimates(uint256 held, uint256 needed);

    constructor(address primatesCollection, uint256 minimum) {
        if (primatesCollection == address(0)) revert ZeroAddress();
        if (minimum == 0) revert BadMinimum();
        primates = IERC721Balance(primatesCollection);
        minPrimates = minimum;
    }

    /// How many warriors `wallet` holds and whether that is enough.
    function canTrade(address wallet) public view returns (bool allowed, uint256 held) {
        held = primates.balanceOf(wallet);
        allowed = held >= minPrimates;
    }

    modifier onlyPrimatesHolders() {
        uint256 held = primates.balanceOf(msg.sender);
        if (held < minPrimates) revert NotEnoughPrimates(held, minPrimates);
        _;
    }
}
