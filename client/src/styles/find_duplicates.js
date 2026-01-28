const fs = require('fs');
const path = require('path');

// Get all CSS files
const cssFiles = [
  'app.css',
  'node-inspector.css', 
  'node-graph.css',
  'octane-theme.css',
  'scene-outliner.css',
  'viewport.css'
];

// Extract selectors from CSS file
function extractSelectors(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const selectors = new Map();
  
  // Match CSS rules (selector { ... })
  const ruleRegex = /([^{}]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;
  let lineNum = 1;
  
  while ((match = ruleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const properties = match[2].trim();
    
    // Skip @media, @keyframes, etc.
    if (selector.startsWith('@')) continue;
    
    // Count lines to get line number
    const beforeMatch = content.substring(0, match.index);
    lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
    
    // Handle multiple selectors (comma-separated)
    const selectorList = selector.split(',').map(s => s.trim());
    
    selectorList.forEach(sel => {
      if (!selectors.has(sel)) {
        selectors.set(sel, []);
      }
      selectors.get(sel).push({
        line: lineNum,
        properties: properties.substring(0, 100) // First 100 chars
      });
    });
  }
  
  return selectors;
}

// Build selector index across all files
const selectorIndex = new Map(); // selector -> [{file, line, properties}]

cssFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  const selectors = extractSelectors(filePath);
  
  selectors.forEach((occurrences, selector) => {
    if (!selectorIndex.has(selector)) {
      selectorIndex.set(selector, []);
    }
    occurrences.forEach(occ => {
      selectorIndex.get(selector).push({
        file,
        line: occ.line,
        properties: occ.properties
      });
    });
  });
});

// Find duplicates (selectors in multiple files)
const duplicates = [];

selectorIndex.forEach((locations, selector) => {
  const uniqueFiles = new Set(locations.map(loc => loc.file));
  if (uniqueFiles.size > 1) {
    duplicates.push({
      selector,
      count: locations.length,
      files: Array.from(uniqueFiles),
      locations
    });
  }
});

// Sort by number of files
duplicates.sort((a, b) => b.files.length - a.files.length);

console.log(`\n🔍 Found ${duplicates.length} selectors defined in multiple files:\n`);

duplicates.forEach((dup, idx) => {
  console.log(`${idx + 1}. ${dup.selector}`);
  console.log(`   Files: ${dup.files.join(', ')}`);
  dup.locations.forEach(loc => {
    console.log(`   - ${loc.file}:${loc.line}`);
  });
  console.log('');
});

// Write JSON for processing
fs.writeFileSync('duplicates.json', JSON.stringify(duplicates, null, 2));
console.log(`\n📄 Full report saved to duplicates.json`);
