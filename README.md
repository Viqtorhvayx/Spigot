# Tipstream

Social creator tipping on X1 EcoChain. Fans follow creators, tip them with a message, and creators can reply publicly — a two-way social loop, not just a payment log. Every tip splits automatically on-chain: a 2.5% platform fee, the rest owed to the creator, withdrawable instantly and verifiably.

**Live demo:** [tipstream-iota.vercel.app](https://tipstream-iota.vercel.app)
**Live contract on the Maculatus testnet:** [`0xE46141f72321163F3F35aF86cebA6693519e9cCE`](https://maculatus-scan.x1eco.com/address/0xE46141f72321163F3F35aF86cebA6693519e9cCE)

The full social loop has been verified live, end to end, not assumed from tests: a creator registered and set a funding goal (`setGoal`), a fan set a display name (`setDisplayName`) and followed the creator (`follow`, `followerCount` went to 1), the fan tipped 3 X1T with a message, the creator publicly replied to that specific tip (`replyToTip`), the reply and follower state read back correctly on-chain, and unfollowing correctly brought `followerCount` back to 0. Every number was read back from the chain, not computed locally and hoped to match.

## Why this

Grant reviewers reward two things above all: real users and real revenue. Tipstream has both by construction — the user is anyone who wants to support a creator with money (a far bigger, more obvious audience than infrastructure operators or developers), and the revenue is a literal fee baked into every transaction, not a hypothetical future business model. The social layer (follow, reply, goals, identity) is what turns it from a one-way payment utility into something people actually come back to — a fan who follows a creator, sees their goal progress, and gets a public reply to their tip has a reason to return that a bare payment link doesn't give them. It's honest about existing competition (LoopX already does payments/subscriptions on X1 EcoChain) — the bet here is on better execution and more of an actual social product, not on finding empty ecosystem space.

## Contract

`contracts/Tipstream.sol`:

**Identity & profiles**
- `registerCreator(string name, string bio)` — one-time page creation.
- `updateProfile(string name, string bio)` — change your name/bio afterward. Stats and tip history are untouched.
- `setDisplayName(string name)` — **any address, not just creators**, can set a name shown in feeds and leaderboards instead of a raw `0x...`. This is what gives fans identity too, not just creators.

**Social graph**
- `follow(address creator)` / `unfollow(address creator)` — tracks `isFollowing[fan][creator]` and each creator's `followerCount`.

**Funding goals**
- `setGoal(uint256 target, string description)` — an optional goal (e.g. "100 X1T for new gear"); the frontend renders it as a progress bar against `totalReceived`. Set target to `0` to clear it.

**Tipping & replies**
- `tip(address creator, string message) payable` — splits `msg.value`: 2.5% credited to the immutable `feeRecipient`, 97.5% credited to the creator, both as **pending withdrawals**, not pushed immediately. Returns a `tipId`.
- `replyToTip(uint256 tipId, string reply)` — only the creator who received that specific tip can reply to it, once, publicly. Turns the activity feed into an actual conversation instead of a one-way log.
- `withdraw()` — pulls your full pending balance to your wallet, guarded against reentrancy. Anyone with a nonzero balance can call it — creators and the fee recipient use the same function.

**Reads**
- `creators(address)` — profile, stats, follower count, and goal in one call.
- `pendingWithdrawals(address)`, `displayNames(address)`, `isFollowing(fan, creator)`, `tipReplies(tipId)`, `tipRecipient(tipId)`, `getCreators()`, `creatorCount()`.
- `TipSent(tipId, from, to, payout, fee, message, timestamp)` — indexed on `tipId`, `from`, and `to`, so the frontend can pull a global feed, a per-creator feed, or look up a single tip's reply, all from event logs.

**Design choices worth knowing:**

- **Pull payments, not push.** `tip()` only credits a balance; `withdraw()` moves it. A broken recipient (bad `receive()`, a full contract wallet) can only ever block themselves, never a fan's transaction or another creator's tips. Standard practice for handling other people's money on-chain.
- **Custom errors, not require strings.** Every revert (`NameTooLong`, `CreatorNotRegistered`, `NotTipRecipient`, etc.) is a named custom error — cheaper on gas than string reverts and just as readable in a trace.
- **Bounded input lengths.** Names cap at 64 bytes, bios/messages/replies at 280, goal descriptions at 140 — prevents anyone bloating contract storage or griefing gas costs with huge strings.
- **Explicit reentrancy guard on `withdraw()`.** The checks-effects-interactions ordering already made this safe, but the guard is there as defense in depth, not decoration.
- **Reply authorization is per-tip, not per-creator.** `tipRecipient[tipId]` is recorded at tip time specifically so `replyToTip` can verify `msg.sender` actually received that tip — nobody can reply to someone else's tips.

25 tests cover registration, profile updates, display names, following/unfollowing (including self-follow and double-follow rejection), funding goals, tipping (including message length and unregistered-recipient rejection), the exact fee split into pending balances, tip replies (including authorization), withdrawing (by both a creator and the fee recipient, and being unable to double-withdraw), and multi-creator tracking.

## Setup

```bash
npm install
cp .env.example .env   # add your PRIVATE_KEY
```

Get testnet X1T via the Discord faucet (`/faucet <address>` in `#faucet`, 100 X1T per claim, once per 24h).

## Compile, test, deploy

```bash
npm run compile
npm run test
npm run deploy:testnet
```

The deploy script sets the deploying wallet as the fee recipient and prints the deployment block number — the frontend needs that block to query tip history efficiently (see `frontend/app.js`'s `DEPLOY_BLOCK`). Swap in a dedicated treasury address for a real launch.

## Frontend

`frontend/index.html` — a real designed UI (Tailwind, not unstyled HTML), built to feel like a product rather than a demo:

- **Discover page** — hero, a "become a creator" panel (stats + share-link + funding-goal editor once registered), search/sort creator grid, and a global recent-activity feed built from `TipSent` events.
- **Shareable creator pages** — `?creator=0x...` renders a dedicated profile: name, bio, follower count, a **Follow/Following** button, a **goal progress bar** when a goal is set, stats, a top-supporters leaderboard, and that creator's tip history — each tip showing the creator's public reply if there is one, or (only when you're viewing your own page) an inline reply box if there isn't yet.
- **Display name control** — any connected wallet, fan or creator, can set a name shown wherever their address would otherwise appear (feeds, leaderboards).
- **Withdraw widget** — appears for any connected wallet with a nonzero pending balance (creator or platform treasury) and calls `withdraw()` directly.
- **Toast notifications** for every action, loading states on every transaction button, character counters matching real on-chain limits, deterministic per-address avatar colors — same polish standard as the rest of the app.

Already pointed at the live contract above.

**A real bug caught in an earlier round, worth keeping documented rather than scrubbing from history:** the code that loads all creators once used `{ addr, ...(await contract.creators(addr)) }` to build each row. ethers v6's `Result` objects only expose numeric indices through spread/`Object.keys()` — named fields like `.name` and `.totalReceived` are getters that spread doesn't pick up. Every creator object silently had no usable fields, which would have thrown once the grid tried to render. It went unnoticed for several commits because verification used direct property access in test scripts rather than the frontend's actual spread pattern. Fixed by explicitly pulling each field off the `Result` instead of spreading it — worth remembering for any future field added to `creators()`.

## Honest limitations (read before pitching this)

- **No content-gating or paid subscriptions**: tips, follows, goals, and replies — no paywalled content or recurring payments yet. Deliberate v1 scope cut, not an oversight.
- **LoopX already exists** in this space on X1 EcoChain. This project competes on execution and social depth, not on being first — be upfront about that in any pitch rather than implying it's unclaimed territory.
- **Activity and reply lookups query the full event range** from deployment to latest block on every load, and fetch `tipReplies` per displayed tip individually. Fine at current volume; would need pagination or an indexer (subgraph-style) if tip volume grew large.
- **Social meta tags are static**, not per-creator. A shared `?creator=` link updates the browser tab title via JS, but crawlers that don't execute JS (most link-preview bots) will still see the generic Tipstream description. True per-creator previews need server-side rendering — out of scope for a static site.
- **One reply per tip, forever.** `replyToTip` doesn't support editing or multiple replies to the same tip — simple and hard to abuse, but a creator can't correct a typo in a reply once sent.

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
