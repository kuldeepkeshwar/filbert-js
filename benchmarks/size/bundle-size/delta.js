const fs = require('fs');
const path = require('path');
const filesize = require('filesize');
const chalk = require('chalk');
const filbertVersion = require('@filbert-js/core/package.json').version;
const styledVersion = require('styled-components/package.json').version;
const emotionVersion = require('@emotion/styled/package.json').version;

const baseFramework = 'vanilla-css';
const frameworks = [
  { name: 'filbert', version: filbertVersion },
  { name: 'emotion', version: emotionVersion },
  { name: 'styled-components', version: styledVersion },
];
const statsFilePath = 'build/build-stats.json';

function readJSON(dir) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, dir, statsFilePath), {
      encoding: 'utf-8',
    }),
  );
}
const baseStats = readJSON(path.join(`../${baseFramework}`));
chalk.cyan(
  `Base Application(vanilla CSS)  size after gzip :${filesize(
    baseStats.total,
  )}`,
);
const deltas = frameworks.map((framework) => {
  const stats = readJSON(path.join(`../${framework.name}`));
  const delta = stats.total - baseStats.total;
  return {
    ...framework,
    total: stats.total,
    delta,
    deltaLabel: filesize(delta),
  };
});
let message = chalk.cyan(`Framework sizes after gzip \n`);
message = deltas.reduce((previous, item) => {
  return `${previous}${chalk.green(
    `${item.name}@${item.version}`,
  )}   ${chalk.yellow(item.deltaLabel)}\n`;
}, message);
const lightest = deltas.reduce((previous, item) => {
  if (previous.total < item.total) {
    return previous;
  }
  return item;
});
console.log(message);
console.log(chalk.cyan(`Lightest is: ${lightest.name}@${lightest.version}`));
