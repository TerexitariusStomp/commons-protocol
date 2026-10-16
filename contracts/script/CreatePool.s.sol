// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {LSSVMPairFactory} from "lssvm2/LSSVMPairFactory.sol";
import {LSSVMPairERC1155ERC20} from "lssvm2/erc1155/LSSVMPairERC1155ERC20.sol";
import {LSSVMPair} from "lssvm2/LSSVMPair.sol";
import {ICurve} from "lssvm2/bonding-curves/ICurve.sol";

/// @notice Creates a constant-price ERC-1155 <-> ERC20 pool (delta=0 on the
///         linear curve = Anvil-style fixed-price pool) seeded by the caller.
///
/// Env:
///   FACTORY            deployed LSSVMPairFactory
///   BONDING_CURVE      deployed LinearCurve (whitelisted)
///   NFT                ERC-1155 collection (e.g. Artizen Seasons)
///   NFT_ID             edition/tokenId this pool trades
///   TOKEN              settlement ERC20 (stablecoin)
///   SPOT_PRICE         fixed price per NFT unit, in token wei
///   LP_FEE_BPS         LP trade fee bps (TRADE pools only; 0 otherwise)
///   POOL_TYPE          "TRADE" | "NFT" | "TOKEN"   (default TRADE)
///   INITIAL_NFT_QTY    units of NFT_ID to seed
///   INITIAL_TOKEN_QTY  token units to seed (wei)
contract CreatePool is Script {
    function run() external {
        LSSVMPairFactory factory = LSSVMPairFactory(payable(vm.envAddress("FACTORY")));
        ICurve curve = ICurve(vm.envAddress("BONDING_CURVE"));
        IERC1155 nft = IERC1155(vm.envAddress("NFT"));
        uint256 nftId = vm.envUint("NFT_ID");
        ERC20 token = ERC20(vm.envAddress("TOKEN"));
        uint128 spot = uint128(vm.envUint("SPOT_PRICE"));
        uint96 fee = uint96(vm.envOr("LP_FEE_BPS", uint256(0)) * 1e14); // bps -> 1e18 fraction
        uint256 nftQty = vm.envOr("INITIAL_NFT_QTY", uint256(0));
        uint256 tokenQty = vm.envOr("INITIAL_TOKEN_QTY", uint256(0));

        string memory poolTypeName = vm.envOr("POOL_TYPE", string("TRADE"));
        LSSVMPair.PoolType poolType = keccak256(bytes(poolTypeName)) == keccak256("NFT")
            ? LSSVMPair.PoolType.NFT
            : keccak256(bytes(poolTypeName)) == keccak256("TOKEN")
                ? LSSVMPair.PoolType.TOKEN
                : LSSVMPair.PoolType.TRADE;

        vm.startBroadcast();

        if (nftQty > 0) nft.setApprovalForAll(address(factory), true);
        if (tokenQty > 0) token.approve(address(factory), tokenQty);

        LSSVMPairERC1155ERC20 pair = factory.createPairERC1155ERC20(
            LSSVMPairFactory.CreateERC1155ERC20PairParams({
                token: token,
                nft: nft,
                bondingCurve: curve,
                assetRecipient: payable(address(0)),
                poolType: poolType,
                delta: 0, // constant price
                fee: fee,
                spotPrice: spot,
                nftId: nftId,
                initialNFTBalance: nftQty,
                initialTokenBalance: tokenQty
            })
        );

        vm.stopBroadcast();

        console.log("pair %s", address(pair));
        console.log("nft  %s id %s", address(nft), nftId);
        console.log("spot %s", spot);
    }
}
