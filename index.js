import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Add these lines for __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure path
const projectRoot = path.join(__dirname, '..');

// Define logs directory
const logsDir = path.join(projectRoot, 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Generate log file name with current date
const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
const logFilePath = path.join(logsDir, `${currentDate}.log`);

// Function to log messages to the log file and console
function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // Log to console
    console.log(logEntry.trim());

    // Log to file
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error(`Failed to write to log file: ${err}`);
        }
    });
}

// Main function
async function main() {
  try {
    const projectName = process.argv[2];
    const projectDesc = process.argv[3];
    
    // Phase 1: Modify file contents
    await modifyVcpkgJson(projectName);
    logMessage("Done modifyVcpkgJson");
    await modifySolutionFile(projectName);
    logMessage("Done modifySolutionFile");
    await modifyFilterFile(projectName);
    logMessage("Done modifyFilterFile");
    await modifyProjectFile(projectName);
    logMessage("Done modifyProjectFile");

    // phase 2: global replacement
    await sourceReplace(projectName);
    logMessage("Done sourceReplace");

    await updatePluginInfo(projectName, projectDesc);
    logMessage("Done updatePluginInfo");
    
    // phase 3: rename files (last step)
    await renameFiles(projectName);
    logMessage("Done renameFiles");
    
    logMessage(`\nProject successfully renamed to ${projectName}!`);
  } catch (error) {
    logMessage('Error:', error.message);
  }
}

async function modifyVcpkgJson(projectName) {
  const lowercaseName = projectName.toLowerCase();
  const filePath = path.join(projectRoot, 'vcpkg.json');
  if (!fs.existsSync(filePath)) {
    logMessage(`Warning: ${filePath} not found. Skipping...`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /"name": "asa-api-plugin-template"/,
    `"name": "asa-api-plugin-${lowercaseName}"`
  );
  fs.writeFileSync(filePath, updated);
  logMessage(`Updated vcpkg.json name to ${lowercaseName}`);
}

async function modifySolutionFile(projectName) {
  const filePath = path.join(projectRoot, 'PluginTemplate.sln');
  if (!fs.existsSync(filePath)) {
    logMessage(`Warning: ${filePath} not found. Skipping...`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  if (lines.length >= 6) {
    lines[5] = lines[5]
      .replace(/PluginTemplate/g, projectName)
      .replace(/AsaApi\.Plugins\.Template\.vcxproj/g, `AsaApi.Plugins.${projectName}.vcxproj`);
  }
  
  fs.writeFileSync(filePath, lines.join('\n'));
  logMessage('Updated PluginTemplate.sln');
}

async function modifyFilterFile(projectName) {
  const filePath = path.join(projectRoot, 'AsaApi.Plugins.Template.vcxproj.filters');
  if (!fs.existsSync(filePath)) {
    logMessage(`Warning: ${filePath} not found. Skipping...`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Line 45 replacement
  content = replaceLine(content, 45, /<ClCompile Include="Source\\PluginTemplate\.cpp">/, 
    `<ClCompile Include="Source\\${projectName}.cpp">`);
  
  // Line 59 replacement
  content = replaceLine(content, 59, /<ClInclude Include="Source\\Public\\PluginTemplate\.h">/, 
    `<ClInclude Include="Source\\Public\\${projectName}.h">`);
  
  fs.writeFileSync(filePath, content);
  logMessage('Updated AsaApi.Plugins.Template.vcxproj.filters');
}

async function modifyProjectFile(projectName) {
  const filePath = path.join(projectRoot, 'AsaApi.Plugins.Template.vcxproj');
  if (!fs.existsSync(filePath)) {
    logMessage(`Warning: ${filePath} not found. Skipping...`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Line 20 replacement
  content = replaceLine(content, 20, /<ClCompile Include="Source\\PluginTemplate\.cpp" \/>/, 
    `<ClCompile Include="Source\\${projectName}.cpp" />`);
  
  // Line 30 replacement
  content = replaceLine(content, 30, /<ClInclude Include="Source\\Public\\PluginTemplate\.h" \/>/, 
    `<ClInclude Include="Source\\Public\\${projectName}.h" />`);
  
  // Line 40 replacement
  content = replaceLine(content, 40, /<RootNamespace>AsaApiPluginsTemplate<\/RootNamespace>/, 
    `<RootNamespace>AsaApiPlugins${projectName}</RootNamespace>`);
  
  // Line 42 replacement
  content = replaceLine(content, 42, /<ProjectName>PluginTemplate<\/ProjectName>/, 
    `<ProjectName>${projectName}</ProjectName>`);
  
  // Line 81 replacement
  content = replaceLine(content, 81, /ASAAPIPLUGINSTEMPLATE_EXPORTS/, 
    `ASAAPIPLUGINS${projectName.toUpperCase()}_EXPORTS`);
  
  fs.writeFileSync(filePath, content);
  logMessage('Updated AsaApi.Plugins.Template.vcxproj');
}

async function sourceReplace(projectName){
  const directories =[
    path.join(projectRoot, 'Source'),
    path.join(projectRoot, 'Source', 'Public')
  ];

  for (const dir of directories) {
    if (fs.existsSync(dir)) {
      logMessage(`Processing directory: ${dir}`);
      editFilesInDirectory(dir, "PluginTemplate", projectName);
    }
  }
}

async function updatePluginInfo(projectName, projectDesc) {
  const pluginInfoPath = path.join(projectRoot, 'Configs', 'PluginInfo.json');
  
  if (!fs.existsSync(pluginInfoPath)) {
    logMessage('PluginInfo.json not found - skipping');
    return;
  }

  try {
    // Read and parse the JSON file
    const data = await fs.promises.readFile(pluginInfoPath, 'utf8');
    const pluginInfo = JSON.parse(data);

    // Store original values for comparison
    const original = {
      FullName: pluginInfo.FullName,
      Description: pluginInfo.Description
    };

    // Update the values
    pluginInfo.FullName = projectName;
    pluginInfo.Description = projectDesc;

    // Only write if changes were made
    if (original.FullName !== projectName || original.Description !== projectDesc) {
      await fs.promises.writeFile(
        pluginInfoPath,
        JSON.stringify(pluginInfo, null, 2), // 2-space indentation
        'utf8'
      );

      logMessage('Successfully updated PluginInfo.json:');
      logMessage(`- FullName: "${original.FullName}" => "${projectName}"`);
      logMessage(`- Description: "${original.Description}" => "${projectDesc}"`);
    } else {
      logMessage('No changes needed in PluginInfo.json');
    }
  } catch (err) {
    logMessage('Error updating PluginInfo.json:', err.message);
  }
}

async function renameFiles(projectName) {
  try {
    // Rename solution file
    const oldSolutionPath = path.join(projectRoot, 'PluginTemplate.sln');
    const newSolutionPath = path.join(projectRoot, `${projectName}.sln`);
    if (fs.existsSync(oldSolutionPath)) {
      fs.renameSync(oldSolutionPath, newSolutionPath);
      logMessage(`Renamed solution file to ${projectName}.sln`);
    }

    // Rename project files
    const projectFiles = [
      'AsaApi.Plugins.Template.vcxproj',
      'AsaApi.Plugins.Template.vcxproj.filters',
      'AsaApi.Plugins.Template.vcxproj.user'
    ];
    
    for (const file of projectFiles) {
      const oldPath = path.join(projectRoot, file);
      const newPath = path.join(projectRoot, file.replace('Template', projectName));
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        logMessage(`Renamed ${file} to ${path.basename(newPath)}`);
      }
    }

    // Rename source files
    if (fs.existsSync(path.join(projectRoot, 'Source'))) {
      // Rename .cpp file
      const oldCppPath = path.join(projectRoot, 'Source', 'PluginTemplate.cpp');
      const newCppPath = path.join(projectRoot, 'Source', `${projectName}.cpp`);
      if (fs.existsSync(oldCppPath)) {
        fs.renameSync(oldCppPath, newCppPath);
        logMessage(`Renamed source file to ${projectName}.cpp`);
      }

      // Rename .h file
      if (fs.existsSync(path.join(projectRoot, 'Source', 'Public'))) {
        const oldHPath = path.join(projectRoot, 'Source', 'Public', 'PluginTemplate.h');
        const newHPath = path.join(projectRoot, 'Source', 'Public', `${projectName}.h`);
        if (fs.existsSync(oldHPath)) {
          fs.renameSync(oldHPath, newHPath);
          logMessage(`Renamed header file to ${projectName}.h`);
        }
      }
    }
  } catch (error) {
    logMessage('Error during file renaming:', error);
  }
}

function replaceLine(content, lineNumber, pattern, replacement) {
  const lines = content.split('\n');
  if (lines.length >= lineNumber) {
    lines[lineNumber - 1] = lines[lineNumber - 1].replace(pattern, replacement);
  }
  return lines.join('\n');
}

async function editFilesInDirectory(dirPath, searchString, replaceString) {
  try {
      const files = await fs.promises.readdir(dirPath);
      let totalReplacements = 0;
      let filesModified = 0;

      logMessage(`\nProcessing directory: ${dirPath}`);
      logMessage('='.repeat(50));

      // Process each file in parallel
      await Promise.all(files.map(async (file) => {
          const filePath = path.join(dirPath, file);
          const stats = await fs.promises.stat(filePath);

          if (stats.isFile()) {
              try {
                  let data = await fs.promises.readFile(filePath, 'utf8');
                  const matches = data.match(new RegExp(searchString, 'g'));
                  const matchCount = matches ? matches.length : 0;

                  if (matchCount > 0) {
                      // Show preview of changes
                      const lines = data.split('\n');
                      let changesFound = false;

                      logMessage(`\nFile: ${filePath}`);
                      logMessage(`Found ${matchCount} occurrence(s) of "${searchString}"`);

                      // Find and display lines that will be changed
                      lines.forEach((line, i) => {
                          if (line.includes(searchString)) {
                              if (!changesFound) {
                                logMessage('\nChanges:');
                                  changesFound = true;
                              }
                              logMessage(`Line ${i + 1}:`);
                              logMessage(`- ${line.trim()}`);
                              logMessage(`+ ${line.replace(new RegExp(searchString, 'g'), replaceString).trim()}`);
                              logMessage('-'.repeat(40));
                          }
                      });

                      // Perform the actual replacement
                      const updatedData = data.replace(new RegExp(searchString, 'g'), replaceString);
                      await fs.promises.writeFile(filePath, updatedData, 'utf8');

                      logMessage(`Successfully updated ${matchCount} occurrence(s)`);
                      totalReplacements += matchCount;
                      filesModified++;
                  } else {
                      logMessage(`\nFile: ${filePath}`);
                      logMessage('No occurrences found - skipping');
                  }
              } catch (err) {
                logMessage(`\nError processing ${filePath}: ${err.message}`);
              }
          }
      }));

      logMessage('\n' + '='.repeat(50));
      logMessage(`\nSummary:`);
      logMessage(`- Files scanned: ${files.length}`);
      logMessage(`- Files modified: ${filesModified}`);
      logMessage(`- Total replacements: ${totalReplacements}`);

  } catch (err) {
    logMessage(`\nERROR processing directory ${dirPath}: ${err.message}`);
  }
}

// Execute
main();