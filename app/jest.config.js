module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'server.js',
    'database.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  // Support pour les modules ESM comme nanoid
  transformIgnorePatterns: [
    '/node_modules/(?!(nanoid)/)'
  ],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  // Forcer la fermeture après les tests
  forceExit: true
};
