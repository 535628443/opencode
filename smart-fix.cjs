const fs = require('fs');
const glob = require('child_process').execSync;

const files = glob('find packages/app packages/session-ui -name "*.ts" -o -name "*.tsx"').toString().split('\n').filter(Boolean);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Replace \"word\" with "word"
  newContent = newContent.replace(/\\"(.*?)\\"/g, (match, p1) => {
    return '"' + p1 + '"';
  });

  // Replace remaining \" at the end of paths with \\"
  newContent = newContent.replace(/\\\\"/g, '\\\\\\"'); // C:\\repo\" -> C:\\repo\\"

  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
  }
}
