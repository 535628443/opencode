const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('find packages/app -name "*.ts" -o -name "*.tsx"').toString().split('\n').filter(Boolean);
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let newContent = content.replace(/\\"/g, '\\\\"');
  if (newContent !== content) {
    fs.writeFileSync(f, newContent);
  }
});
