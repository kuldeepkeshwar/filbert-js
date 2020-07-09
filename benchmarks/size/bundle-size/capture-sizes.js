const fs = require('fs');
const path = require('path');
const filesize = require('filesize');

const gzipSize = require('gzip-size').sync;
function canReadAsset(asset) {
  return (
    /\.(js|css)$/.test(asset) &&
    !/service-worker\.js/.test(asset) &&
    !/precache-manifest\.[0-9a-f]+\.js/.test(asset)
  );
}
module.exports = function capture(stats, buildFolder) {
  let total = 0;
  const assets = stats
    .toJson({ all: false, assets: true })
    .assets.filter((asset) => canReadAsset(asset.name))
    .map((asset) => {
      const fileContents = fs.readFileSync(path.join(buildFolder, asset.name));
      const size = gzipSize(fileContents);
      total = size + total;
      return {
        name: path.join(
          path.basename(buildFolder),
          path.dirname(asset.name),
          path.basename(asset.name),
        ),
        size: size,
        sizeLabel: filesize(size),
      };
    });

  const data = {
    total,
    totalLabel: filesize(total),
    assets,
  };

  fs.writeFileSync(
    path.join(path.basename(buildFolder), 'build-stats.json'),
    JSON.stringify(data, null, 2),
  );
  console.log('save build-stats.json');
};
