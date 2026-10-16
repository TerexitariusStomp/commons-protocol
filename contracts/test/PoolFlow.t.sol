// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";
import {ERC1155} from "solmate/tokens/ERC1155.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LSSVMPairFactory} from "lssvm2/LSSVMPairFactory.sol";
import {LSSVMPairERC721ETH} from "lssvm2/erc721/LSSVMPairERC721ETH.sol";
import {LSSVMPairERC721ERC20} from "lssvm2/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC1155ETH} from "lssvm2/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC1155ERC20} from "lssvm2/erc1155/LSSVMPairERC1155ERC20.sol";
import {LSSVMRouter} from "lssvm2/LSSVMRouter.sol";
import {LinearCurve} from "lssvm2/bonding-curves/LinearCurve.sol";
import {ICurve} from "lssvm2/bonding-curves/ICurve.sol";
import {LSSVMPair} from "lssvm2/LSSVMPair.sol";
import {IRoyaltyEngineV1} from "manifoldxyz/IRoyaltyEngineV1.sol";
import {RoyaltyEngineV1} from "manifoldxyz/RoyaltyEngineV1.sol";
import {RoyaltyRegistry} from "manifoldxyz/RoyaltyRegistry.sol";
import {FallbackRegistry} from "manifoldxyz/FallbackRegistry.sol";
import {CommonsPot} from "../src/CommonsPot.sol";

contract MockStable is ERC20 {
    constructor() ERC20("Mock Stable", "mUSD", 18) {}
    function mint(address to, uint256 amt) external { _mint(to, amt); }
}

contract Mock1155 is ERC1155 {
    function uri(uint256) public pure override returns (string memory) { return ""; }
    function mint(address to, uint256 id, uint256 amt) external { _mint(to, id, amt, ""); }
}

/// @notice End-to-end: deploy lssvm2 stack, create a fixed-price
///         ERC-1155<->ERC20 TRADE pool, sell to pool, buy from pool,
///         protocol fee accrues to the Pot.
contract PoolFlowTest is Test {
    MockStable stable;
    Mock1155 nft;
    CommonsPot pot;
    LSSVMPairFactory factory;
    LSSVMRouter router;
    LinearCurve linear;
    RoyaltyEngineV1 engine;

    address safe = address(0x5AFE);
    address lp = address(0x1111);
    address seller = address(0x2222);
    address buyer = address(0x3333);

    uint256 constant ID = 142;
    uint128 constant SPOT = 10e18; // 10 stable per unit
    uint96 constant LP_FEE = 0; // 0% LP fee; protocol fee 0.5%
    uint256 constant PROTOCOL_FEE_BPS = 50;

    function setUp() public {
        stable = new MockStable();
        nft = new Mock1155();
        pot = new CommonsPot(IERC20(address(stable)), safe);

        FallbackRegistry fb = new FallbackRegistry(safe);
        RoyaltyRegistry reg = new RoyaltyRegistry(address(0));
        reg.initialize(safe);
        engine = new RoyaltyEngineV1(address(fb));
        engine.initialize(safe, address(reg));

        factory = new LSSVMPairFactory(
            new LSSVMPairERC721ETH(IRoyaltyEngineV1(address(engine))),
            new LSSVMPairERC721ERC20(IRoyaltyEngineV1(address(engine))),
            new LSSVMPairERC1155ETH(IRoyaltyEngineV1(address(engine))),
            new LSSVMPairERC1155ERC20(IRoyaltyEngineV1(address(engine))),
            payable(address(pot)),
            PROTOCOL_FEE_BPS * 1e14,
            safe
        );
        linear = new LinearCurve();
        vm.prank(safe);
        factory.setBondingCurveAllowed(ICurve(address(linear)), true);
        router = new LSSVMRouter(factory);
        vm.prank(safe);
        factory.setRouterAllowed(router, true);

        // seed LP with NFTs + stable
        nft.mint(lp, ID, 10);
        stable.mint(lp, 1_000e18);
        nft.mint(seller, ID, 3);
        stable.mint(buyer, 100e18);
    }

    function _createPool() internal returns (LSSVMPairERC1155ERC20 pair) {
        vm.startPrank(lp);
        nft.setApprovalForAll(address(factory), true);
        stable.approve(address(factory), 200e18);
        pair = factory.createPairERC1155ERC20(
            LSSVMPairFactory.CreateERC1155ERC20PairParams({
                token: ERC20(address(stable)),
                nft: IERC1155(address(nft)),
                bondingCurve: ICurve(address(linear)),
                assetRecipient: payable(address(0)),
                poolType: LSSVMPair.PoolType.TRADE,
                delta: 0,
                fee: LP_FEE,
                spotPrice: SPOT,
                nftId: ID,
                initialNFTBalance: 5,
                initialTokenBalance: 200e18
            })
        );
        vm.stopPrank();
    }

    function testSellToPool() public {
        LSSVMPairERC1155ERC20 pair = _createPool();

        vm.startPrank(seller);
        nft.setApprovalForAll(address(router), true);
        uint256 minOut = 0;
        uint256 deadline = block.timestamp + 300;

        LSSVMRouter.PairSwapSpecific[] memory swaps = new LSSVMRouter.PairSwapSpecific[](1);
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1; // amount of units for 1155
        swaps[0] = LSSVMRouter.PairSwapSpecific({
            pair: LSSVMPair(payable(address(pair))),
            nftIds: ids
        });
        uint256 out = router.swapNFTsForToken(swaps, minOut, seller, deadline);
        vm.stopPrank();

        // constant price: 1 unit * 10e18, minus 0.5% protocol fee
        assertEq(out, SPOT - (SPOT * PROTOCOL_FEE_BPS) / 10_000);
        // protocol fee accrued in factory; owner sweeps to the Pot
        uint256 feeAccrued = stable.balanceOf(address(factory));
        assertEq(feeAccrued, (SPOT * PROTOCOL_FEE_BPS) / 10_000);
        vm.prank(safe);
        factory.withdrawERC20ProtocolFees(ERC20(address(stable)), feeAccrued);
        assertEq(stable.balanceOf(address(pot)), feeAccrued);
        assertEq(nft.balanceOf(address(pair), ID), 6);
    }

    function testBuyFromPool() public {
        LSSVMPairERC1155ERC20 pair = _createPool();

        vm.startPrank(buyer);
        stable.approve(address(router), 100e18);
        LSSVMRouter.PairSwapSpecific[] memory swaps = new LSSVMRouter.PairSwapSpecific[](1);
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        swaps[0] = LSSVMRouter.PairSwapSpecific({
            pair: LSSVMPair(payable(address(pair))),
            nftIds: ids
        });
        router.swapERC20ForSpecificNFTs(swaps, 50e18, buyer, block.timestamp + 300);
        vm.stopPrank();

        // cost = spot + 0.5% protocol fee; router returns change, so check balance delta
        uint256 expected = SPOT + (SPOT * PROTOCOL_FEE_BPS) / 10_000;
        assertEq(stable.balanceOf(buyer), 100e18 - expected);
        assertEq(nft.balanceOf(buyer, ID), 1);
        assertEq(stable.balanceOf(address(factory)), expected - SPOT);
    }
}
