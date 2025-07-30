/**
 * Result Logger - Generate structured, reviewable log files for manual test results
 */
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { TestRunSummary, TestResult } from './manual-test-runner.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface LoggerOptions {
  outputDir?: string
  includeResponseData?: boolean
  colorOutput?: boolean
}

export class ResultLogger {
  private outputDir: string
  private timestamp: string
  
  constructor(private options: LoggerOptions = {}) {
    this.outputDir = options.outputDir || join(__dirname, '../../logs/manual-tests')
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  }

  async logResults(summary: TestRunSummary): Promise<void> {
    // Ensure output directory exists
    await mkdir(this.outputDir, { recursive: true })
    
    // Generate multiple output formats
    await Promise.all([
      this.writeDetailedLog(summary),
      this.writeSummaryJson(summary),
      this.writeReviewChecklist(summary),
      this.writeJunitXml(summary)
    ])
    
    console.log(`\n📝 Test results logged to: ${this.outputDir}`)
    console.log(`   • Detailed log: ${this.timestamp}_detailed.log`)
    console.log(`   • Summary JSON: ${this.timestamp}_summary.json`)
    console.log(`   • Review checklist: ${this.timestamp}_review.md`)
    console.log(`   • JUnit XML: ${this.timestamp}_junit.xml`)
  }

  private async writeDetailedLog(summary: TestRunSummary): Promise<void> {
    const filename = join(this.outputDir, `${this.timestamp}_detailed.log`)
    
    let content = ''
    content += `BetterStack Logs MCP - Manual Test Execution Log\n`
    content += `${'='.repeat(80)}\n`
    content += `Execution Time: ${summary.startTime.toISOString()}\n`
    content += `Total Tests: ${summary.totalTests}\n`
    content += `Passed: ${summary.passed}\n`
    content += `Failed: ${summary.failed}\n`
    content += `Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%\n`
    content += `Total Duration: ${(summary.executionTime / 1000).toFixed(2)}s\n`
    content += `\n`
    
    // Group results by category
    const resultsByCategory = this.groupResultsByCategory(summary.results)
    
    for (const [category, results] of Object.entries(resultsByCategory)) {
      content += `\n${category}\n`
      content += `${'-'.repeat(category.length)}\n`
      
      for (const result of results) {
        content += `\n[${result.success ? 'PASS' : 'FAIL'}] ${result.testCase.id}: ${result.testCase.description}\n`
        content += `  Execution Time: ${result.executionTime}ms\n`
        
        if (result.error) {
          content += `  Error: ${result.error}\n`
        }
        
        if (result.validation) {
          content += `  Validation Results:\n`
          
          // Contains checks
          if (result.validation.containsChecks && result.validation.containsChecks.length > 0) {
            content += `    Text Validation:\n`
            for (const check of result.validation.containsChecks) {
              content += `      - "${check.text}": ${check.found ? 'FOUND' : 'MISSING'}\n`
            }
          }
          
          // Format check
          if (result.validation.formatCheck) {
            const fc = result.validation.formatCheck
            content += `    Format Check: Expected "${fc.expected}", Got "${fc.actual}" - ${fc.matches ? 'PASS' : 'FAIL'}\n`
          }
          
          // Result count check
          if (result.validation.resultCountCheck) {
            const rc = result.validation.resultCountCheck
            content += `    Result Count: Expected ${JSON.stringify(rc.expected)}, Got ${rc.actual} - ${rc.matches ? 'PASS' : 'FAIL'}\n`
          }
        }
        
        // Include response data if requested and not too large
        if (this.options.includeResponseData && result.response && !result.error) {
          const responseText = result.response.content?.[0]?.text || 'No response text'
          if (responseText.length < 1000) {
            content += `  Response Preview:\n`
            content += responseText.split('\n').map((line: string) => `    ${line}`).join('\n') + '\n'
          } else {
            content += `  Response: ${responseText.length} characters (truncated for brevity)\n`
          }
        }
        
        if (result.testCase.expected.notes) {
          content += `  Notes: ${result.testCase.expected.notes}\n`
        }
      }
    }
    
    await writeFile(filename, content, 'utf-8')
  }

  private async writeSummaryJson(summary: TestRunSummary): Promise<void> {
    const filename = join(this.outputDir, `${this.timestamp}_summary.json`)
    
    const jsonSummary = {
      metadata: {
        timestamp: summary.startTime.toISOString(),
        executionTime: summary.executionTime,
        totalTests: summary.totalTests,
        passed: summary.passed,
        failed: summary.failed,
        successRate: (summary.passed / summary.totalTests) * 100
      },
      results: summary.results.map(result => ({
        testId: result.testCase.id,
        testDescription: result.testCase.description,
        category: result.testCase.category,
        success: result.success,
        executionTime: result.executionTime,
        error: result.error,
        validation: result.validation,
        payload: result.testCase.payload,
        expected: result.testCase.expected
      }))
    }
    
    await writeFile(filename, JSON.stringify(jsonSummary, null, 2), 'utf-8')
  }

  private async writeReviewChecklist(summary: TestRunSummary): Promise<void> {
    const filename = join(this.outputDir, `${this.timestamp}_review.md`)
    
    let content = ''
    content += `# Manual Test Review Checklist\n\n`
    content += `**Generated:** ${summary.startTime.toISOString()}\n`
    content += `**Success Rate:** ${((summary.passed / summary.totalTests) * 100).toFixed(1)}% (${summary.passed}/${summary.totalTests})\n\n`
    
    if (summary.failed > 0) {
      content += `## ⚠️ Tests Requiring Attention\n\n`
      const failedResults = summary.results.filter(r => !r.success)
      
      for (const result of failedResults) {
        content += `### ${result.testCase.id}: ${result.testCase.description}\n`
        content += `**Category:** ${result.testCase.category}\n`
        content += `**Status:** ❌ FAILED\n`
        
        if (result.error) {
          content += `**Error:** ${result.error}\n`
        }
        
        if (result.validation?.containsChecks) {
          const missing = result.validation.containsChecks.filter(c => !c.found)
          if (missing.length > 0) {
            content += `**Missing Expected Content:** ${missing.map(c => `"${c.text}"`).join(', ')}\n`
          }
        }
        
        content += `**Action Required:** Review and validate manually\n\n`
      }
    }
    
    content += `## ✅ Passed Tests Summary\n\n`
    const passedResults = summary.results.filter(r => r.success)
    const passedByCategory = this.groupResultsByCategory(passedResults)
    
    for (const [category, results] of Object.entries(passedByCategory)) {
      content += `- **${category}:** ${results.length} tests passed\n`
    }
    
    content += `\n## 📋 Manual Verification Checklist\n\n`
    content += `- [ ] Review failed tests and investigate root causes\n`
    content += `- [ ] Verify that passed tests produce expected output formats\n`
    content += `- [ ] Check that error messages are clear and helpful\n`
    content += `- [ ] Validate time range filtering produces logical results\n`
    content += `- [ ] Confirm JSON field extraction works for nested paths\n`
    content += `- [ ] Ensure combined filters work together as expected\n`
    content += `- [ ] Test response times are reasonable (< 5 seconds per test)\n`
    content += `- [ ] Verify limit parameters are respected\n`
    content += `- [ ] Check that no sensitive data is exposed in logs\n\n`
    
    content += `## 📊 Performance Metrics\n\n`
    content += `- **Total Execution Time:** ${(summary.executionTime / 1000).toFixed(2)}s\n`
    content += `- **Average Test Time:** ${(summary.executionTime / summary.totalTests).toFixed(0)}ms\n`
    const slowTests = summary.results.filter(r => r.executionTime > 1000).length
    content += `- **Slow Tests (>1s):** ${slowTests}\n`
    
    if (slowTests > 0) {
      content += `\n### Slow Tests to Investigate:\n`
      summary.results
        .filter(r => r.executionTime > 1000)
        .sort((a, b) => b.executionTime - a.executionTime)
        .forEach(result => {
          content += `- ${result.testCase.id}: ${result.executionTime}ms\n`
        })
    }
    
    content += `\n---\n`
    content += `*This checklist was automatically generated. Review and update as needed.*\n`
    
    await writeFile(filename, content, 'utf-8')
  }

  private async writeJunitXml(summary: TestRunSummary): Promise<void> {
    const filename = join(this.outputDir, `${this.timestamp}_junit.xml`)
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += `<testsuites tests="${summary.totalTests}" failures="${summary.failed}" time="${(summary.executionTime / 1000).toFixed(3)}">\n`
    
    const resultsByCategory = this.groupResultsByCategory(summary.results)
    
    for (const [category, results] of Object.entries(resultsByCategory)) {
      const categoryFailed = results.filter(r => !r.success).length
      const categoryTime = results.reduce((sum, r) => sum + r.executionTime, 0) / 1000
      
      xml += `  <testsuite name="${this.escapeXml(category)}" tests="${results.length}" failures="${categoryFailed}" time="${categoryTime.toFixed(3)}">\n`
      
      for (const result of results) {
        xml += `    <testcase classname="${this.escapeXml(category)}" name="${this.escapeXml(result.testCase.description)}" time="${(result.executionTime / 1000).toFixed(3)}">\n`
        
        if (!result.success) {
          xml += `      <failure message="${this.escapeXml(result.error || 'Test validation failed')}">\n`
          xml += `        <![CDATA[\n`
          xml += `Test ID: ${result.testCase.id}\n`
          xml += `Description: ${result.testCase.description}\n`
          if (result.error) {
            xml += `Error: ${result.error}\n`
          }
          if (result.validation?.containsChecks) {
            const missing = result.validation.containsChecks.filter(c => !c.found)
            if (missing.length > 0) {
              xml += `Missing expected content: ${missing.map(c => c.text).join(', ')}\n`
            }
          }
          xml += `        ]]>\n`
          xml += `      </failure>\n`
        }
        
        xml += `    </testcase>\n`
      }
      
      xml += `  </testsuite>\n`
    }
    
    xml += '</testsuites>\n'
    
    await writeFile(filename, xml, 'utf-8')
  }

  private groupResultsByCategory(results: TestResult[]): Record<string, TestResult[]> {
    const grouped: Record<string, TestResult[]> = {}
    
    for (const result of results) {
      const category = result.testCase.category
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(result)
    }
    
    return grouped
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}