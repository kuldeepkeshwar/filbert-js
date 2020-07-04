module.exports = {
  siteMetadata: {
    siteUrl: 'https://filbert-js.vercel.app',
    title: `filbert`,
  },
  plugins: [
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
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'docs_yaml',
        path: `${__dirname}/docs/docs.yaml`,
      },
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `filbert`,
        short_name: `filbert`,
        start_url: `/`,
        background_color: `#663399`,
        theme_color: `#663399`,
        display: `filbert`,
        icon: `../filbert.png`, // This path is relative to the root of the site.
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
    // { // TODO: not working as of now, need to fix
    //   resolve: require.resolve('gatsby-plugin-filbert'),
    //   options: {
    //     // Add any options here
    //   },
    // },
    `gatsby-transformer-yaml`,

    `gatsby-plugin-react-helmet`,
    'gatsby-plugin-sharp',
    'gatsby-transformer-sharp',
    'gatsby-plugin-catch-links',
    'gatsby-plugin-sitemap',
  ],
};
