import {
  Anchor,
  Blockquote,
  H3,
  Paragraph,
  Pre,
} from '../components/markdown-overrides';

import { Code } from '../components/Code';
import { Layout } from '../components/Layout';
import { MDXProvider } from '@mdx-js/react';
import { MDXRenderer } from 'gatsby-plugin-mdx';
import React from 'react';
import { SEO } from '../components/SEO';
import { graphql } from 'gatsby';

export default ({ data: { doc } }) => {
  const {
    fields: { slug, title },
    frontmatter: { title: _title },
    body,
  } = doc;

  const __title = _title || title || slug;
  return (
    <>
      <SEO title={__title} />
      <Layout>
        <MDXProvider
          components={{
            code: Code,
            blockquote: Blockquote,
            p: Paragraph,
            pre: Pre,
            h3: H3,
            a: Anchor,
          }}
        >
          <MDXRenderer children={body} />
        </MDXProvider>
      </Layout>
    </>
  );
};

export const pageQuery = graphql`
  query PackageBySlug($slug: String!) {
    doc: mdx(fields: { slug: { eq: $slug } }) {
      body
      fields {
        slug
        title
      }
      frontmatter {
        title
      }
    }
  }
`;
