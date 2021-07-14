import { JsonRpcProvider } from "@ethersproject/providers";
import Table from "cli-table3";

import { Yearn } from "../dist/index.js";
import { Addresses, YearnGovernance } from "./common.mjs";

const url = process.env.WEB3_PROVIDER || "http://localhost:8545";
const provider = new JsonRpcProvider(url);

const yearn = new Yearn(1, {
  provider,
  addresses: Addresses
});

async function main() {
  const result = await yearn.vaults.summaryOf("0x25B28EE7f335F0396f41f129039F1583345B21b8");

  console.log(result);
  return;

  const vaults = await yearn.vaults.get();

  const vaultsTable = new Table();
  vaultsTable.push(...vaults.map(vault => [vault.name, vault.address, vault.typeId]));

  console.log("V1 & V2 vaults:");
  console.log(vaultsTable.toString());

  const positions = await yearn.vaults.positionsOf(YearnGovernance);

  const positionsTable = new Table();
  positionsTable.push(
    ...positions.map(position => {
      const vault = vaults.find(vault => vault.address === position.assetAddress);
      return [vault.name, position.balance];
    })
  );

  console.log("Yearn Multisig vault positions:");
  console.log(positionsTable.toString());
}

main();
