const fs = require('fs');
const path = require('path');
const filesize = require('filesize');
const chalk = require('chalk');
const baseFramework = 'vanilla-css';
const frameworks = ['filbert', 'emotion', 'styled-components'];
const statsFilePath = 'build/build-stats.json';

function readJSON(dir) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, dir, statsFilePath), {
      encoding: 'utf-8',
    }),
  );
}
const baseStats = readJSON(path.join(`../${baseFramework}`));
const deltas = frameworks.map((framework) => {
  const stats = readJSON(path.join(`../${framework}`));
  const delta = stats.total - baseStats.total;
  return { name: framework, delta, deltaLabel: filesize(delta) };
});
const message = deltas.reduce((agg, item) => {
  return `${agg}${chalk.green(item.name)} ${chalk.yellow(item.deltaLabel)}\n`;
}, chalk.cyan(`Framework sizes after gzip \n`));
console.log(message);
