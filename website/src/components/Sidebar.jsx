import { Link, graphql, useStaticQuery } from 'gatsby';

import React from 'react';
import { Stack } from 'layout-ui';
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
const MenuHeading = styled.div`
  margin-bottom: 1rem;
`;
export const Sidebar = () => {
  const { allMdx, allDocsYaml } = useStaticQuery(graphql`
    query allDocsYaml {
      allDocsYaml {
        nodes {
          items
          title
        }
      }
      allMdx {
        nodes {
          fields {
            slug
            title
            isPackage
          }
        }
      }
    }
  `);
  const linkMap = allMdx.nodes.reduce(
    (agg, { fields: { slug, title, isPackage } }) => {
      if (isPackage) {
        agg[slug] = { slug, title };
      } else {
        agg[title] = { slug, title };
      }

      return agg;
    },
    {},
  );
  const links = allDocsYaml.nodes.map(({ items, title }) => {
    return { title, items: items.filter((t) => t !== 'Todo') };
  });

  return (
    <Stack direction="vertical" gap="2rem">
      {links.map((link) => {
        return (
          <div>
            <MenuHeading>{link.title}</MenuHeading>
            <Stack direction="vertical" gap="1rem">
              {link.items.map((title) => (
                <MenuItem>
                  <Link
                    to={`${titleToURLPrefix[link.title]}${linkMap[title].slug}`}
                  >
                    {title}
                  </Link>
                </MenuItem>
              ))}
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
};
const titleToURLPrefix = {
  'Getting Started': '/docs/',
  Packages: '/packages/',
  Miscellaneous: '/miscellaneous/',
};
