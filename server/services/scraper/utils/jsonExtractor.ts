/**
 * JSON Extractor - Extract data from embedded JSON using JSONPath
 * Similar to changedetection.io's JSON/jq filtering
 */

import { JsonExtractor } from '../types';

/**
 * Simple JSONPath implementation
 * Supports basic paths like:
 * - $.price
 * - $.rooms[0].price
 * - $.data.hotels[*].price
 */
export class JSONPathExtractor {
  /**
   * Extract value from JSON using JSONPath
   */
  static extract(data: any, path: string): any {
    try {
      // Remove leading $. if present
      const cleanPath = path.startsWith('$.') ? path.slice(2) : path;

      // Split path into segments
      const segments = this.parsePathSegments(cleanPath);

      // Navigate through the object
      return this.navigate(data, segments);
    } catch (error: any) {
      console.error(`[JSONPathExtractor] Error extracting path "${path}":`, error.message);
      return null;
    }
  }

  /**
   * Parse path into segments
   * Examples:
   * - "price" -> ["price"]
   * - "rooms[0].price" -> ["rooms", "[0]", "price"]
   * - "data.hotels[*].price" -> ["data", "hotels", "[*]", "price"]
   */
  private static parsePathSegments(path: string): string[] {
    const segments: string[] = [];
    let current = '';
    let inBracket = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[') {
        if (current) {
          segments.push(current);
          current = '';
        }
        inBracket = true;
        current = '[';
      } else if (char === ']') {
        current += ']';
        segments.push(current);
        current = '';
        inBracket = false;
      } else if (char === '.' && !inBracket) {
        if (current) {
          segments.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }

  /**
   * Navigate through object using segments
   */
  private static navigate(obj: any, segments: string[]): any {
    let current = obj;

    for (const segment of segments) {
      // Array wildcard [*]
      if (segment === '[*]') {
        if (!Array.isArray(current)) {
          return null;
        }
        return current; // Return the whole array
      }

      // Array index [0], [1], etc.
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const index = parseInt(segment.slice(1, -1), 10);
        if (!Array.isArray(current) || index >= current.length) {
          return null;
        }
        current = current[index];
        continue;
      }

      // Object property
      if (typeof current === 'object' && current !== null && segment in current) {
        current = current[segment];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Extract all matching values (for wildcard paths)
   */
  static extractAll(data: any, path: string): any[] {
    try {
      const cleanPath = path.startsWith('$.') ? path.slice(2) : path;
      const segments = this.parsePathSegments(cleanPath);

      return this.navigateAll(data, segments);
    } catch (error: any) {
      console.error(`[JSONPathExtractor] Error extracting all for path "${path}":`, error.message);
      return [];
    }
  }

  /**
   * Navigate and collect all matching values
   */
  private static navigateAll(obj: any, segments: string[]): any[] {
    let results: any[] = [obj];

    for (const segment of segments) {
      const newResults: any[] = [];

      for (const current of results) {
        // Array wildcard [*]
        if (segment === '[*]') {
          if (Array.isArray(current)) {
            newResults.push(...current);
          }
          continue;
        }

        // Array index [N]
        if (segment.startsWith('[') && segment.endsWith(']')) {
          const index = parseInt(segment.slice(1, -1), 10);
          if (Array.isArray(current) && index < current.length) {
            newResults.push(current[index]);
          }
          continue;
        }

        // Object property
        if (typeof current === 'object' && current !== null && segment in current) {
          newResults.push(current[segment]);
        }
      }

      results = newResults;
    }

    return results;
  }
}

/**
 * Extract JSON from HTML script tags
 */
export class HTMLJsonExtractor {
  /**
   * Find and parse JSON from <script type="application/ld+json"> tags
   */
  static extractFromScriptTags(html: string): any[] {
    const results: any[] = [];
    
    // Match <script type="application/ld+json">...</script>
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        const jsonText = match[1].trim();
        const parsed = JSON.parse(jsonText);
        results.push(parsed);
      } catch (error) {
        console.error('[HTMLJsonExtractor] Failed to parse JSON from script tag:', error);
      }
    }

    // Also match window.__INITIAL_DATA__ = {...} patterns
    const windowDataRegex = /window\.__[\w]+__\s*=\s*({[\s\S]*?});/gi;
    while ((match = windowDataRegex.exec(html)) !== null) {
      try {
        const jsonText = match[1].trim();
        const parsed = JSON.parse(jsonText);
        results.push(parsed);
      } catch (error) {
        console.error('[HTMLJsonExtractor] Failed to parse window data:', error);
      }
    }

    return results;
  }

  /**
   * Extract and search for specific value in all JSON blocks
   */
  static extractValue(html: string, path: string): any {
    const jsonBlocks = this.extractFromScriptTags(html);

    for (const block of jsonBlocks) {
      const value = JSONPathExtractor.extract(block, path);
      if (value !== null && value !== undefined) {
        return value;
      }
    }

    return null;
  }

  /**
   * Extract all matching values from all JSON blocks
   */
  static extractAllValues(html: string, path: string): any[] {
    const jsonBlocks = this.extractFromScriptTags(html);
    const allValues: any[] = [];

    for (const block of jsonBlocks) {
      const values = JSONPathExtractor.extractAll(block, path);
      allValues.push(...values);
    }

    return allValues;
  }
}

/**
 * Main extractor function with fallback
 */
export async function extractWithJsonPath(
  html: string,
  extractor: JsonExtractor
): Promise<any> {
  console.log(`[JSONExtractor] Attempting to extract using path: ${extractor.path}`);

  // Try extracting from embedded JSON
  const value = HTMLJsonExtractor.extractValue(html, extractor.path);

  if (value !== null && value !== undefined) {
    console.log(`[JSONExtractor] Successfully extracted value:`, value);
    return value;
  }

  console.log(`[JSONExtractor] No value found in embedded JSON`);
  return null;
}

/**
 * Extract price specifically (common use case)
 */
export async function extractPrice(html: string, paths: string[] = []): Promise<number | null> {
  const defaultPaths = [
    '$.offers.price',
    '$.price',
    '$.priceSpecification.price',
    '$.offers[0].price',
    '$.rooms[0].price',
    '$.data.price'
  ];

  const allPaths = [...paths, ...defaultPaths];

  for (const path of allPaths) {
    const value = HTMLJsonExtractor.extractValue(html, path);
    
    if (value !== null && value !== undefined) {
      // Try to parse as number
      const price = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
      
      if (!isNaN(price)) {
        console.log(`[JSONExtractor] Found price ${price} at path: ${path}`);
        return price;
      }
    }
  }

  return null;
}
