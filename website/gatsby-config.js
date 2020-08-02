const path = require('path');
const packageJson = require('./package.json');
const { homepage, description, author, keywords } = packageJson;
const packages = require('./docs-yaml')().filter(
  ({ title }) => title === 'Packages',
)[0].items;
module.exports = {
  siteMetadata: {
    siteUrl: homepage,
    title: `@title`,
    description,
    author,
    keywords,
  },
  plugins: packages
    .map((pkg) =>
      path.resolve(
        `${__dirname}/../packages/${pkg.replace('@packages/', '')}/README.md`,
      ),
    )
    .map((file) => ({
      resolve: 'gatsby-source-filesystem',
      options: {
        path: file,
      },
    }))
    .concat([
      {
        resolve: 'gatsby-source-filesystem',
        options: {
          path: `${__dirname}/../README.md`,
        },
      },
      {
        resolve: 'gatsby-source-filesystem',
        options: {
          path: `${__dirname}/docs`,
        },
      },

      {
        resolve: `gatsby-plugin-manifest`,
        options: {
          name: `@title`,
          short_name: `@title`,
          start_url: `/`,
          background_color: `#663399`,
          theme_color: `#663399`,
          display: `@title`,
          icon: `@icon`, // This path is relative to the root of the site.
        },
      },
      {
        resolve: `gatsby-plugin-mdx`,
        options: {
          extensions: ['.mdx', '.md'],
          gatsbyRemarkPlugins: [
            { resolve: require.resolve('./plugins/gatsby-remark-live-code') },
            { resolve: 'gatsby-remark-autolink-headers' },
            { resolve: 'gatsby-remark-prismjs' },
            { resolve: 'gatsby-remark-smartypants' },
          ],
        },
      },
      {
        resolve: 'gatsby-plugin-react-svg',
        options: {
          rule: {
            include: /images\/icons/, // See below to configure properly
          },
        },
      },
      {
        resolve: `gatsby-plugin-google-analytics`,
        options: {
          trackingId: '@GA-ID',
        },
      },

      'gatsby-plugin-filbert',
      `gatsby-plugin-react-helmet`,
      'gatsby-plugin-sharp',
      'gatsby-transformer-sharp',
      'gatsby-plugin-catch-links',
      'gatsby-plugin-sitemap',
    ]),
};
