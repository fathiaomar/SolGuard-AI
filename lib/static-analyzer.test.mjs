import assert from 'node:assert/strict'
import test from 'node:test'
import { scanSource } from '../services/staticAnalyzer.mjs'

test('reports AST findings with source locations and structured review prompts', () => {
  const source = `pragma solidity ^0.8.20;
contract Market {
  uint256 public sold;
  function buy(address payable seller) external {
    (bool ok,) = seller.call("");
    require(ok);
    sold += 1;
  }
}`
  const report = scanSource(source)

  assert.ok(report.findings.some((item) => item.id === 'external-call' && item.line === 5))
  assert.ok(report.findings.some((item) => item.id.startsWith('possible-reentrancy-sold')))
  assert.ok(report.analysis.bestPractices.some((item) => item.status === 'Finding'))
  assert.ok(report.analysis.metrics.functions === 1)
})

test('ignores vulnerability-looking text inside comments', () => {
  const report = scanSource(`// tx.origin and block.timestamp are only mentioned here.
pragma solidity ^0.8.20;
contract SafeExample {}`)

  assert.equal(report.findings.some((item) => item.id === 'tx-origin'), false)
  assert.equal(report.findings.some((item) => item.id === 'timestamp'), false)
})

test('only reports state-after-call reentrancy ordering, not checks-effects-interactions', () => {
  const report = scanSource(`pragma solidity ^0.8.20;
contract Market {
  uint256 public sold;
  function buy(address payable seller) external {
    sold += 1;
    seller.call("");
  }
}`)

  assert.equal(report.findings.some((item) => item.id.startsWith('possible-reentrancy-')), false)
})

test('uses parsed source locations for risky expressions', () => {
  const report = scanSource(`pragma solidity ^0.8.20;
contract Example {
  function check() external view returns (address) {
    require(tx.origin == msg.sender);
    return address(block.timestamp);
  }
}`)

  assert.equal(report.findings.find((item) => item.id === 'tx-origin')?.line, 4)
  assert.equal(report.findings.find((item) => item.id === 'timestamp')?.line, 5)
})

test('parses valid Solidity 0.8 payable casts', () => {
  const report = scanSource(`pragma solidity ^0.8.20;
contract NFT {
  address public owner;
  function mint() external payable {
    payable(owner).transfer(msg.value);
  }
}`)

  assert.equal(report.analysis.metrics.contracts, 1)
  assert.equal(report.analysis.metrics.functions, 1)
  assert.ok(report.findings.some((item) => item.id === 'external-transfer' && item.line === 5))
})

test('rejects empty or invalid Solidity instead of saving a fake clean scan', () => {
  assert.throws(() => scanSource(''), /source file is empty/i)
  assert.throws(() => scanSource('pragma solidity ^0.8.20; contract Broken { function f( { }'), /could not parse.*line 1, column 56.*mismatched input/i)
})
