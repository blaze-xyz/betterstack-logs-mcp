#!/usr/bin/env node
/**
 * Manual Test Runner Script - CLI for executing manual test cases
 */
import { parseArgs } from 'util'
import { 
  manualTestCases, 
  getAllTestCases, 
  getTestsByCategory, 
  getTestCase,
  testCategories,
  type ManualTestCase 
} from '../tests/manual/test-cases.js'
import { ManualTestRunner } from '../tests/manual/manual-test-runner.js'
import { ResultLogger } from '../tests/manual/result-logger.js'

interface CliOptions {
  category?: string
  test?: string
  list?: boolean
  verbose?: boolean
  output?: string
  help?: boolean
}

async function main(): Promise<void> {
  const options = parseCliArgs()
  
  if (options.help) {
    printHelp()
    return
  }
  
  if (options.list) {
    printAvailableTests()
    return
  }
  
  // Determine which tests to run
  const testsToRun = selectTests(options)
  
  if (testsToRun.length === 0) {
    console.error('❌ No tests selected. Use --list to see available tests.')
    process.exit(1)
  }
  
  console.log(`🔍 Selected ${testsToRun.length} test(s) for execution`)
  
  // Run the tests
  const runner = new ManualTestRunner()
  const summary = await runner.runMultipleTests(testsToRun)
  
  // Log results
  const logger = new ResultLogger({
    outputDir: options.output,
    includeResponseData: options.verbose,
    colorOutput: true
  })
  
  await logger.logResults(summary)
  
  // Exit with appropriate code
  process.exit(summary.failed > 0 ? 1 : 0)
}

function parseCliArgs(): CliOptions {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        category: {
          type: 'string',
          short: 'c',
          description: 'Run tests from specific category'
        },
        test: {
          type: 'string',
          short: 't',
          description: 'Run specific test by ID (e.g., "1.1" or category.test format)'
        },
        list: {
          type: 'boolean',
          short: 'l',
          description: 'List available tests and categories'
        },
        verbose: {
          type: 'boolean',
          short: 'v',
          description: 'Include detailed response data in logs'
        },
        output: {
          type: 'string',
          short: 'o',
          description: 'Output directory for test results'
        },
        help: {
          type: 'boolean',
          short: 'h',
          description: 'Show help message'
        }
      },
      allowPositionals: false
    })
    
    return values as CliOptions
  } catch (error) {
    console.error('❌ Invalid arguments:', error instanceof Error ? error.message : String(error))
    printHelp()
    process.exit(1)
  }
}

function selectTests(options: CliOptions): ManualTestCase[] {
  // If specific test is requested
  if (options.test) {
    // Try to find by ID first
    const testCaseById = getAllTestCases().find(tc => tc.id === options.test)
    if (testCaseById) {
      return [testCaseById]
    }
    
    // Try category.test format
    if (options.test.includes('.')) {
      const [categoryKey, testKey] = options.test.split('.')
      const testCase = getTestCase(categoryKey, testKey)
      if (testCase) {
        return [testCase]
      }
    }
    
    console.error(`❌ Test "${options.test}" not found`)
    return []
  }
  
  // If specific category is requested
  if (options.category) {
    const categoryTests = getTestsByCategory(options.category)
    if (categoryTests.length === 0) {
      console.error(`❌ Category "${options.category}" not found or empty`)
      console.log('Available categories:', testCategories.join(', '))
      return []
    }
    return categoryTests
  }
  
  // Default: run all tests
  return getAllTestCases()
}

function printHelp(): void {
  console.log(`
🧪 BetterStack Logs MCP - Manual Test Runner

USAGE:
  npm run test:manual [options]

OPTIONS:
  -c, --category <name>     Run tests from specific category
  -t, --test <id>          Run specific test (by ID or category.test format)
  -l, --list               List available tests and categories  
  -v, --verbose            Include detailed response data in logs
  -o, --output <dir>       Output directory for test results
  -h, --help               Show this help message

EXAMPLES:
  npm run test:manual                                    # Run all tests
  npm run test:manual -- --category json-field-extraction    # Run category
  npm run test:manual -- --test 1.1                          # Run specific test by ID
  npm run test:manual -- --test json-field-extraction.extract-default-alias  # Run by category.test
  npm run test:manual -- --list                              # List available tests
  npm run test:manual -- --verbose --output ./my-results     # Custom output with details

CATEGORIES:
  ${testCategories.map(cat => `• ${cat}`).join('\n  ')}
`)
}

function printAvailableTests(): void {
  console.log('📋 Available Manual Test Cases\n')
  
  for (const [categoryKey, category] of Object.entries(manualTestCases)) {
    const tests = Object.values(category)
    console.log(`📁 ${tests[0]?.category || categoryKey} (${tests.length} tests)`)
    console.log(`   Category Key: ${categoryKey}`)
    
    for (const [testKey, test] of Object.entries(category)) {
      console.log(`   • ${test.id}: ${test.description}`)
      console.log(`     Test Key: ${categoryKey}.${testKey}`)
    }
    console.log()
  }
  
  console.log(`Total: ${getAllTestCases().length} test cases across ${testCategories.length} categories`)
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
}