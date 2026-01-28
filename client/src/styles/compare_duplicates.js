const fs = require('fs');

function getSelector(file, line, selectorName) {
  const content = fs.readFileSync(file, 'utf8').split('\n');
  let result = [];
  let i = line - 1;
  
  // Get selector line
  while (i < content.length && !content[i].includes('{')) {
    result.push(content[i]);
    i++;
  }
  result.push(content[i]); // Line with {
  
  // Get properties until }
  let braceCount = 1;
  i++;
  while (i < content.length && braceCount > 0) {
    result.push(content[i]);
    braceCount += (content[i].match(/{/g) || []).length;
    braceCount -= (content[i].match(/}/g) || []).length;
    i++;
  }
  
  return result.join('\n');
}

const checks = [
  { selector: '.render-viewport', keep: 'viewport.css:617', remove: 'app.css:71' },
  { selector: '.viewport-overlay', keep: 'viewport.css:675', remove: 'app.css:86' },
  { selector: '.scene-tree', keep: 'scene-outliner.css:549', remove: ['app.css:98', 'app.css:248'] },
  { selector: '.tree-node:hover', keep: 'scene-outliner.css:574', remove: 'app.css:128' },
  { selector: '.tree-node.selected', keep: 'scene-outliner.css:578', remove: 'app.css:132' },
  { selector: '.modal-dialog', keep: 'app.css:539', remove: 'node-graph.css:50' },
  { selector: '.control-btn:hover', keep: 'app.css:690', remove: 'viewport.css:992' },
  { selector: '.loading-spinner', keep: 'app.css:738', remove: 'node-inspector.css:629' }
];

console.log('🔍 Comparing duplicate definitions:\n');

checks.forEach(check => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${check.selector}`);
  console.log(`${'='.repeat(70)}`);
  
  const [keepFile, keepLine] = check.keep.split(':');
  console.log(`\n✅ KEEP (${check.keep}):`);
  console.log(getSelector(keepFile, parseInt(keepLine), check.selector));
  
  const removes = Array.isArray(check.remove) ? check.remove : [check.remove];
  removes.forEach(loc => {
    const [remFile, remLine] = loc.split(':');
    console.log(`\n❌ REMOVE (${loc}):`);
    console.log(getSelector(remFile, parseInt(remLine), check.selector));
  });
});

