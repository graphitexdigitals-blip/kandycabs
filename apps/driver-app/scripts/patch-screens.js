const fs = require('fs');
const path = require('path');

// Target file path for react-native-screens ScreensModule.kt
const targetPaths = [
  path.resolve(__dirname, '../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreensModule.kt'),
  path.resolve(__dirname, '../../../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreensModule.kt')
];

let applied = false;

for (const filePath of targetPaths) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('catch (exception: Exception)')) {
      content = content.replace('catch (exception: Exception)', 'catch (exception: Throwable)');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-screens] Applied Throwable patch to: ${filePath}`);
      applied = true;
    } else if (content.includes('catch (exception: Throwable)')) {
      console.log(`[patch-screens] Patch already present in: ${filePath}`);
      applied = true;
    }
  }
}

if (!applied) {
  console.warn('[patch-screens] Warning: ScreensModule.kt was not found to patch.');
}

// Target build.gradle for react-native-screens to support monorepos / EAS build
const gradlePaths = [
  path.resolve(__dirname, '../node_modules/react-native-screens/android/build.gradle'),
  path.resolve(__dirname, '../../../node_modules/react-native-screens/android/build.gradle')
];

for (const gPath of gradlePaths) {
  if (fs.existsSync(gPath)) {
    let content = fs.readFileSync(gPath, 'utf8');
    const targetStr = `def safeAppExtGet(prop, fallback) {
    def appProject = rootProject.allprojects.find { it.plugins.hasPlugin('com.android.application') }
    appProject?.ext?.has(prop) ? appProject.ext.get(prop) : fallback
}`;
    const replacementStr = `def safeAppExtGet(prop, fallback) {
    def appProject = rootProject.allprojects.find { it.plugins.hasPlugin('com.android.application') }
    if (appProject?.ext?.has(prop)) return appProject.ext.get(prop)
    if (rootProject?.ext?.has(prop)) return rootProject.ext.get(prop)
    return fallback
}`;
    if (content.includes(targetStr)) {
      content = content.replace(targetStr, replacementStr);
      fs.writeFileSync(gPath, content, 'utf8');
      console.log(`[patch-screens] Applied build.gradle monorepo fallback patch to: ${gPath}`);
    } else if (content.includes('if (rootProject?.ext?.has(prop)) return rootProject.ext.get(prop)')) {
      console.log(`[patch-screens] build.gradle patch already present in: ${gPath}`);
    }
  }
}

// Target fast-text-encoding text.min.js to prevent throw on fatal: true in Hermes
const fastTextPaths = [
  path.resolve(__dirname, '../node_modules/fast-text-encoding/text.min.js'),
  path.resolve(__dirname, '../../../node_modules/fast-text-encoding/text.min.js')
];

for (const ftPath of fastTextPaths) {
  if (fs.existsSync(ftPath)) {
    let content = fs.readFileSync(ftPath, 'utf8');
    const throwPattern = 'if(r)throw new TypeError("Failed to "+e+": the \'"+f+"\' option is unsupported.")';
    const safeReplacement = '/* no-op safe for hermes */';
    if (content.includes(throwPattern)) {
      content = content.replace(throwPattern, safeReplacement);
      fs.writeFileSync(ftPath, content, 'utf8');
      console.log(`[patch-screens] Applied fast-text-encoding safe patch to: ${ftPath}`);
    } else if (content.includes(safeReplacement)) {
      console.log(`[patch-screens] fast-text-encoding patch already present in: ${ftPath}`);
    }
  }
}

// Ensure local react exists for driver-app Metro deduplication
const localReactDir = path.resolve(__dirname, '../node_modules/react');
if (!fs.existsSync(localReactDir)) {
  const customerReact = path.resolve(__dirname, '../../customer-app/node_modules/react');
  const rootReact = path.resolve(__dirname, '../../../node_modules/react');
  const sourceReact = fs.existsSync(customerReact) ? customerReact : (fs.existsSync(rootReact) ? rootReact : null);
  if (sourceReact) {
    fs.cpSync(sourceReact, localReactDir, { recursive: true });
    console.log(`[patch-screens] Copied React from ${sourceReact} to ${localReactDir}`);
  }
}

