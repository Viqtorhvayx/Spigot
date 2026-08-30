# Python SDK Guide

X1 EcoChain is EVM-compatible, so standard Ethereum Python tooling works out of the box. The [official docs](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/python-sdk) recommend three options:

| Library | Notes |
|---|---|
| **web3.py** (recommended) | The official Python library for Ethereum-compatible chains |
| Brownie | Built on top of web3.py |
| Ape Framework | Modern Python dev framework |

> **Note:** the official Python SDK doc page's example points at `https://nubica-rpc.x1eco.com` — as of this writing that endpoint returns a 502 (dead). Use the live Maculatus testnet endpoint below instead.

## Install

```bash
pip install web3
```

## Connect and read a balance

```python
from web3 import Web3

w3 = Web3(Web3.HTTPProvider('https://maculatus-rpc.x1eco.com/'))

print('Connected:', w3.is_connected())

address = '0xYourAddressHere'
balance = w3.eth.get_balance(address)
print(f'{w3.from_wei(balance, "ether")} X1T')
```

## Network reference

| | |
|---|---|
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
| Native token | `X1T` |

## Send a transaction

```python
from web3 import Web3
import os

w3 = Web3(Web3.HTTPProvider('https://maculatus-rpc.x1eco.com/'))
account = w3.eth.account.from_key(os.environ['PRIVATE_KEY'])

tx = {
    'to': '0xRecipientAddress',
    'value': w3.to_wei(1, 'ether'),
    'gas': 21000,
    'gasPrice': w3.eth.gas_price,
    'nonce': w3.eth.get_transaction_count(account.address),
    'chainId': 10778,
}
signed = account.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
print('Confirmed:', tx_hash.hex())
```

## Call a contract

```python
abi = [{
    "inputs": [],
    "name": "greet",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function",
}]

contract = w3.eth.contract(address='0xYourContractAddress', abi=abi)
print(contract.functions.greet().call())
```

## Where this fits with X1 Forge

X1 Forge's CLI and templates are JS/Hardhat-based (see the [JS SDK guide](./js-sdk-guide.md)), but any backend, script, or bot you build to interact with a deployed X1 Forge contract can use web3.py exactly as shown above — point it at the same Maculatus RPC and ABI produced by `npm run compile` (found in `artifacts/contracts/*.json` after building a scaffolded project).
