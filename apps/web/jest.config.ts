import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  rootDir: ".",
  testRegex: ".*\\.spec\\.(ts|tsx)$",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          allowJs: true,
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          isolatedModules: true,
          paths: {
            "@/*": ["./src/*"],
            "@prospector/api/*": ["../api/src/*"],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@prospector/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@prospector/types/(.*)$": "<rootDir>/../../packages/types/src/$1",
  },
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/**/*",
    "!src/components/ui/**/*",
  ],
  coverageDirectory: "./coverage",
  testPathIgnorePatterns: ["/.next/", "/node_modules/", "/e2e/"],
};

export default config;
