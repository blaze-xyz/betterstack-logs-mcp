/**
 * Manual Test Runner - Core execution engine for running manual test cases
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpTestHelper } from '../helpers/mcp-test-helper.js'
import { createTestServer } from '../helpers/test-server-factory.js'
import { ManualTestCase } from './test-cases.js'

// Will use dynamic imports for MSW to avoid TypeScript issues

export interface TestResult {
  testCase: ManualTestCase
  success: boolean
  executionTime: number
  response?: any
  error?: string
  validation?: {
    containsChecks: { text: string; found: boolean }[]
    formatCheck?: { expected: string; actual: string; matches: boolean }
    resultCountCheck?: { expected: any; actual: number; matches: boolean }
  }
}

export interface TestRunSummary {
  totalTests: number
  passed: number
  failed: number
  executionTime: number
  results: TestResult[]
  startTime: Date
  endTime: Date
}

export class ManualTestRunner {
  private server: McpServer
  private mcpHelper: McpTestHelper
  private isSetup: boolean = false
  private mswServer: any = null
  
  constructor() {
    const testServer = createTestServer()
    this.server = testServer.server
    this.mcpHelper = new McpTestHelper(this.server)
  }

  private async ensureSetup(): Promise<void> {
    if (!this.isSetup) {
      // Dynamic import to avoid TypeScript compilation issues
      const { setupServer } = await import('msw/node')
      const { http, HttpResponse } = await import('msw')
      
      // Setup MSW server directly
      this.mswServer = setupServer(
        http.get('https://telemetry.betterstack.com/api/v1/sources', () => {
          return HttpResponse.json({ 
            data: [
              {
                id: '1386515',
                type: 'source',
                attributes: {
                  team_id: 298009,
                  team_name: 'Test Team',
                  name: 'Test Source',
                  source_group_id: 1,
                  table_name: 't298009_test_logs',
                  platform: 'ubuntu',
                  token: 'test-token-123',
                  ingesting_host: 'logs.betterstack.com',
                  ingesting_paused: false,
                  logs_retention: 7,
                  metrics_retention: 30,
                  created_at: '2024-01-01T10:00:00Z',
                  updated_at: '2024-01-15T10:00:00Z'
                }
              }
            ],
            pagination: {
              page: 1,
              per_page: 50,
              total_pages: 1,
              total_count: 1
            }
          })
        }),
        http.post('https://clickhouse.betterstack.com/', () => {
          return HttpResponse.json({ data: [] })
        })
      )
      
      this.mswServer.listen({ onUnhandledRequest: 'error' })
      ;(globalThis as any).__MSW_SERVER__ = this.mswServer
      this.isSetup = true
    }
  }

  async runTest(testCase: ManualTestCase): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      // Ensure test environment is set up
      await this.ensureSetup()
      
      // Setup mock data for this test case
      await this.setupMockData(testCase)
      
      // Execute the test
      const response = await this.mcpHelper.callTool(
        testCase.payload.name,
        testCase.payload.arguments
      )
      
      const executionTime = Date.now() - startTime
      
      // Validate the response
      const validation = this.validateResponse(response, testCase)
      const success = this.isTestSuccessful(response, validation)
      
      return {
        testCase,
        success,
        executionTime,
        response,
        validation
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      return {
        testCase,
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async runMultipleTests(testCases: ManualTestCase[]): Promise<TestRunSummary> {
    const startTime = new Date()
    const results: TestResult[] = []
    
    // Ensure test environment is set up once
    await this.ensureSetup()
    
    console.log(`\n🚀 Starting manual test execution (${testCases.length} tests)...\n`)
    
    for (const [index, testCase] of testCases.entries()) {
      console.log(`[${index + 1}/${testCases.length}] Running ${testCase.id}: ${testCase.description}`)
      
      const result = await this.runTest(testCase)
      results.push(result)
      
      // Log immediate result
      if (result.success) {
        console.log(`  ✅ PASS (${result.executionTime}ms)`)
      } else {
        console.log(`  ❌ FAIL (${result.executionTime}ms)`)
        if (result.error) {
          console.log(`     Error: ${result.error}`)
        }
      }
    }
    
    const endTime = new Date()
    const totalExecutionTime = endTime.getTime() - startTime.getTime()
    
    const summary: TestRunSummary = {
      totalTests: testCases.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      executionTime: totalExecutionTime,
      results,
      startTime,
      endTime
    }
    
    this.printSummary(summary)
    
    // Cleanup test environment
    this.cleanup()
    
    return summary
  }

  cleanup(): void {
    if (this.isSetup && this.mswServer) {
      this.mswServer.close()
      delete (globalThis as any).__MSW_SERVER__
      this.isSetup = false
      this.mswServer = null
    }
  }

  private async setupMockData(testCase: ManualTestCase): Promise<void> {
    if (!testCase.mockData || testCase.mockData.length === 0) {
      // Provide default mock data
      testCase.mockData = [
        { dt: '2024-01-01T10:00:00Z', raw: 'Default test log entry', level: 'INFO' }
      ]
    }

    // Setup MSW mock for ClickHouse API
    const { http, HttpResponse } = await import('msw')
    
    ;(globalThis as any).__MSW_SERVER__.use(
      http.post('https://clickhouse.betterstack.com/', async ({ request }: any) => {
        const query = await request.text()
        
        // Handle table description queries
        if (query.includes('DESCRIBE TABLE remote(')) {
          return HttpResponse.json({
            data: [
              ['dt', 'DateTime', '', '', '', '', ''],
              ['raw', 'String', '', '', '', '', ''],
              ['level', 'String', '', '', '', '', ''],
              ['json', 'String', '', '', '', '', ''],
              ['source', 'String', '', '', '', '', '']
            ]
          })
        }
        
        // Return the mock data for the test case
        return HttpResponse.json({ data: testCase.mockData })
      })
    )
  }

  private validateResponse(response: any, testCase: ManualTestCase): TestResult['validation'] {
    const validation: TestResult['validation'] = {
      containsChecks: []
    }
    
    // Check if response has proper MCP format
    if (!response || !response.content || !Array.isArray(response.content)) {
      return validation
    }
    
    const responseText = response.content.map((c: any) => c.text || '').join(' ')
    
    // Validate shouldContain checks
    if (testCase.expected.shouldContain) {
      validation.containsChecks = testCase.expected.shouldContain.map(text => ({
        text,
        found: responseText.toLowerCase().includes(text.toLowerCase())
      }))
    }
    
    // Validate format if specified
    if (testCase.expected.format) {
      validation.formatCheck = {
        expected: testCase.expected.format,
        actual: this.detectResponseFormat(responseText),
        matches: false
      }
      validation.formatCheck.matches = 
        validation.formatCheck.expected === validation.formatCheck.actual
    }
    
    // Validate result count if specified
    if (testCase.expected.resultCount) {
      const actualCount = this.extractResultCount(responseText)
      let matches = false
      
      if (typeof testCase.expected.resultCount === 'number') {
        matches = actualCount === testCase.expected.resultCount
      } else {
        const { min, max } = testCase.expected.resultCount
        matches = (min === undefined || actualCount >= min) && 
                 (max === undefined || actualCount <= max)
      }
      
      validation.resultCountCheck = {
        expected: testCase.expected.resultCount,
        actual: actualCount,
        matches
      }
    }
    
    return validation
  }

  private isTestSuccessful(response: any, validation: TestResult['validation']): boolean {
    // Check if response indicates an error
    if (response.isError) {
      return false
    }
    
    // Check if all shouldContain checks passed
    const containsChecksPassed = validation?.containsChecks?.every(check => check.found) ?? true
    
    // Check if format check passed (if specified)
    const formatCheckPassed = validation?.formatCheck?.matches ?? true
    
    // Check if result count check passed (if specified)
    const resultCountCheckPassed = validation?.resultCountCheck?.matches ?? true
    
    return containsChecksPassed && formatCheckPassed && resultCountCheckPassed
  }

  private detectResponseFormat(responseText: string): string {
    // Simple format detection based on response content
    if (responseText.includes('Query Results') && responseText.includes('**')) {
      return 'JSONEachRow' // Default format with markdown formatting
    }
    if (responseText.includes(',') && responseText.includes('\n')) {
      return 'CSV'
    }
    if (responseText.includes('\t') && responseText.includes('\n')) {
      return 'TSV'
    }
    if (responseText.includes('│') && responseText.includes('─')) {
      return 'Pretty'
    }
    return 'Unknown'
  }

  private extractResultCount(responseText: string): number {
    // Try to extract result count from response text
    const patterns = [
      /(\d+) rows? returned/i,
      /showing (\d+) results?/i,
      /found (\d+) entries?/i,
      /and (\d+) more rows/i
    ]
    
    for (const pattern of patterns) {
      const match = responseText.match(pattern)
      if (match) {
        return parseInt(match[1], 10)
      }
    }
    
    // If no explicit count found, try to count lines that look like results
    const lines = responseText.split('\n')
    const resultLines = lines.filter(line => 
      line.includes('dt:') || 
      line.includes('raw:') || 
      line.includes('level:')
    ).length
    
    return resultLines
  }

  private printSummary(summary: TestRunSummary): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 MANUAL TEST EXECUTION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Tests: ${summary.totalTests}`)
    console.log(`Passed: ${summary.passed} ✅`)
    console.log(`Failed: ${summary.failed} ❌`)
    console.log(`Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`)
    console.log(`Total Execution Time: ${(summary.executionTime / 1000).toFixed(2)}s`)
    console.log(`Average Test Time: ${(summary.executionTime / summary.totalTests).toFixed(0)}ms`)
    
    if (summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:')
      summary.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`  • ${result.testCase.id}: ${result.testCase.description}`)
          if (result.error) {
            console.log(`    Error: ${result.error}`)
          }
          if (result.validation?.containsChecks) {
            const failedChecks = result.validation.containsChecks.filter(c => !c.found)
            if (failedChecks.length > 0) {
              console.log(`    Missing: ${failedChecks.map(c => c.text).join(', ')}`)
            }
          }
        })
    }
    
    console.log('='.repeat(60))
  }
}