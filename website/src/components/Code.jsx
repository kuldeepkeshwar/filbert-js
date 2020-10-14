import Playground from './Playground';
import React from 'react';
import StaticCode from './StaticCode';

export function Code({ children, editor, metastring }) {
  if (editor === 'live') {
    const compiled = metastring.replace('editor=live compiled=', '').trim();
    return <Playground code={children} compiled={compiled}></Playground>;
  } else if (editor === 'static') {
    const code = children.replace('editor=static', '').trim();
    return <StaticCode code={code}></StaticCode>;
  } else {
    return children;
  }
}
