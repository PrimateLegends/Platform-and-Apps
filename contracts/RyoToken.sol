// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title RyoToken ($RYO)
/// @notice The in-game currency of Primate Legends, today an off-chain ledger on the Pre-Market.
///
/// Fixed supply of 1,000,000,000 $RYO, minted once at deployment to the distributor that pays out
/// the Pre-Market snapshot (balances plus $RYO locked in open offers). There is no mint, no burn
/// authority, no pause and no owner: after deployment nobody can change the supply or freeze a
/// wallet. Plain ERC-20 with 18 decimals.
contract RyoToken {
    string public constant name = "Ryo";
    string public constant symbol = "RYO";
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1_000_000_000 * 10 ** 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(address distributor) {
        if (distributor == address(0)) revert ZeroAddress();
        balanceOf[distributor] = totalSupply;
        emit Transfer(address(0), distributor, totalSupply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientAllowance();
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;   // cannot overflow: the sum of balances is totalSupply
        }
        emit Transfer(from, to, value);
    }
}
