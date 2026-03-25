import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from '@reown/appkit/networks'

export const projectId = "cdbf2b7f4b414c9646cd74c71efbe28c"

export const ogGalileoTestnet = defineChain({
  id: 16602,
  caipNetworkId: 'eip155:16602',
  chainNamespace: 'eip155',
  name: "0G Galileo Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "0G",
    symbol: "0G",
  },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G ChainScan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
})

export const networks = [ogGalileoTestnet]

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
