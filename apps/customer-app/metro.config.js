const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot, ...(config.watchFolders || [])];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.blockList = [
  /.*\/apps\/customer-app\/dist\/.*/,
  /.*\/android\/app\/build\/.*/,
  /.*\/android\/\.gradle\/.*/,
  /.*\/apps\/web\/\.next\/.*/,
  /.*\/apps\/admin\/\.next\/.*/,
];

const projectReact = path.resolve(projectRoot, 'node_modules/react');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return context.resolveRequest(context, projectReact, platform);
  }
  if (moduleName.startsWith('react/')) {
    return context.resolveRequest(context, path.join(projectReact, moduleName.slice(6)), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@kandy-cabs/shared': path.resolve(monorepoRoot, 'packages/shared'),
  react: projectReact,
};

module.exports = config;
