const path = require('path');
const docsYaml = require('./docs-yaml')();
const _ = require('lodash');

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

const docs = [];
docsYaml.forEach(({ items, title }) => {
  const isPackage = title === 'Packages';
  items.forEach((name) => {
    const fileName = isCapital(name) ? name : _.kebabCase(name);
    const prefix = 'Getting Started' === title ? 'docs' : _.kebabCase(title);
    docs.push({
      isPackage: isPackage,
      name: name,
      fileName: isPackage ? name : fileName,
      slug: `${prefix}/${isPackage ? name : fileName}`,
      group: title,
    });
  });
});

exports.sourceNodes = ({ actions, createNodeId, createContentDigest }) => {
  const { createNode } = actions;

  // Data can come from anywhere, but for now create it manually
  const data = { items: docs };
  const nodeMeta = {
    id: createNodeId(`docs-map`),
    parent: null,
    children: [],
    internal: {
      type: `DocMap`,
      contentDigest: createContentDigest(data),
    },
  };

  const node = Object.assign({}, data, nodeMeta);
  createNode(node);
};
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
  docs.forEach(({ slug, isPackage }) => {
    createPage({
      path: slug,
      component: isPackage ? packageTemplate : docTemplate,
      context: {
        slug: slug,
      },
    });
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
      } else {
        value = pkgName;
      }
    } else {
      value = fileNode.name;
    }

    const [doc] = docs.filter((doc) => doc.fileName === value);
    const title = doc.name;
    const slug = doc.slug;

    createNodeField({
      node,
      name: `slug`,
      value: slug,
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
