// SPDX-License-Identifier: UNLICENSED
// Test helper only: receives ETH from LiquidityVault.forward and sends part of it straight back,
// like a refund or a swap that returns change, to check that change is not counted as a deposit.
pragma solidity ^0.8.24;

contract Bouncer {
    function bounce(uint256 back) external payable {
        (bool ok, ) = msg.sender.call{value: back}("");
        require(ok, "bounce");
    }

    receive() external payable {}
}
