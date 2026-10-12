// SPDX-License-Identifier: UNLICENSED
// Test helper only: stands in for the Primate Legends ERC-721 so the holder rule can be tested.
pragma solidity ^0.8.24;

contract MockPrimates {
    mapping(address => uint256) public balanceOf;

    function setBalance(address owner, uint256 amount) external {
        balanceOf[owner] = amount;
    }
}
