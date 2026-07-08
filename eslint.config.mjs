import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        // Adapter is plain CommonJS, no admin React sources to lint here
        ignores: ['admin/**', 'test/**', '.dev-server/**', 'node_modules/**', '*.config.mjs'],
    },
];
