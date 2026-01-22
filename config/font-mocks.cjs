module.exports = new Proxy(
  {},
  {
    get: () => `/* latin */
@font-face {
  font-family: 'MockFont';
  src: url(https://example.com/mock.woff2) format('woff2');
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}`,
  }
);
