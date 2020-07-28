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
  const { allDocMap } = useStaticQuery(graphql`
    query Sidebar {
      allDocMap {
        nodes {
          items {
            group
            name
            slug
          }
        }
      }
    }
  `);

  const links = allDocMap.nodes.reduce((agg, { items }) => {
    items.forEach((item) => {
      if (item.name !== 'Todo') {
        if (agg[item.group]) {
          agg[item.group].push(item);
        } else {
          agg[item.group] = [item];
        }
      }
    });
    return agg;
  }, {});

  return (
    <Stack direction="vertical" gap="2rem">
      {Object.keys(links).map((group) => {
        return (
          <div>
            <MenuHeading>{group}</MenuHeading>
            <Stack direction="vertical" gap="1rem">
              {links[group].map((item) => (
                <MenuItem>
                  <Link to={`/${item.slug}`}>{item.name}</Link>
                </MenuItem>
              ))}
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
};
