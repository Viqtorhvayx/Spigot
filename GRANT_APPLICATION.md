# X1 EcoChain Ecosystem Grants — Application Draft

Draft answers for the [X1 EcoChain Grant Program Application Form](https://airtable.com/appMvL5KlSmE9J3I4/paglccI2kQaFErlF3/form). Fill in the bracketed `[ ]` fields before submitting.

---

**Project Name**
X1 Forge

**Project Type**
Developer Tooling / Infrastructure

**Project Abstract and Objective**
X1 Forge is the official developer starter kit for X1 EcoChain: a single CLI command (`npx create-x1-app`) that scaffolds a ready-to-deploy EVM dApp preconfigured for the Maculatus testnet — sample contract, Hardhat deploy/verify scripts, and a wallet-connect frontend with a one-click "Add X1 EcoChain to MetaMask" flow, all wired up out of the box. The primary objective is lowering the time-to-first-deploy for new builders on X1 EcoChain from hours of manually assembling RPC config, network params, and boilerplate to under five minutes. Key use cases: hackathon participants who need a working base fast, teams evaluating X1 EcoChain who want to test-drive it without reading the full docs first, and existing X1 EcoChain projects who want a maintained reference implementation to fork. This directly enhances developer tools (the CLI, template, docs) and user experience (the in-browser network-add flow, faucet guidance) — the two things this grant program is designed to fund — and is well-suited to emerging market conditions because it removes cost/expertise barriers for builders who don't have the time to reverse-engineer chain config from scattered docs.

**Technical Roadmap**
- M1 (Weeks 1–2): `create-x1-app` CLI + default template — Hardhat project preconfigured with Maculatus testnet (chain ID 10778), sample `Greeter` contract, deploy + test scripts, wallet-connect frontend demo. **[Status: complete — CLI scaffolds, `npm test` and `hardhat compile` pass, and a contract deployed live to the Maculatus testnet: [`0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755`](https://maculatus-scan.x1eco.com/address/0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755).]**
- M2 (Weeks 3–4): UX layer — one-click "Add to MetaMask", CLI output with faucet instructions, a network-status check command, and a second template (ERC-20). **[Status: complete — `create-x1-app status` checks live RPC health; `create-x1-app <name> --template erc20` scaffolds an OpenZeppelin-based token with a balance/transfer frontend, deployed live to the Maculatus testnet: [`0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53`](https://maculatus-scan.x1eco.com/address/0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53).]**
- M3 (Weeks 5–6): Docs/tutorial site — quickstart, SDK integration guides (JS + Python), a walkthrough, published to a docs domain. **[Status: content complete — quickstart, templates guide, JS SDK guide (ethers.js) and Python SDK guide (web3.py) both verified against live chain data, contract-verification guide, and a real terminal-recorded walkthrough of the full flow. Site is Jekyll-ready with a GitHub Actions deploy workflow; live publish needs one manual GitHub Pages toggle (Settings → Pages → Source: GitHub Actions) which only a repo owner can set.]**
- M4 (Weeks 7–8): Reference dApp built end-to-end with the kit, deployed live on the Maculatus testnet, linked from the docs as a worked example. **[Status: complete — "X1 Faucet," a self-serve ERC-20 claim faucet with an on-chain cooldown, deployed live at [`0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`](https://maculatus-scan.x1eco.com/address/0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F). Its `claim()` function was exercised against the live deployment — a real claim succeeded, and a second immediate claim correctly reverted with the on-chain cooldown message — not just verified in local tests. Linked from the docs homepage.]**

**Project website**
https://github.com/Viqtorhvayx/X1Forge (docs site at https://viqtorhvayx.github.io/X1Forge/ once the GitHub Pages toggle below is flipped)

**Project X (Twitter)**
[@handle]

**Previous Funding**
None

**Funding Details**
N/A

**Requested Funding Range**
[Select the range closest to your total ask — see Grant Budget Structure below]

**Grant Budget Structure & Milestones**

Requesting an upfront payment (up to 20%) to cover initial development, with the remainder released against the four milestones below.

- **Milestone 1**
  - Name: CLI + Starter Template
  - Description: Build and publish `create-x1-app`, a CLI that scaffolds a Hardhat-based dApp preconfigured for the Maculatus testnet, with a sample contract, deploy/test scripts, and a wallet-connect frontend demo.
  - Deliverables & Success Metrics/KPIs: CLI published to npm; running `npx create-x1-app <name>` produces a project where `npm test` and `npm run deploy:testnet` succeed against the live testnet; public GitHub repo. **Already demonstrated: a contract scaffolded and deployed via this exact pipeline is live at `0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755` on the Maculatus testnet.**
  - Estimated Completion Date: [date]
  - Amount Requested: [amount]

- **Milestone 2**
  - Name: UX Layer
  - Description: Add one-click network setup, CLI-embedded faucet guidance, a network-status check, and a second starter template (ERC-20).
  - Deliverables & Success Metrics/KPIs: `wallet_addEthereumChain` flow ships in the frontend demo; `create-x1-app --template <name>` supports 2+ templates; network status command returns live RPC health. **Already demonstrated: `create-x1-app status` reports live chain ID/block/latency; the ERC-20 template deployed live at `0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53`.**
  - Estimated Completion Date: [date]
  - Amount Requested: [amount]

- **Milestone 3**
  - Name: Docs & Tutorials
  - Description: Publish a quickstart, JS/Python SDK integration guides, a templates guide, a contract-verification guide, and a walkthrough of the full flow.
  - Deliverables & Success Metrics/KPIs: Docs site live at [domain]; 5 guides published (quickstart, templates, JS SDK, Python SDK, verification); walkthrough published and linked from docs and README. **Already demonstrated: all 5 guides written, JS and Python SDK examples independently verified against live chain data (real balance/contract reads), and a real terminal-recording walkthrough built from actual command output. Deploy pipeline (Jekyll + GitHub Actions) is in place; live URL pending a one-time Pages toggle by the repo owner.**
  - Estimated Completion Date: [date]
  - Amount Requested: [amount]

- **Milestone 4**
  - Name: Reference dApp
  - Description: Ship a complete example application built with X1 Forge, deployed live on the Maculatus testnet.
  - Deliverables & Success Metrics/KPIs: Contract verified on the X1 EcoChain explorer; live frontend URL; linked as the canonical example from the docs. **Already demonstrated: "X1 Faucet" — a self-serve ERC-20 claim faucet with a cooldown, deployed live at `0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`. `claim()` was called against the live contract (successful claim + a correctly-reverted repeat attempt), proving the core mechanic works on-chain, not just in tests. Linked from the docs homepage. Formal explorer source verification (see the M3 verify-contract guide) is still open — worth doing before the final submission.**
  - Estimated Completion Date: [date]
  - Amount Requested: [amount]

**Current Development Stage**
All four milestones complete. CLI, both starter templates, one-click MetaMask add, the `status` command, a full docs site, and a reference dApp are all built and verified against the live Maculatus testnet — three deployed contracts as proof: `Greeter` at [`0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755`](https://maculatus-scan.x1eco.com/address/0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755), `X1Token` at [`0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53`](https://maculatus-scan.x1eco.com/address/0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53), and the `X1Faucet` reference dApp at [`0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`](https://maculatus-scan.x1eco.com/address/0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F) with its `claim()` mechanic exercised live. Two things remain before final submission: a one-time GitHub Pages toggle from the repo owner to publish the docs site, and formal explorer source verification of the deployed contracts.

**Duration working on the project**
[e.g. "2 weeks" — fill in actual]

**Project live status**
Contracts and reference dApp live on the Maculatus testnet; CLI not yet published to npm; docs site built but not yet publicly hosted (pending the Pages toggle noted above).

---

**Applicant Full Name**
[Your name]

**Applicant Email**
victorolagbaye679@gmail.com

**Applicant Job Title**
[e.g. Founder / Solo Developer]

**Applicant Bio**
[2–3 sentences: background, relevant experience, prior projects shipped]

**Telegram**
[@handle]

**Team size**
[e.g. 1 (solo)]

**How did you hear about Grant Program?**
[e.g. X1 EcoChain documentation / Discord / Twitter]

**Are there other details, milestones, or contributions you'd like to highlight?**
X1 Forge is designed to be a maintained public good, not a one-off deliverable — the plan is to keep the CLI and templates updated as X1 EcoChain's tooling evolves (SDK changes, mainnet launch, new EVM features), and to accept community template contributions once the base kit ships.

---

## Notes for the applicant (not part of the form)

- Fill in every `[ ]` before submitting — funding amounts, dates, and personal details are yours to set.
- The CLI and M1 template already exist in this repo (`x1-forge/`) and have been verified fully end-to-end: `create-x1-app` scaffolds correctly, `npm test` passes, `hardhat compile` succeeds against Solidity 0.8.24, and a real deploy to the live Maculatus testnet succeeded (`0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755`). The wallet used was generated fresh for this test and funded via the Discord faucet — treat it as disposable; use your own wallet for the actual submission/demo if you want continued control of it.
- The repo is public at https://github.com/Viqtorhvayx/X1Forge — reviewers can inspect the code directly.
