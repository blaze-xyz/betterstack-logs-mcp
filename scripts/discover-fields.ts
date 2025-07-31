#!/usr/bin/env tsx

/**
 * Field Discovery Script for BetterStack Logs MCP
 * 
 * This script analyzes all sources in the BetterStack instance to discover
 * what fields are actually available for querying across different data types.
 */

import { BetterstackClient } from '../src/betterstack-client.js';
import { DataSourceType } from '../src/types.js';
import { loadConfig } from '../src/config.js';
import fs from 'fs';
import path from 'path';

interface FieldAnalysis {
  sourceName: string;
  sourceId: string;
  platform: string;
  dataTypes: {
    [key in DataSourceType]?: {
      available: boolean;
      tableName?: string;
      fields?: string[];
      sampleData?: any[];
      error?: string;
    }
  };
}

interface FieldSummary {
  fieldName: string;
  availability: {
    sources: number;
    dataTypes: DataSourceType[];
    platforms: string[];
  };
  examples: any[];
}

async function discoverFields() {
  console.log('🔍 Starting BetterStack field discovery...\n');
  
  // Initialize client using the same config as the MCP server
  const config = loadConfig();
  const client = new BetterstackClient({
    apiToken: config.apiToken,
    telemetryEndpoint: config.telemetryEndpoint,
    clickhouseEndpoint: config.clickhouseQueryEndpoint,
    clickhouseUsername: config.clickhouseUsername,
    clickhousePassword: config.clickhousePassword
  });

  let analysis: FieldAnalysis[] = [];
  let allFields = new Map<string, FieldSummary>();

  try {
    // Get all sources
    console.log('📋 Fetching all sources...');
    const sources = await client.listSources();
    console.log(`Found ${sources.length} sources\n`);

    // Analyze each source
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      console.log(`🔎 Analyzing source ${i + 1}/${sources.length}: ${source.name} (${source.platform})`);
      
      const sourceAnalysis: FieldAnalysis = {
        sourceName: source.name,
        sourceId: source.id,
        platform: source.platform,
        dataTypes: {}
      };

      // Test each data type
      const dataTypes: DataSourceType[] = ['recent', 'historical', 'metrics'];
      
      for (const dataType of dataTypes) {
        console.log(`  📊 Testing ${dataType} data...`);
        
        try {
          // Get schema information
          const sourcesWithSchema = await client.getSourcesWithSchema([source], dataType);
          const sourceWithSchema = sourcesWithSchema[0];
          
          if (sourceWithSchema && sourceWithSchema.schema) {
            sourceAnalysis.dataTypes[dataType] = {
              available: true,
              tableName: sourceWithSchema.tableName,
              fields: sourceWithSchema.schema.availableFields
            };

            // Try to get sample data to understand field types/content
            try {
              const sampleQuery = `SELECT * FROM remote('${sourceWithSchema.tableName}') LIMIT 3`;
              const result = await client.executeQuery(sampleQuery, {
                sources: [source.id],
                dataType,
                limit: 3
              });
              
              sourceAnalysis.dataTypes[dataType]!.sampleData = result.data;
              
              // Track all unique fields
              if (result.data.length > 0) {
                const sampleRow = result.data[0];
                if (typeof sampleRow === 'object' && sampleRow !== null) {
                  Object.keys(sampleRow).forEach(fieldName => {
                    if (!allFields.has(fieldName)) {
                      allFields.set(fieldName, {
                        fieldName,
                        availability: {
                          sources: 0,
                          dataTypes: [],
                          platforms: []
                        },
                        examples: []
                      });
                    }
                    
                    const fieldSummary = allFields.get(fieldName)!;
                    fieldSummary.availability.sources++;
                    
                    if (!fieldSummary.availability.dataTypes.includes(dataType)) {
                      fieldSummary.availability.dataTypes.push(dataType);
                    }
                    
                    if (!fieldSummary.availability.platforms.includes(source.platform)) {
                      fieldSummary.availability.platforms.push(source.platform);
                    }
                    
                    // Store example values (limit to avoid too much data)
                    const value = (sampleRow as any)[fieldName];
                    if (fieldSummary.examples.length < 5 && 
                        !fieldSummary.examples.some(ex => JSON.stringify(ex.value) === JSON.stringify(value))) {
                      fieldSummary.examples.push({
                        value,
                        source: source.name,
                        platform: source.platform,
                        dataType
                      });
                    }
                  });
                }
              }
              
              console.log(`    ✅ ${sourceWithSchema.schema.availableFields.length} fields, ${result.data.length} sample rows`);
            } catch (sampleError) {
              console.log(`    ⚠️  Schema available but sample query failed: ${sampleError instanceof Error ? sampleError.message : sampleError}`);
            }
          } else {
            sourceAnalysis.dataTypes[dataType] = {
              available: false,
              error: 'No schema available'
            };
            console.log(`    ❌ No schema available`);
          }
        } catch (error) {
          sourceAnalysis.dataTypes[dataType] = {
            available: false,
            error: error instanceof Error ? error.message : String(error)
          };
          console.log(`    ❌ Error: ${error instanceof Error ? error.message : error}`);
        }
      }
      
      analysis.push(sourceAnalysis);
      console.log(); // Empty line for readability
    }

    // Generate comprehensive report
    const report = generateReport(analysis, allFields);
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'field-discovery-report.md');
    fs.writeFileSync(outputPath, report);
    
    console.log(`📄 Field discovery report saved to: ${outputPath}`);
    console.log('\n🎉 Field discovery completed!');
    
  } catch (error) {
    console.error('❌ Field discovery failed:', error);
    process.exit(1);
  }
}

function generateReport(analysis: FieldAnalysis[], allFields: Map<string, FieldSummary>): string {
  const lines: string[] = [];
  
  lines.push('# BetterStack Fields Discovery Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- **Total Sources Analyzed**: ${analysis.length}`);
  lines.push(`- **Unique Fields Found**: ${allFields.size}`);
  lines.push(`- **Platforms Covered**: ${[...new Set(analysis.map(a => a.platform))].join(', ')}`);
  lines.push('');
  
  // Field Summary Table
  lines.push('## Field Availability Summary');
  lines.push('');
  lines.push('| Field Name | Sources | Data Types | Platforms | Example Values |');
  lines.push('|------------|---------|------------|-----------|----------------|');
  
  const sortedFields = Array.from(allFields.values()).sort((a, b) => b.availability.sources - a.availability.sources);
  
  for (const field of sortedFields) {
    const exampleValues = field.examples.slice(0, 2).map(ex => {
      let val = JSON.stringify(ex.value);
      if (val.length > 30) val = val.substring(0, 27) + '...';
      return val;
    }).join(', ');
    
    lines.push(`| \`${field.fieldName}\` | ${field.availability.sources} | ${field.availability.dataTypes.join(', ')} | ${field.availability.platforms.join(', ')} | ${exampleValues} |`);
  }
  lines.push('');
  
  // Common Fields Analysis
  const commonFields = sortedFields.filter(f => f.availability.sources >= analysis.length * 0.5);
  lines.push('## Common Fields (Available in 50%+ of sources)');
  lines.push('');
  for (const field of commonFields) {
    lines.push(`### \`${field.fieldName}\``);
    lines.push(`- **Availability**: ${field.availability.sources}/${analysis.length} sources (${Math.round(field.availability.sources / analysis.length * 100)}%)`);
    lines.push(`- **Data Types**: ${field.availability.dataTypes.join(', ')}`);
    lines.push(`- **Platforms**: ${field.availability.platforms.join(', ')}`);
    lines.push('- **Example Values**:');
    field.examples.forEach(ex => {
      lines.push(`  - \`${JSON.stringify(ex.value)}\` (${ex.source}, ${ex.platform}, ${ex.dataType})`);
    });
    lines.push('');
  }
  
  // Detailed Source Analysis
  lines.push('## Detailed Source Analysis');
  lines.push('');
  
  for (const source of analysis) {
    lines.push(`### ${source.sourceName} (${source.platform})`);
    lines.push(`- **Source ID**: ${source.sourceId}`);
    lines.push('');
    
    const dataTypes: DataSourceType[] = ['recent', 'historical', 'metrics'];
    for (const dataType of dataTypes) {
      const data = source.dataTypes[dataType];
      lines.push(`#### ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Data`);
      
      if (data?.available) {
        lines.push(`- ✅ **Available** (Table: \`${data.tableName}\`)`);
        lines.push(`- **Fields (${data.fields?.length || 0})**: ${data.fields?.join(', ') || 'None'}`);
        
        if (data.sampleData && data.sampleData.length > 0) {
          lines.push('- **Sample Data**:');
          data.sampleData.slice(0, 1).forEach(row => {
            lines.push(`  \`\`\`json`);
            lines.push(`  ${JSON.stringify(row, null, 2)}`);
            lines.push(`  \`\`\``);
          });
        }
      } else {
        lines.push(`- ❌ **Not Available**: ${data?.error || 'Unknown reason'}`);
      }
      lines.push('');
    }
  }
  
  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  lines.push('Based on this analysis, here are recommendations for the `query_logs` tool schema:');
  lines.push('');
  
  const universalFields = sortedFields.filter(f => f.availability.sources === analysis.length);
  if (universalFields.length > 0) {
    lines.push('### Universal Fields (Available in ALL sources)');
    lines.push('These fields should always be available:');
    universalFields.forEach(f => lines.push(`- \`${f.fieldName}\``));
    lines.push('');
  }
  
  const commonlyAvailable = sortedFields.filter(f => f.availability.sources >= analysis.length * 0.8 && f.availability.sources < analysis.length);
  if (commonlyAvailable.length > 0) {
    lines.push('### Commonly Available Fields (80%+ of sources)');
    lines.push('These fields should be included with validation:');
    commonlyAvailable.forEach(f => lines.push(`- \`${f.fieldName}\` (${f.availability.sources}/${analysis.length} sources)`));
    lines.push('');
  }
  
  const platformSpecific = sortedFields.filter(f => f.availability.platforms.length === 1 && f.availability.sources < analysis.length * 0.5);
  if (platformSpecific.length > 0) {
    lines.push('### Platform-Specific Fields');
    lines.push('These fields are platform-specific and should be handled conditionally:');
    platformSpecific.forEach(f => lines.push(`- \`${f.fieldName}\` (${f.availability.platforms[0]} only)`));
    lines.push('');
  }
  
  return lines.join('\n');
}

// Run the discovery
discoverFields().catch(console.error);