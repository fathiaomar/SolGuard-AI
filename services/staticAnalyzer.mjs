import parser from '@solidity-parser/parser'

function lineOf(node) {
  return node?.loc?.start?.line || 1
}

function finding(id, severity, title, recommendation, line, autoFixable = false) {
  return { id, severity, title, recommendation, line, autoFixable }
}

export function scanSource(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new Error('The Solidity source file is empty.')
  }

  let ast
  try {
    ast = parser.parse(source, { loc: true, range: true })
  } catch (error) {
    const location = Array.isArray(error.errors) ? error.errors[0] : null
    const line = location?.line ? ` near line ${location.line}` : ''
    const column = Number.isInteger(location?.column) ? `, column ${location.column + 1}` : ''
    const detail = location?.message
    throw new Error(`Could not parse this Solidity source${line}${column}${detail ? `: ${detail}` : ''}. Check the compiler syntax and try again.`)
  }

  const findings = []
  const gasSuggestions = []
  const bestPractices = []
  const stateVariables = new Set()
  const contractDefinitions = []
  const contractStateVariables = new Map()
  const externalCallSites = []
  const stateWriteSites = []
  let contracts = 0
  let events = 0
  let loops = 0

  parser.visit(ast, {
    ContractDefinition(node) {
      contracts += 1
      contractDefinitions.push(node)
      contractStateVariables.set(node, new Set(
        (node.subNodes || [])
          .flatMap((child) => child.type === 'StateVariableDeclaration' ? child.variables || [] : [])
          .filter((variable) => variable.isStateVar && variable.name)
          .map((variable) => variable.name),
      ))
    },
    EventDefinition() {
      events += 1
    },
    VariableDeclaration(node) {
      if (node.isStateVar && node.name) stateVariables.add(node.name)
    },
  })

  parser.visit(ast, {
    MemberAccess(node) {
      if (node.expression?.type === 'Identifier' &&
          node.expression.name === 'tx' && node.memberName === 'origin') {
        findings.push(finding(
          'tx-origin',
          'High',
          'tx.origin is used',
          'Do not use tx.origin for authorization. Use msg.sender with an explicit role or ownership check, and validate the surrounding authorization design.',
          lineOf(node),
        ))
      }

      if (node.expression?.type === 'Identifier' &&
          node.expression.name === 'block' && node.memberName === 'timestamp') {
        findings.push(finding(
          'timestamp',
          'Medium',
          'Block timestamp is used',
          'Review whether this timestamp affects randomness, auctions, or time-sensitive access. Block timestamps are not precise or unpredictable.',
          lineOf(node),
        ))
      }

      if (node.memberName === 'delegatecall') {
        findings.push(finding(
          'delegatecall',
          'High',
          'delegatecall requires trusted target validation',
          'Verify that the target is trusted and authorization is enforced; review storage-layout compatibility and the consequences of executing foreign code in this contract.',
          lineOf(node),
        ))
      }

      if (['call', 'send', 'transfer'].includes(node.memberName)) {
        externalCallSites.push(node)
        findings.push(finding(
          `external-${node.memberName}`,
          'Medium',
          node.memberName === 'call' ? 'Low-level call needs review' : `External value ${node.memberName} needs review`,
          'Verify the call result, target trust, state-update ordering, and reentrancy protections in the full function context.',
          lineOf(node),
        ))
      }
    },
    BinaryOperation(node) {
      if (['=', '+=', '-=', '*=', '/=', '%='].includes(node.operator) &&
          node.left?.type === 'Identifier' && stateVariables.has(node.left.name)) {
        stateWriteSites.push({ name: node.left.name, range: node.range })
      }
    },
    UnaryOperation(node) {
      if (['++', '--'].includes(node.operator) &&
          node.subExpression?.type === 'Identifier' && stateVariables.has(node.subExpression.name)) {
        stateWriteSites.push({ name: node.subExpression.name, range: node.range })
      }
    },
    ForStatement(node) {
      loops += 1
      gasSuggestions.push({
        title: 'Review loop execution cost',
        detail: 'A loop was found. Check its maximum iteration count and whether it performs repeated storage reads or writes. Compare changes with compiler gas reports and representative tests.',
        line: lineOf(node),
      })
    },
    WhileStatement(node) {
      loops += 1
      gasSuggestions.push({
        title: 'Review loop execution cost',
        detail: 'A loop was found. Check its termination conditions and whether it can exceed a practical transaction gas limit.',
        line: lineOf(node),
      })
    },
  })

  parser.visit(ast, {
    FunctionDefinition(node) {
      if (!node.body?.range || !node.range) return
      const contract = contractDefinitions.find((definition) =>
        definition.range[0] <= node.range[0] && definition.range[1] >= node.range[1])
      const localStateVariables = contractStateVariables.get(contract)
      if (!localStateVariables?.size) return

      const callsInFunction = externalCallSites.filter((site) =>
        site.range[0] >= node.body.range[0] && site.range[1] <= node.body.range[1])
      const writesInFunction = stateWriteSites.filter((site) =>
        localStateVariables.has(site.name) &&
        site.range[0] >= node.body.range[0] && site.range[1] <= node.body.range[1])

      for (const callSite of callsInFunction) {
        const laterWrite = writesInFunction.find((site) => site.range[0] > callSite.range[1])
        if (laterWrite) {
          findings.push(finding(
            `possible-reentrancy-${laterWrite.name}-${lineOf(callSite)}`,
            'High',
            'Potential reentrancy: state update follows an external call',
            'Review this external call and subsequent state writes together. Consider checks-effects-interactions or a reentrancy guard, then verify behavior with tests; this pattern alone does not prove exploitability.',
            lineOf(callSite),
          ))
          break
        }
      }
    },
  })

  if (!/^\s*\/\/\s*SPDX-License-Identifier:/m.test(source)) {
    findings.push(finding(
      'license',
      'Info',
      'SPDX license identifier is missing',
      'Add an SPDX-License-Identifier comment at the beginning of the file and select the license that actually applies to this source.',
      1,
      true,
    ))
    bestPractices.push({
      title: 'Add an SPDX license identifier',
      detail: 'No SPDX-License-Identifier comment was found. Select the correct license before adding one.',
      status: 'Needs review',
    })
  }

  if (!ast.children.some((node) => node.type === 'PragmaDirective' && node.name === 'solidity')) {
    bestPractices.push({
      title: 'Declare the Solidity compiler version',
      detail: 'No Solidity pragma was found. Declare the compiler versions the project supports and verify the build uses a compatible compiler.',
      status: 'Needs review',
    })
  }

  if (contracts > 0 && events === 0) {
    bestPractices.push({
      title: 'Review event coverage',
      detail: 'No event declarations were found. Decide whether important state changes should be observable to off-chain consumers.',
      status: 'Suggestion',
    })
  }

  if (stateVariables.size > 1) {
    gasSuggestions.push({
      title: 'Inspect compiler storage layout',
      detail: `${stateVariables.size} state variables were found. Inspect compiler storage-layout output to identify packing opportunities; this scan does not estimate savings.`,
      line: null,
    })
  }

  for (const item of findings) {
    if (item.severity === 'Info' || item.id === 'no-patterns' || item.id === 'license') continue
    bestPractices.push({
      title: `Review ${item.title.toLowerCase()}`,
      detail: item.recommendation,
      status: 'Finding',
    })
  }

  const uniqueFindings = [...new Map(findings.map((item) => [item.id, item])).values()]
  if (uniqueFindings.length === 0) {
    uniqueFindings.push(finding(
      'no-patterns',
      'Info',
      'No configured patterns detected',
      'The AST pattern checks did not identify a configured issue.',
      1,
    ))
  }

  return {
    findings: uniqueFindings,
    analysis: {
      gasSuggestions: [...new Map(gasSuggestions.map((item) => [`${item.title}-${item.line}`, item])).values()],
      bestPractices,
      metrics: { contracts, events, functions: countFunctions(ast), modifiers: countModifiers(ast), loops },
    },
    summary: `Parsed the Solidity source and checked ${uniqueFindings.length} configured pattern${uniqueFindings.length === 1 ? '' : 's'}.`,
  }
}

function countFunctions(ast) {
  let count = 0
  parser.visit(ast, { FunctionDefinition() { count += 1 } })
  return count
}

function countModifiers(ast) {
  let count = 0
  parser.visit(ast, { ModifierDefinition() { count += 1 } })
  return count
}
