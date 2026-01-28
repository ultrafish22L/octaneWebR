const fs = require('fs');

const duplicates = JSON.parse(fs.readFileSync('duplicates.json', 'utf8'));

console.log('\n📋 CONSOLIDATION STRATEGY:\n');
console.log('Rule: Domain-specific → specific file | Shared components → app.css\n');

const plan = {
  'viewport.css': ['.render-viewport', '.viewport-overlay'],
  'scene-outliner.css': ['.scene-tree', '.tree-node:hover', '.tree-node.selected'],
  'app.css': ['.modal-dialog', '.control-btn:hover', '.loading-spinner']
};

Object.entries(plan).forEach(([keepFile, selectors]) => {
  console.log(`✅ Keep in ${keepFile}:`);
  selectors.forEach(sel => {
    const dup = duplicates.find(d => d.selector === sel);
    if (dup) {
      const removeFrom = dup.files.filter(f => f !== keepFile);
      console.log(`   ${sel}`);
      console.log(`   └─ Remove from: ${removeFrom.join(', ')}`);
    }
  });
  console.log('');
});

// Calculate stats
let totalRemoved = 0;
Object.entries(plan).forEach(([keepFile, selectors]) => {
  selectors.forEach(sel => {
    const dup = duplicates.find(d => d.selector === sel);
    if (dup) {
      totalRemoved += dup.files.filter(f => f !== keepFile).length;
    }
  });
});

console.log(`\n📊 Total duplicate definitions to remove: ${totalRemoved}`);
