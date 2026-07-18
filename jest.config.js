export default {
    testEnvironment: 'jsdom',
    transform: {},
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
    },
    modulePathIgnorePatterns: ['<rootDir>/next-src/.next/'],
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js']
};
