const Benchmark = require('benchmark');

const react = require('react');
const { renderToString: render } = require('react-dom/server');

const filbert = require('@filbert-js/core');
const filbertVersion = require('@filbert-js/core/package.json').version;
const createStylesheet = require('@filbert-js/server-stylesheet')
  .createStylesheet;

const styledComponents = require('styled-components');
const styledVersion = require('styled-components/package.json').version;
const emotion = require('@emotion/styled').default;
const createEmotionServer = require('create-emotion-server').default;
const createCache = require('@emotion/cache').default;
const CacheProvider = require('@emotion/core').CacheProvider;
const emotionVersion = require('@emotion/styled/package.json').version;

const filbertSheet = createStylesheet();
const styledSheet = new styledComponents.ServerStyleSheet();
const cache = createCache();
const { extractCritical } = createEmotionServer(cache);

const component = (styled) => {
  return styled('div')`
    opacity: ${(props) => (props.counter > 0.5 ? 1 : 0)};
    @media (min-width: 1px) {
      rule: all;
    }
    &:hover {
      another: 1;
      display: block;
    }
  `;
};

function renderFilbertComponent(sheet, Foo) {
  render(
    sheet.collectStyles(react.createElement(Foo, { counter: Math.random() })),
  );
  sheet.getStyles();
}
function renderStyledComponent(sheet, Foo) {
  render(
    sheet.collectStyles(react.createElement(Foo, { counter: Math.random() })),
  );
  sheet.getStyleTags();
}
function renderEmotionComponent(Foo) {
  extractCritical(
    render(
      react.createElement(CacheProvider, { value: cache }, [
        react.createElement(Foo, { key: '1', counter: Math.random() }),
      ]),
    ),
  );
}

const suite = new Benchmark.Suite('styled');
suite
  .add(`filbert@${filbertVersion}`, () => {
    renderFilbertComponent(filbertSheet, component(filbert.styled));
  })
  .add(`emotion@${emotionVersion}`, () => {
    renderEmotionComponent(component(emotion));
  })
  .add(`styled-components@${styledVersion}`, () => {
    renderStyledComponent(styledSheet, component(styledComponents.default));
  })
  .on('error', (e) => console.log(e))
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    const fastest = this.filter('fastest').map('name')[0];
    console.log('\nFastest is: ' + fastest);
  })
  .run({ async: true });
