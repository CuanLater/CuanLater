// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CuanLater} from "../src/CuanLater.sol";
import {MockStock} from "../src/MockStock.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address shop = vm.envAddress("SHOP_ADDRESS");

        uint32[18] memory p = [uint32(40_000000), 40_000000, 40_000000, 40_000000, 40_000000, 40_000000,
            39_800000, 39_500000, 39_200000, 39_500000, 40_000000, 40_600000, 41_200000, 41_800000,
            42_400000, 43_000000, 43_500000, 44_000000];
        uint32[] memory tape = new uint32[](18);
        for (uint256 i; i < 18; i++) tape[i] = p[i];

        vm.startBroadcast(pk);
        MockStock stock = new MockStock();
        MockUSD usd = new MockUSD();
        CuanLater cl = new CuanLater(IERC20(address(stock)), IERC20(address(usd)), treasury, operator, tape, 2);
        stock.setMinter(address(cl), true);
        usd.setMinter(address(cl), true);
        usd.setTrustedSpender(address(cl));
        usd.mint(address(cl), 10_000e6);
        cl.registerShop(shop, "Kantin Blitz");
        vm.stopBroadcast();

        string memory k = "d";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "deployBlock", block.number);
        vm.serializeAddress(k, "cuanLater", address(cl));
        vm.serializeAddress(k, "stock", address(stock));
        vm.serializeAddress(k, "usd", address(usd));
        string memory json = vm.serializeAddress(k, "shop", shop);
        string memory path = string.concat("../deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("written", path);
        console.log(string.concat("NEXT_PUBLIC_CUANLATER_ADDRESS=", vm.toString(address(cl))));
        console.log(string.concat("NEXT_PUBLIC_STOCK_ADDRESS=", vm.toString(address(stock))));
        console.log(string.concat("NEXT_PUBLIC_USD_ADDRESS=", vm.toString(address(usd))));
        console.log(string.concat("NEXT_PUBLIC_SHOP_ADDRESS=", vm.toString(shop)));
    }
}
