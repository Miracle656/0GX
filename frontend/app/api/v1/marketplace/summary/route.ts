import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { ethers } from "ethers";
import agentNFTArtifact from "../../../../../../artifacts/contracts/AgentNFT.sol/AgentNFT.json";
import marketplaceArtifact from "../../../../../../artifacts/contracts/AgentMarketplace.sol/AgentMarketplace.json";
import addresses from "../../../../../lib/deployed-addresses.json";

const RPC_LIST = [
  process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai",
  "https://galileo-evm-rpc.validator247.com",
  "https://0gchaind-evm-rpc.j-node.net",
];

async function getProvider() {
  for (const url of RPC_LIST) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch { /* try next */ }
  }
  return new ethers.JsonRpcProvider(RPC_LIST[0]);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/v1/marketplace/summary
 * Walks the existing agents and reports which are listed for sale, listed
 * for rent, currently rented, or freely cloneable. Read-only.
 */
export async function GET() {
  try {
    const provider = await getProvider();
    const agentNFT = new ethers.Contract(addresses.AgentNFT, agentNFTArtifact.abi, provider);
    const marketplace = new ethers.Contract(addresses.AgentMarketplace, marketplaceArtifact.abi, provider);

    const total = Number(await agentNFT.totalSupply());
    const now = Math.floor(Date.now() / 1000);

    const listings: any[] = [];
    const rentals: any[] = [];
    const cloneable: any[] = [];

    for (let id = 1; id <= total; id++) {
      try {
        const meta = await agentNFT.getAgentMetadata(id);
        const cloneFee = BigInt(meta.cloneFee);
        if (cloneFee > 0n) {
          cloneable.push({
            tokenId: id,
            personalityTag: meta.personalityTag,
            cloneFee: ethers.formatEther(cloneFee),
          });
        }

        const listing = await marketplace.getListing(id);
        if (listing.active && (BigInt(listing.price) > 0n || BigInt(listing.rentalPricePerHour) > 0n)) {
          listings.push({
            tokenId: id,
            personalityTag: meta.personalityTag,
            seller: listing.seller,
            price: BigInt(listing.price) > 0n ? ethers.formatEther(listing.price) : null,
            rentalPricePerHour: BigInt(listing.rentalPricePerHour) > 0n
              ? ethers.formatEther(listing.rentalPricePerHour)
              : null,
          });
        }

        const rental = await marketplace.getRental(id);
        if (rental.active && Number(rental.startTime) + Number(rental.duration) > now) {
          rentals.push({
            tokenId: id,
            personalityTag: meta.personalityTag,
            renter: rental.renter,
            endsAt: Number(rental.startTime) + Number(rental.duration),
          });
        }
      } catch { /* skip */ }
    }

    return NextResponse.json(
      {
        totalAgents: total,
        listings,
        rentals,
        cloneable,
        marketplaceAddress: addresses.AgentMarketplace,
        platformFeeBps: 250,
        royaltyBps: 500,
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
