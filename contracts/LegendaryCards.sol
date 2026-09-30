// SPDX-License-Identifier: UNLICENSED
// DRAFT — not audited, not deployed. Published so the community can review the design.
pragma solidity ^0.8.24;

/// @title LegendaryCards
/// @notice Sealed Legendary Cards as ERC-1155 tokens, pegged 1:1 to the off-chain Pre-Market.
///
/// Until the migration, cards live off-chain and are traded on the Pre-Market under their
/// Pre-Market ID (PM-00144 is card serial 144). At migration time the game server publishes a
/// snapshot of who owns which card and commits its Merkle root here. Each card then becomes token
/// id = its serial, minted exactly once to the wallet that owns it in the snapshot.
///
/// Minting is permissionless: anyone can push a batch of cards with their proofs (that is how the
/// team airdrops them), but a card can only ever go to the owner written in the snapshot.
contract LegendaryCards {
    /* ---------- ERC-1155 storage ---------- */
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /* ---------- migration ---------- */
    enum Rarity { Common, Uncommon, Rare, Legendary, Phantom }

    address public immutable admin;
    bytes32 public snapshotRoot;          // keccak256(abi.encodePacked(serial, owner, rarity)) leaves
    string public snapshotUri;            // public file with every leaf, so anyone can rebuild the tree
    bool public frozen;                   // once frozen, the root and metadata can never change
    string private _baseUri;

    uint256 public constant MAX_SERIAL = 99_999;
    mapping(uint256 => bool) public minted;
    mapping(uint256 => Rarity) public rarityOf;
    uint256 public totalMinted;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);
    event SnapshotCommitted(bytes32 root, string uri);
    event Frozen();
    event CardMigrated(uint256 indexed serial, address indexed owner, Rarity rarity);

    error NotAdmin();
    error IsFrozen();
    error NoSnapshot();
    error BadSerial();
    error AlreadyMinted(uint256 serial);
    error InvalidProof(uint256 serial);
    error LengthMismatch();
    error NotOwnerOrApproved();
    error InsufficientBalance();
    error ZeroAddress();
    error UnsafeRecipient();

    constructor(address admin_, string memory baseUri_) {
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
        _baseUri = baseUri_;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    /* ---------- admin (only until frozen) ---------- */

    function commitSnapshot(bytes32 root, string calldata uri_) external onlyAdmin {
        if (frozen) revert IsFrozen();
        snapshotRoot = root;
        snapshotUri = uri_;
        emit SnapshotCommitted(root, uri_);
    }

    function setBaseUri(string calldata baseUri_) external onlyAdmin {
        if (frozen) revert IsFrozen();
        _baseUri = baseUri_;
        emit URI(baseUri_, 0);
    }

    /// @notice Locks the snapshot and metadata forever. Done right after the migration goes live.
    function freeze() external onlyAdmin {
        if (snapshotRoot == bytes32(0)) revert NoSnapshot();
        frozen = true;
        emit Frozen();
    }

    /* ---------- migration ---------- */

    /// @notice Mints snapshot cards to their owners. Callable by anyone; each card mints once.
    function migrate(
        uint256[] calldata serials,
        address[] calldata owners,
        Rarity[] calldata rarities,
        bytes32[][] calldata proofs
    ) external {
        bytes32 root = snapshotRoot;
        if (root == bytes32(0)) revert NoSnapshot();
        uint256 n = serials.length;
        if (owners.length != n || rarities.length != n || proofs.length != n) revert LengthMismatch();
        for (uint256 i = 0; i < n; i++) {
            uint256 serial = serials[i];
            address owner = owners[i];
            if (serial == 0 || serial > MAX_SERIAL) revert BadSerial();
            if (owner == address(0)) revert ZeroAddress();
            if (minted[serial]) revert AlreadyMinted(serial);
            bytes32 leaf = keccak256(abi.encodePacked(serial, owner, uint8(rarities[i])));
            if (!_verify(root, leaf, proofs[i])) revert InvalidProof(serial);
            minted[serial] = true;
            rarityOf[serial] = rarities[i];
            _balances[serial][owner] = 1;
            emit TransferSingle(msg.sender, address(0), owner, serial, 1);
            emit CardMigrated(serial, owner, rarities[i]);
        }
        totalMinted += n;
    }

    /// @dev Sorted-pair Merkle proof, the same scheme as HonorLedger.
    function _verify(bytes32 root, bytes32 leaf, bytes32[] calldata proof) private pure returns (bool) {
        bytes32 hash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            hash = hash < p ? keccak256(abi.encodePacked(hash, p)) : keccak256(abi.encodePacked(p, hash));
        }
        return hash == root;
    }

    /* ---------- ERC-1155 ---------- */

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7   // ERC-165
            || id == 0xd9b67a26   // ERC-1155
            || id == 0x0e89341c;  // ERC-1155 metadata URI
    }

    function uri(uint256) external view returns (string memory) {
        return _baseUri; // clients replace {id} with the zero-padded hex token id (ERC-1155 metadata)
    }

    function balanceOf(address account, uint256 id) public view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balances[id][account];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory out) {
        if (accounts.length != ids.length) revert LengthMismatch();
        out = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) out[i] = balanceOf(accounts[i], ids[i]);
    }

    function setApprovalForAll(address operator, bool approved) external {
        if (operator == address(0)) revert ZeroAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external {
        if (from != msg.sender && !isApprovedForAll(from, msg.sender)) revert NotOwnerOrApproved();
        if (to == address(0)) revert ZeroAddress();
        _move(from, to, id, value);
        emit TransferSingle(msg.sender, from, to, id, value);
        if (to.code.length > 0) {
            bytes4 r = IERC1155Receiver(to).onERC1155Received(msg.sender, from, id, value, data);
            if (r != IERC1155Receiver.onERC1155Received.selector) revert UnsafeRecipient();
        }
    }

    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external {
        if (from != msg.sender && !isApprovedForAll(from, msg.sender)) revert NotOwnerOrApproved();
        if (to == address(0)) revert ZeroAddress();
        if (ids.length != values.length) revert LengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) _move(from, to, ids[i], values[i]);
        emit TransferBatch(msg.sender, from, to, ids, values);
        if (to.code.length > 0) {
            bytes4 r = IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, values, data);
            if (r != IERC1155Receiver.onERC1155BatchReceived.selector) revert UnsafeRecipient();
        }
    }

    function _move(address from, address to, uint256 id, uint256 value) private {
        uint256 bal = _balances[id][from];
        if (bal < value) revert InsufficientBalance();
        unchecked { _balances[id][from] = bal - value; }
        _balances[id][to] += value;
    }
}

interface IERC1155Receiver {
    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data) external returns (bytes4);
    function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external returns (bytes4);
}
