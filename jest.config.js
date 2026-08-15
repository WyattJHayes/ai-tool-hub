export default {
    testEnvironment: 'jsdom',
    testEnvironmentOptions: {
        url: 'https://weihub.cloud/'
    },
    transform: {},
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    modulePathIgnorePatterns: ['<rootDir>/next-src/.next/'],
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js']
};
