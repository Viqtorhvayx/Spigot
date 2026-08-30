# X1 EcoChain Ecosystem Grants — Application Draft (Verinode)

Draft answers for the [X1 EcoChain Grant Program](https://grant.x1ecochain.com/) application (submitted via [this Airtable form](https://airtable.com/appMvL5KlSmE9J3I4/paglccI2kQaFErlF3/form)). Fill in the bracketed `[ ]` fields before submitting.

**Important — this is the real, official $5M grant program**, not an informal one: it requires **KYB/KYC and sanctions screening**, a **pitch deck**, and a credible **90–120 day delivery plan**. Read that as: don't submit this until you can actually commit to executing on the plan below, since milestone-based funding means you're on the hook for real deliverables against a real timeline.

---

**Project Name**
Verinode

**Project Type**
DePIN & Node Pilots / Infrastructure

**Project Abstract and Objective**
Verinode is an on-chain liveness attestation protocol for X1 EcoChain node operators. X1 EcoChain's core differentiator is physical decentralization across thousands of low-power nodes — but nothing in the ecosystem today lets anyone verify that claim on-chain; existing node projects (Fastnode, Nodes.garden, xNode) provide generic node-hosting and deployment tooling, not proof of live activity. Verinode closes that gap: node operators register once, then submit periodic on-chain heartbeats via a lightweight agent script; a public dashboard shows exactly which nodes are live, for how long, and their heartbeat history — all independently verifiable on-chain rather than self-reported. The objective is turning X1 EcoChain's "8,500+ low-power nodes" narrative into something anyone can audit, and giving the ecosystem a reusable primitive: any project needing to prove infrastructure uptime (node operators, oracle networks, relayers) can adopt the same contract.

**Technical Roadmap**
- Phase 1 (already complete — see Current Development Stage): core attestation contract, agent script, and dashboard, deployed and exercised live on the Maculatus testnet.
- Phase 2 (Days 1–30 of the grant period): security hardening and a second attestation dimension — self-reported energy-consumption data per heartbeat (clearly labeled as self-attested, not hardware-verified, until an oracle/hardware integration exists), plus a public API for the dashboard data.
- Phase 3 (Days 30–75): outreach to real X1Node operators to adopt the agent script; a "verified operator" badge/leaderboard to incentivize adoption; integration guide for other X1 EcoChain projects wanting to use the attestation primitive.
- Phase 4 (Days 75–120): mainnet deployment (pending X1 EcoChain mainnet availability) and a retrospective on real adoption metrics (registered operators, heartbeat volume, uptime data collected).

**Project website**
Repo: https://github.com/Viqtorhvayx/Verinode — Live dashboard: https://x1-forge-mu.vercel.app

**Project X (Twitter)**
[@handle]

**Category**
DePIN & Node Pilots — projects deploying home/edge nodes generating verifiable on-chain activity with energy-efficient operations.

**Previous Funding**
None

**Requested Funding Range**
[Program range is $10,000–$100,000 per project — set based on the scope you can actually commit to for the 90–120 day plan above]

**90–120 Day Delivery Plan**
See Technical Roadmap above. Milestones and dates need to be finalized with real target dates before submission — the program requires a credible, specific plan, not placeholders.

**Current Development Stage**
Phase 1 complete and verified live: `Verinode.sol` deployed to the Maculatus testnet at [`0xC76bC2E969803C059888218DB532DEa9B63a8D8E`](https://maculatus-scan.x1eco.com/address/0xC76bC2E969803C059888218DB532DEa9B63a8D8E). The full flow has been exercised against the live deployment — not just local tests: `registerNode` succeeded, `heartbeat` succeeded and was confirmed `isActive`, and a second immediate `heartbeat` correctly reverted with `"Heartbeat too soon"`, proving the cooldown logic on-chain. The agent script (`scripts/agent.js`) and dashboard (`frontend/`) are both built and read/write against this live contract correctly.

**Duration working on the project**
[fill in actual]

**Project live status**
Contract and dashboard live on testnet (https://x1-forge-mu.vercel.app); no real X1Node operators onboarded yet (that's the Phase 3 ask).

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

**KYB/KYC**
Required before any agreement is signed, per the program's stated terms. Not started — budget time for this before expecting funds to move.

**How did you hear about Grant Program?**
[e.g. X1 EcoChain documentation / grant.x1ecochain.com]

**Are there other details you'd like to highlight?**
Verinode is designed as ecosystem infrastructure, not a single-purpose app — the attestation contract is a reusable primitive other X1 EcoChain projects (oracles, relayers, other DePIN pilots) could adopt for their own on-chain uptime proofs, extending its value beyond node operators specifically.

---

## Notes for the applicant (not part of the form)

- **This is a bigger commitment than a typical hackathon submission.** KYB/KYC, a pitch deck, and a 90–120 day delivery plan mean the grant committee expects you to actually execute — budget real time before submitting, not just for the application itself.
- No claim of real-world adoption has been made anywhere in this draft — only that the protocol works, verified against the live chain. Keep it that way; claiming operator adoption that doesn't exist would be caught immediately by anyone checking the dashboard.
- You'll want an actual pitch deck (slides) — this markdown draft is not a substitute for the "~8 minute application with your deck" the program asks for. I can help build slide content once the milestone dates and funding ask are set.
- The repo is public at https://github.com/Viqtorhvayx/Verinode and the dashboard is live at https://x1-forge-mu.vercel.app — reviewers can inspect both directly.
