/**
 * Real MCP Test Runner - Connects to actual MCP server on localhost:3000
 * This runner sends HTTP requests to the real server instead of using mocks
 */
import { ManualTestCase } from './test-cases.js'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

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

export class RealMcpTestRunner {
  private mcpServerUrl: string = 'http://localhost:3000/mcp'
  private sessionId: string = ''
  
  constructor() {
    // Session ID will be assigned by the server during initialization
    this.sessionId = ''
  }

  private async initializeSession(): Promise<void> {
    try {
      console.log(`🔄 Initializing MCP session...`)
      
      // Send initialize request WITHOUT a session ID - server will assign one
      const initPayload = {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: "manual-test-runner",
            version: "1.0.0"
          }
        },
        id: 0
      }
      
      const response = await axios.post(this.mcpServerUrl, initPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2024-11-05'
        },
        timeout: 10000
      })
      
      // Extract session ID from response headers
      const assignedSessionId = response.headers['mcp-session-id']
      if (assignedSessionId) {
        this.sessionId = assignedSessionId
        console.log('✅ MCP server assigned session ID:', this.sessionId)
      } else {
        console.log('⚠️ No session ID assigned by server')
      }
      
      // Send initialized notification with session ID if we have one
      const initializedPayload = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      }
      
      const notificationHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2024-11-05'
      }
      
      if (this.sessionId) {
        notificationHeaders['Mcp-Session-Id'] = this.sessionId
      }
      
      try {
        await axios.post(this.mcpServerUrl, initializedPayload, {
          headers: notificationHeaders,
          timeout: 5000
        })
        console.log('✅ Initialized notification sent successfully')
      } catch (notificationError: any) {
        console.log('⚠️ Failed to send initialized notification (continuing anyway):', notificationError.message)
        // Don't fail the whole initialization just for this
      }
      
    } catch (error: any) {
      if (error.response?.data?.error?.message?.includes('already initialized')) {
        console.error('❌ Server already initialized. Please restart the MCP server with "npm run debug" and try again.')
        console.error('   Stop the current server (Ctrl+C) and run: npm run debug')
        throw new Error('Server already initialized - restart required')
      }
      
      console.error('❌ Failed to initialize MCP server:', error instanceof Error ? error.message : error)
      if (error.response?.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2))
      }
      throw error
    }
  }

  async runTest(testCase: ManualTestCase): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      // Session should already be initialized by runMultipleTests
      
      // Check if we have a JSON-RPC payload, otherwise create one
      const jsonRpcPayload = testCase.jsonRpcPayload || {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: testCase.payload.name,
          arguments: testCase.payload.arguments
        },
        id: Date.now()
      }
      
      // Log the payload for debugging
      this.logMcpPayload(testCase, jsonRpcPayload)
      
      // Make HTTP request to real MCP server
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2024-11-05'
      }
      
      // Include session ID if we have one
      if (this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId
      }
      
      const response = await axios.post(this.mcpServerUrl, jsonRpcPayload, {
        headers,
        timeout: 30000
      })
      
      const executionTime = Date.now() - startTime
      
      // Log the response
      this.logMcpResponse(testCase, response.data)
      
      // Validate the response
      const validation = this.validateResponse(response.data, testCase)
      const success = this.isTestSuccessful(response.data, validation)
      
      return {
        testCase,
        success,
        executionTime,
        response: response.data,
        validation
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      // Log the error
      this.logMcpError(testCase, error)
      
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
    
    console.log(`\n🚀 Starting real MCP server tests (${testCases.length} tests)...`)
    console.log(`📡 Connecting to MCP server at: ${this.mcpServerUrl}`)
    console.log(`🆔 Initializing session: ${this.sessionId}\n`)
    
    // Initialize session once for all tests
    try {
      await this.initializeSession()
    } catch (error) {
      console.error('❌ Failed to initialize session, aborting tests')
      throw error
    }
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      console.log(`[${i + 1}/${testCases.length}] Running ${testCase.id}: ${testCase.description}`)
      
      const result = await this.runTest(testCase)
      results.push(result)
      
      const status = result.success ? '✅ PASS' : '❌ FAIL'
      console.log(`  ${status} (${result.executionTime}ms)`)
      
      // Small delay between tests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    const endTime = new Date()
    const executionTime = endTime.getTime() - startTime.getTime()
    const passed = results.filter(r => r.success).length
    const failed = results.length - passed
    
    const summary: TestRunSummary = {
      totalTests: testCases.length,
      passed,
      failed,
      executionTime,
      results,
      startTime,
      endTime
    }
    
    this.printSummary(summary)
    this.saveSummaryLogs(summary)
    
    return summary
  }

  private validateResponse(response: any, testCase: ManualTestCase): TestResult['validation'] {
    const validation: TestResult['validation'] = {
      containsChecks: []
    }
    
    // Get the response text content
    let responseText = ''
    if (response.result?.content?.[0]?.text) {
      responseText = response.result.content[0].text
    } else if (response.content?.[0]?.text) {
      responseText = response.content[0].text
    } else if (typeof response === 'string') {
      responseText = response
    } else {
      responseText = JSON.stringify(response)
    }
    
    // Check shouldContain items
    if (testCase.expected.shouldContain) {
      validation.containsChecks = testCase.expected.shouldContain.map(text => ({
        text,
        found: responseText.includes(text)
      }))
    }
    
    // Check format if specified
    if (testCase.expected.format) {
      const detectedFormat = this.detectResponseFormat(responseText)
      validation.formatCheck = {
        expected: testCase.expected.format,
        actual: detectedFormat,
        matches: detectedFormat === testCase.expected.format
      }
    }
    
    // Check result count if specified
    if (testCase.expected.resultCount !== undefined) {
      const actualCount = this.extractResultCount(responseText)
      let matches = true
      
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
    if (response.error || (response.result && response.result.isError)) {
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
    if (responseText.includes('Query Results') && responseText.includes('**')) {
      return 'JSONEachRow'
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
    // Try to find explicit count mentions
    const countPatterns = [
      /(\d+)\s+results?/i,
      /found\s+(\d+)/i,
      /total[:\s]+(\d+)/i
    ]
    
    for (const pattern of countPatterns) {
      const match = responseText.match(pattern)
      if (match) {
        return parseInt(match[1], 10)
      }
    }
    
    // Count lines that look like results
    const lines = responseText.split('\n')
    const resultLines = lines.filter(line => 
      line.includes('dt:') || 
      line.includes('raw:') || 
      line.includes('level:')
    ).length
    
    return resultLines
  }

  private logMcpPayload(testCase: ManualTestCase, jsonRpcPayload: any): void {
    try {
      const logsDir = path.join(process.cwd(), 'dist', 'logs', 'manual-tests')
      fs.mkdirSync(logsDir, { recursive: true })
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
      const payloadLogPath = path.join(logsDir, `${timestamp}_real_mcp_payloads.log`)
      
      const logLine = `\n${'='.repeat(80)}\n` +
                     `[REQUEST] ${testCase.id}: ${testCase.description}\n` +
                     `${'='.repeat(80)}\n` +
                     `MCP Server URL: ${this.mcpServerUrl}\n` +
                     `JSON-RPC Payload:\n${JSON.stringify(jsonRpcPayload, null, 2)}\n\n` +
                     `Postman Configuration:\n${JSON.stringify({
                       method: 'POST',
                       url: this.mcpServerUrl,
                       headers: { 
                         'Content-Type': 'application/json',
                         'Accept': 'application/json, text/event-stream',
                         'Mcp-Session-Id': this.sessionId
                       },
                       body: jsonRpcPayload
                     }, null, 2)}\n`
      
      fs.appendFileSync(payloadLogPath, logLine)
    } catch (error) {
      console.warn('Failed to log MCP payload:', error)
    }
  }

  private logMcpResponse(testCase: ManualTestCase, response: any): void {
    try {
      const logsDir = path.join(process.cwd(), 'dist', 'logs', 'manual-tests')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
      const payloadLogPath = path.join(logsDir, `${timestamp}_real_mcp_payloads.log`)
      
      const logLine = `${'='.repeat(80)}\n` +
                     `[RESPONSE] ${testCase.id}: ${testCase.description}\n` +
                     `${'='.repeat(80)}\n` +
                     `HTTP Response:\n${JSON.stringify(response, null, 2)}\n\n` +
                     `Response Content:\n${response?.result?.content?.[0]?.text || response?.content?.[0]?.text || 'No text content'}\n\n`
      
      fs.appendFileSync(payloadLogPath, logLine)
    } catch (error) {
      console.warn('Failed to log MCP response:', error)
    }
  }

  private logMcpError(testCase: ManualTestCase, error: any): void {
    try {
      const logsDir = path.join(process.cwd(), 'dist', 'logs', 'manual-tests')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
      const payloadLogPath = path.join(logsDir, `${timestamp}_real_mcp_payloads.log`)
      
      const logLine = `${'='.repeat(80)}\n` +
                     `[ERROR] ${testCase.id}: ${testCase.description}\n` +
                     `${'='.repeat(80)}\n` +
                     `Error: ${error.message}\n` +
                     `HTTP Status: ${error.response?.status}\n` +
                     `Response Data: ${JSON.stringify(error.response?.data, null, 2)}\n\n`
      
      fs.appendFileSync(payloadLogPath, logLine)
    } catch (logError) {
      console.warn('Failed to log MCP error:', logError)
    }
  }

  private printSummary(summary: TestRunSummary): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 REAL MCP SERVER TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Server URL: ${this.mcpServerUrl}`)
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

  private saveSummaryLogs(summary: TestRunSummary): void {
    try {
      const logsDir = path.join(process.cwd(), 'dist', 'logs', 'manual-tests')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
      
      // Save detailed log
      const logPath = path.join(logsDir, `${timestamp}_real_mcp_detailed.log`)
      let logContent = `Real MCP Server Test Execution Log\n`
      logContent += `================================================================================\n`
      logContent += `Server URL: ${this.mcpServerUrl}\n`
      logContent += `Execution Time: ${summary.startTime.toISOString()}\n`
      logContent += `Total Tests: ${summary.totalTests}\n`
      logContent += `Passed: ${summary.passed}\n`
      logContent += `Failed: ${summary.failed}\n`
      logContent += `Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%\n`
      logContent += `Total Duration: ${(summary.executionTime / 1000).toFixed(2)}s\n\n\n`
      
      for (const result of summary.results) {
        const status = result.success ? 'PASS' : 'FAIL'
        logContent += `[${status}] ${result.testCase.id}: ${result.testCase.description}\n`
        logContent += `  Execution Time: ${result.executionTime}ms\n`
        
        if (result.validation) {
          logContent += `  Validation Results:\n`
          if (result.validation.containsChecks) {
            logContent += `    Text Validation:\n`
            result.validation.containsChecks.forEach(check => {
              logContent += `      - "${check.text}": ${check.found ? 'FOUND' : 'MISSING'}\n`
            })
          }
          if (result.validation.resultCountCheck) {
            const rc = result.validation.resultCountCheck
            logContent += `    Result Count: Expected ${JSON.stringify(rc.expected)}, Got ${rc.actual} - ${rc.matches ? 'PASS' : 'FAIL'}\n`
          }
        }
        
        if (result.error) {
          logContent += `  Error: ${result.error}\n`
        }
        
        logContent += `  Notes: ${result.testCase.expected.notes || 'N/A'}\n\n`
      }
      
      fs.writeFileSync(logPath, logContent)
      
      console.log(`\n📝 Test results logged to: ${logsDir}`)
      console.log(`   • Real MCP detailed log: ${timestamp}_real_mcp_detailed.log`)
      console.log(`   • Real MCP payloads log: ${timestamp}_real_mcp_payloads.log`)
      
    } catch (error) {
      console.warn('Failed to save summary logs:', error)
    }
  }
}