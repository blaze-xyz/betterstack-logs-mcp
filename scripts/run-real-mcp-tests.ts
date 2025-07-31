#!/usr/bin/env node

/**
 * Run manual tests against the real MCP server running on localhost:3000
 * 
 * Usage:
 *   npm run test:real-mcp                              # Run all tests
 *   npm run test:real-mcp -- --category source-management  # Run specific category
 *   npm run test:real-mcp -- --test 1.1               # Run specific test
 *   npm run test:real-mcp -- --list                   # List available tests
 */

import { RealMcpTestRunner } from '../tests/manual/real-mcp-test-runner.js'
import { 
  manualTestCases, 
  getAllTestCases, 
  getTestsByCategory, 
  getTestCaseById 
} from '../tests/manual/test-cases.js'

async function main() {
  const args = process.argv.slice(2)
  
  // Parse command line arguments
  const categoryIndex = args.indexOf('--category')
  const testIndex = args.indexOf('--test')
  const listIndex = args.indexOf('--list')
  
  if (listIndex !== -1) {
    console.log('\n📋 Available Test Categories and Tests:')
    console.log('=' .repeat(50))
    
    Object.entries(manualTestCases).forEach(([categoryKey, category]) => {
      const tests = Object.values(category)
      console.log(`\n🔸 ${categoryKey} (${tests.length} tests)`)
      tests.forEach(test => {
        console.log(`   ${test.id}: ${test.description}`)
      })
    })
    
    console.log('\n💡 Usage Examples:')
    console.log('   npm run test:real-mcp -- --category source-management')
    console.log('   npm run test:real-mcp -- --test 1.1')
    console.log('   npm run test:real-mcp')
    return
  }
  
  const runner = new RealMcpTestRunner()
  
  try {
    let testCases
    
    if (categoryIndex !== -1 && args[categoryIndex + 1]) {
      const category = args[categoryIndex + 1]
      testCases = getTestsByCategory(category)
      if (!testCases || testCases.length === 0) {
        console.error(`❌ Category '${category}' not found`)
        process.exit(1)
      }
      console.log(`🔍 Selected ${testCases.length} test(s) from category '${category}'`)
    } else if (testIndex !== -1 && args[testIndex + 1]) {
      const testId = args[testIndex + 1]
      const testCase = getTestCaseById(testId)
      if (!testCase) {
        console.error(`❌ Test '${testId}' not found`)
        process.exit(1)
      }
      testCases = [testCase]
      console.log(`🔍 Selected test '${testId}'`)
    } else {
      testCases = getAllTestCases()
      console.log(`🔍 Selected all ${testCases.length} test(s)`)
    }
    
    const summary = await runner.runMultipleTests(testCases)
    
    // Exit with non-zero code if any tests failed (useful for CI)
    if (summary.failed > 0) {
      process.exit(1)
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Test execution failed:', errorMessage)
    
    if (errorMessage.includes('MCP server not accessible')) {
      console.log('\n💡 To fix this:')
      console.log('   1. Open a terminal and run: npm run debug')
      console.log('   2. Wait for "Server listening on http://localhost:3000"')
      console.log('   3. In another terminal, run this test command again')
    }
    
    process.exit(1)
  }
}

main().catch(console.error)