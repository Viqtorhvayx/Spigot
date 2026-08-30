#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const X1_TESTNET = {
  name: 'Maculatus Testnet',
  rpcUrl: 'https://maculatus-rpc.x1eco.com/',
  chainId: 10778,
};

function printHelp() {
  console.log(`
X1 Forge — create-x1-app

Usage:
  create-x1-app <project-name> [--template <name>]
  create-x1-app status

Options:
  --template <name>   Template to scaffold (default: "default")
  --list-templates    List available templates
  -h, --help          Show this help message

Commands:
  status               Check X1 EcoChain testnet RPC health (chain ID, block number, latency)

Examples:
  create-x1-app my-dapp
  create-x1-app my-dapp --template erc20
  create-x1-app status
`);
}

async function rpcCall(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

async function checkStatus() {
  console.log(`Checking ${X1_TESTNET.name} (${X1_TESTNET.rpcUrl}) ...\n`);
  const start = Date.now();
  try {
    const [chainIdHex, blockHex] = await Promise.all([
      rpcCall(X1_TESTNET.rpcUrl, 'eth_chainId'),
      rpcCall(X1_TESTNET.rpcUrl, 'eth_blockNumber'),
    ]);
    const latency = Date.now() - start;
    const chainId = parseInt(chainIdHex, 16);
    const blockNumber = parseInt(blockHex, 16);
    const chainIdOk = chainId === X1_TESTNET.chainId;

    console.log(`  RPC:          reachable`);
    console.log(`  Latency:      ${latency}ms`);
    console.log(`  Chain ID:     ${chainId}${chainIdOk ? '' : ` (!) expected ${X1_TESTNET.chainId}`}`);
    console.log(`  Block number: ${blockNumber}`);
    console.log(`\n  Status: ${chainIdOk ? 'OK' : 'MISMATCH'}`);
    if (!chainIdOk) process.exitCode = 1;
  } catch (err) {
    console.log(`  RPC:    unreachable (${err.message})`);
    console.log(`\n  Status: DOWN`);
    process.exitCode = 1;
  }
}

function listTemplates() {
  const templates = fs.readdirSync(TEMPLATES_DIR).filter((entry) =>
    fs.statSync(path.join(TEMPLATES_DIR, entry)).isDirectory()
  );
  console.log('Available templates:');
  for (const t of templates) console.log(`  - ${t}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destName = entry.name === 'gitignore' ? '.gitignore' : entry.name;
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      args.help = true;
    } else if (arg === '--list-templates') {
      args.listTemplates = true;
    } else if (arg === '--template') {
      args.template = argv[++i];
    } else {
      args._.push(arg);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.listTemplates) {
    listTemplates();
    return;
  }

  if (args._[0] === 'status') {
    await checkStatus();
    return;
  }

  const projectName = args._[0];
  if (!projectName) {
    console.error('Error: missing <project-name>.\n');
    printHelp();
    process.exitCode = 1;
    return;
  }

  const templateName = args.template || 'default';
  const templateDir = path.join(TEMPLATES_DIR, templateName);
  if (!fs.existsSync(templateDir)) {
    console.error(`Error: template "${templateName}" not found.\n`);
    listTemplates();
    process.exitCode = 1;
    return;
  }

  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(`Error: directory "${projectName}" already exists and is not empty.`);
    process.exitCode = 1;
    return;
  }

  copyDir(templateDir, targetDir);

  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.name = path.basename(targetDir).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  console.log(`
Created ${projectName} from the "${templateName}" template.

Next steps:
  cd ${projectName}
  npm install
  cp .env.example .env        # add your PRIVATE_KEY

Get testnet X1T:
  Join the X1 EcoChain Discord and run /faucet <your-address> in #faucet
  (100 X1T per claim, once per 24h, wallet balance must be under 500 X1T)

Deploy to the Maculatus testnet:
  npx hardhat run scripts/deploy.js --network x1Testnet

View your contract on the explorer:
  https://maculatus-scan.x1eco.com/

Then open frontend/index.html (or serve it) to try the wallet-connect demo.
`);
}

main();

