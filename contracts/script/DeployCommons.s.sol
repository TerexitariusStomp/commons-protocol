// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LSSVMPairFactory} from "lssvm2/LSSVMPairFactory.sol";
import {LSSVMPairERC721ETH} from "lssvm2/erc721/LSSVMPairERC721ETH.sol";
import {LSSVMPairERC721ERC20} from "lssvm2/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC1155ETH} from "lssvm2/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC1155ERC20} from "lssvm2/erc1155/LSSVMPairERC1155ERC20.sol";
import {LSSVMRouter} from "lssvm2/LSSVMRouter.sol";
import {LinearCurve} from "lssvm2/bonding-curves/LinearCurve.sol";
import {ICurve} from "lssvm2/bonding-curves/ICurve.sol";
import {IRoyaltyEngineV1} from "manifoldxyz/IRoyaltyEngineV1.sol";
import {RoyaltyEngineV1} from "manifoldxyz/RoyaltyEngineV1.sol";
import {RoyaltyRegistry} from "manifoldxyz/RoyaltyRegistry.sol";
import {FallbackRegistry} from "manifoldxyz/FallbackRegistry.sol";
import {EIP2981RoyaltyOverrideCloneable} from "manifoldxyz/overrides/RoyaltyOverrideCloneable.sol";
import {IEIP2981RoyaltyOverride} from "manifoldxyz/overrides/IRoyaltyOverride.sol";

/// @notice Deploys the Commons NFT liquidity layer (sudoswap lssvm2, AGPL-3.0).
///         Pair types: ERC721/ERC1155 x ETH/ERC20 — stablecoin settlement uses
///         the ERC20 variants; Artifacts trade through ERC1155-ERC20 pools.
///         Protocol fee recipient is the Pot; factory owner is the Safe.
///
/// Env:
///   PRIVATE_KEY        deployer key (env only, never committed)
///   SAFE_MULTISIG      4/5 Safe that owns the factory
///   POT_ADDRESS        protocol fee recipient (defaults to SAFE_MULTISIG)
///   PROTOCOL_FEE_BPS   optional, default 50 (0.5% of swap value to Pot)
///   ROYALTY_ENGINE     optional; canonical Manifold engine where deployed,
///                      otherwise a fresh RoyaltyRegistry+Engine is deployed
contract DeployCommons is Script {
    function run() external {
        address safe = vm.envAddress("SAFE_MULTISIG");
        address pot = vm.envOr("POT_ADDRESS", safe);
        // factory takes a 1e18-scaled multiplier: 1% == 1e16
        uint256 protocolFeeMultiplier = vm.envOr("PROTOCOL_FEE_BPS", uint256(50)) * 1e14;

        vm.startBroadcast();

        (address royaltyEngine, address artifactOverride) =
            deployRoyaltyStack(safe, pot);

        LSSVMPairFactory factory;
        {
            LSSVMPairERC721ETH erc721eth = new LSSVMPairERC721ETH(IRoyaltyEngineV1(royaltyEngine));
            LSSVMPairERC721ERC20 erc721erc20 = new LSSVMPairERC721ERC20(IRoyaltyEngineV1(royaltyEngine));
            LSSVMPairERC1155ETH erc1155eth = new LSSVMPairERC1155ETH(IRoyaltyEngineV1(royaltyEngine));
            LSSVMPairERC1155ERC20 erc1155erc20 = new LSSVMPairERC1155ERC20(IRoyaltyEngineV1(royaltyEngine));

            factory = new LSSVMPairFactory(
                erc721eth, erc721erc20, erc1155eth, erc1155erc20, payable(pot), protocolFeeMultiplier, safe
            );

            LinearCurve linear = new LinearCurve();
            factory.setBondingCurveAllowed(ICurve(address(linear)), true);

            LSSVMRouter router = new LSSVMRouter(factory);

            console.log("router        %s", address(router));
            console.log("linearCurve   %s", address(linear));
            console.log("tmpl721ETH    %s", address(erc721eth));
            console.log("tmpl721ERC20  %s", address(erc721erc20));
            console.log("tmpl1155ETH   %s", address(erc1155eth));
            console.log("tmpl1155ERC20 %s", address(erc1155erc20));
        }

        vm.stopBroadcast();

        console.log("factory       %s", address(factory));
        console.log("royaltyEngine %s", royaltyEngine);
        console.log("artifactRoyaltyOverride %s", artifactOverride);
        console.log("feeRecipient  %s", pot);
        console.log("owner         %s", safe);
    }

    /// @dev Fresh Manifold stack unless ROYALTY_ENGINE is set. When we own the
    ///      registry, also deploys the artifact-collection royalty override and
    ///      registers it (per-token project share; escrow = Pot until claimed).
    function deployRoyaltyStack(address safe, address pot)
        internal
        returns (address royaltyEngine, address artifactOverride)
    {
        royaltyEngine = vm.envOr("ROYALTY_ENGINE", address(0));
        if (royaltyEngine != address(0)) return (royaltyEngine, address(0));

        FallbackRegistry fallbackRegistry = new FallbackRegistry(safe);
        RoyaltyRegistry registry = new RoyaltyRegistry(address(0));
        registry.initialize(safe);
        RoyaltyEngineV1 engine = new RoyaltyEngineV1(address(fallbackRegistry));
        engine.initialize(safe, address(registry));
        royaltyEngine = address(engine);

        address artifactCollection = vm.envOr("ARTIFACT_COLLECTION", address(0));
        if (artifactCollection != address(0)) {
            EIP2981RoyaltyOverrideCloneable ovr = new EIP2981RoyaltyOverrideCloneable();
            ovr.initialize(IEIP2981RoyaltyOverride.TokenRoyalty(payable(pot), 0), safe);
            registry.setRoyaltyLookupAddress(artifactCollection, address(ovr));
            artifactOverride = address(ovr);
        }
    }
}
