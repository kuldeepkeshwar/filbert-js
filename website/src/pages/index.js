import React from 'react';

export default () => {
  React.useEffect(() => {
    window.location = '/docs/introduction';
  }, []);
  return (
    <div>
      <div>loading..</div>
    </div>
  );
};
