const path = require('path');
const docsYaml = require('./docs-yaml')();
const _ = require('lodash');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
global.Babel = require('babel-standalone');

exports.onCreateWebpackConfig = ({ stage, actions, plugins, getConfig }) => {
  actions.setWebpackConfig({
    // xor and props are for react-live and cosmiconfig is for babel-plugin-macros
    plugins: [plugins.ignore(/^(xor|props|cosmiconfig)$/)],
    resolve: {
      alias: {
        assert: 'fbjs/lib/emptyFunction',
        'source-map': 'fbjs/lib/emptyFunction',
        'convert-source-map': 'fbjs/lib/emptyFunction',
      },
    },
    node: {
      fs: 'empty',
      buffer: 'empty',
      assert: 'empty',
    },
  });
  const config = getConfig();
  actions.replaceWebpackConfig({
    ...config,
    output: {
      ...config.output,
      // this doesn't seem to always merge correctly with `setWebpackConfig` for some reason
      // so i'm setting it here
      // this is here because it defaults to window and is used for hot reloading and other stuff
      // so if this wasn't here, the web worker would break
      // since it would try to access window
      globalObject: 'this',
    },
    module: {
      ...config.module,
      rules: config.module.rules.filter((rule) => {
        // eslint is annoying
        return rule.enforce !== 'pre';
      }),
    },
  });

  // if (stage === 'build-javascript' && !process.env.CI) {
  //   actions.setWebpackConfig({
  //     plugins: [
  //       new BundleAnalyzerPlugin({
  //         analyzerMode: 'static',
  //       }),
  //     ],
  //   });
  // }
};
function isCapital(word) {
  return word.toUpperCase() === word;
}
exports.createPages = async ({ actions }) => {
  const { createPage, createRedirect } = actions;
  createRedirect({
    fromPath: `/`,
    isPermanent: true,
    redirectInBrowser: true,
    toPath: `/docs/introduction`,
  });
  const docTemplate = require.resolve(`./src/templates/doc.js`);
  const packageTemplate = require.resolve(`./src/templates/package.js`);
  docsYaml.forEach(({ items, title }) => {
    if (title === 'Packages') {
      items.forEach((slug) => {
        createPage({
          path: `packages/${slug}`,
          component: packageTemplate,
          context: {
            slug: slug,
          },
        });
      });
    } else {
      items.forEach((item) => {
        const slug = isCapital(item) ? item : _.kebabCase(item);
        createPage({
          path: `docs/${slug}`,
          component: docTemplate,
          context: {
            slug: slug,
          },
        });
      });
    }
  });
};
// Add custom url pathname for blog posts.
exports.onCreateNode = async ({ node, actions, getNode }) => {
  const { createNodeField } = actions;

  if (node.internal.type === `Mdx` && typeof node.slug === `undefined`) {
    const fileNode = getNode(node.parent);

    let value;
    if (fileNode.name === 'README') {
      const pkgName = getNameForPackage(fileNode.absolutePath);
      if (pkgName === 'root') {
        value = 'introduction';
      } else if (pkgName) {
        value = pkgName;
        createNodeField({
          node,
          name: `isPackage`,
          value: true,
        });
      } else {
        value = fileNode.name;
      }
    } else {
      value = fileNode.name;
    }
    const title = isCapital(value) ? value : _.startCase(value);
    createNodeField({
      node,
      name: `slug`,
      value: value,
    });
    createNodeField({
      node,
      name: `title`,
      value: title,
    });
  }
};

function getNameForPackage(absolutePath) {
  try {
    return require(`${path.parse(absolutePath).dir}/package.json`).name;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      const splitAbsolutePath = absolutePath.split(path.sep);
      return splitAbsolutePath[splitAbsolutePath.length - 2];
    }
    throw e;
  }
}
