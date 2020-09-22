import { styled } from '@filbert-js/core';
export const Title = styled.h1`
  font-size: 2rem;
`;
export const H3 = styled.h3`
  margin: 1rem 0;
`;
export const Paragraph = styled.p`
  margin: 1rem 0;
  .language-text {
    background: rgba(27, 31, 35, 0.05);
    border-radius: 6px;
    padding: 0.2em 0.4em;
  }
`;
export const Pre = styled.pre`
  padding: 10px 20px;
  background: var(--colors-app-background);
  border-radius: 6px;
  color: var(--colors-text-body);
`;
export const Blockquote = styled.div`
  background: var(--colors-app-background);
  border-left: 10px solid #ccc;
  margin: 1.5em 0;
  padding: 1em 10px 1em 10px;
  p {
    margin: 0;
  }
`;
export const Anchor = styled.a`
  display: inline;
  cursor: pointer;
  text-decoration: none;
  color: var(--colors-text-link);

  :hover {
    color: var(--colors-text-link-hover);
  }
`;
