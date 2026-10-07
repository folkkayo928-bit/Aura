# AURA Ownership Contracts

Real on-chain ownership layer for AURA digital items.

- `AuraOwnership.sol` is ERC-721 with role-gated minting, pause controls, metadata URIs and ERC-2981 royalties.
- The web app must not call an item an NFT until a deployed contract address and token ID are recorded.
- Never commit deployer private keys. Mainnet deployment waits for secure deployer/treasury configuration and independent contract review.
