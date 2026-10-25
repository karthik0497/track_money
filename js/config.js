// Track-Money: Application Runtime Configuration
const _d = (str) => {
  try {
    return typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('utf-8');
  } catch (e) {
    return '';
  }
};

export const APP_CONFIG = {
  GEMINI_MODEL: 'gemini-3.5-flash',
  DEFAULT_GEMINI_KEY: _d('QVEuQWI4Uk42TGIxQlBXc1FEOWVObmhnZU9wbnNXck1ka3hsTVVZTnhab3k2eFlTSFN2WFE=')
};
