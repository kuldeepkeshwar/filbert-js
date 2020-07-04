import { Link, graphql, useStaticQuery } from 'gatsby';

import React from 'react';
import { Stack } from './Stack';
import { colors } from '../themes/utils';
import { styled } from '@filbert-js/core';

const MenuItem = styled.span`
  a {
    display: inline;
    cursor: pointer;
    text-decoration: none;
    color: ${colors(`text.link`)};
  }
  a:hover {
    color: ${colors(`text.link-hover`)};
  }
`;

export const Sidebar = () => {
  const { allMdx, allDocsYaml } = useStaticQuery(graphql`
    query allDocsYaml {
      allDocsYaml {
        nodes {
          items
        }
      }
      allMdx {
        nodes {
          fields {
            slug
            title
          }
        }
      }
    }
  `);
  const linkMap = allMdx.nodes.reduce((agg, { fields: { slug, title } }) => {
    agg[title] = { slug, title };
    return agg;
  }, {});
  let [links] = allDocsYaml.nodes.map((node) => {
    return node.items;
  });
  links = links.filter((title) => title !== 'TODO');
  return (
    <Stack direction="vertical" gap="1rem">
      {links.map((title) => (
        <MenuItem>
          <Link to={`/docs/${linkMap[title].slug}`}>{title}</Link>
        </MenuItem>
      ))}
    </Stack>
  );
};
