export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.ts'],
};