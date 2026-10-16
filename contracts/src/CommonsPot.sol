// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

/// @title CommonsPot
/// @notice Hold-or-Exit endowment vault over the settlement stablecoin.
///         Hold = keep pro-rata shares while the pot grows (fee + yield intake).
///         Exit = redeem shares, they burn.
///         Launch posture: fully liquid. Strategy/lending of pot assets is
///         governance-gated and OFF at launch (bank-run analysis first).
/// @dev Owner is the Safe multisig. `skim` routes protocol fees in without
///      minting shares (fees grow every existing share).
contract CommonsPot is ERC4626, Ownable, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Addresses allowed to push fees into the pot.
    mapping(address => bool) public feeSources;

    event FeeSourceSet(address indexed source, bool allowed);
    event FeesSkimmed(address indexed source, uint256 assets);

    constructor(IERC20 stable_, address owner_)
        ERC20("Commons Pot Share", "cPOT")
        ERC4626(stable_)
        Ownable()
    {
        _transferOwnership(owner_);
    }

    /// @notice Push `assets` of the underlying into the pot without minting
    ///         shares. Pulls from caller; caller must have approved.
    function skim(uint256 assets) external whenNotPaused {
        if (!feeSources[msg.sender]) revert("not a fee source");
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
        emit FeesSkimmed(msg.sender, assets);
    }

    /// @notice Cheap intake for already-transferred assets is unnecessary:
    ///         plain transfers to this contract already grow all shares.
    function setFeeSource(address source, bool allowed) external onlyOwner {
        feeSources[source] = allowed;
        emit FeeSourceSet(source, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function deposit(uint256 assets, address receiver) public override whenNotPaused returns (uint256) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override whenNotPaused returns (uint256) {
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override whenNotPaused returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override whenNotPaused returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }
}
