import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  coverageProvider: "v8",
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
            "@colophony/api/trpc/client-types": [
              "../api/src/trpc/client-types.ts",
            ],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@colophony/api/trpc/client-types$":
      "<rootDir>/../api/src/trpc/client-types.ts",
    "^@colophony/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@colophony/types/(.*)$": "<rootDir>/../../packages/types/src/$1",
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
  testPathIgnorePatterns: ["/.next/", "/node_modules/", "/e2e/", "/_v1/"],
};

export default config;
