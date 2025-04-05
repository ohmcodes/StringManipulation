import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { replaceInFile } from 'replace-in-file';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Add these lines for __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure paths
const projectRoot = path.join(__dirname, '..');
//const sourceDir = path.join(projectRoot, 'Source');
//const publicDir = path.join(sourceDir, 'Public');

// // Set up readline interface
// const rl = readline.createInterface({
  // input: process.stdin,
  // output: process.stdout
// });

const rl = createInterface({ input, output });

// Main function
async function main() {
  try {
    const [projectName, projectDesc] = process.argv.slice(2);
    console.log(projectName, projectDesc, projectRoot);
	  //const { projectName, projectDesc, projectRoot } = await getUserInput();
    // const projectRoot = "C:\\Users\\ohmco\\Desktop\\AsaApi.Plugins.Template - Copy"
    // const projectName = 'TestProject';
    // const projectDesc = 'A Super simple Plugin that actually works';
    //const projectName = await getProjectName();
    const lowercaseName = projectName.toLowerCase();
	
    // Phase 1: Modify file contents
    await modifyVcpkgJson(lowercaseName, projectRoot);
    await modifySolutionFile(projectName, projectRoot);
    await modifyFilterFile(projectName, projectRoot);
    await modifyProjectFile(projectName, projectRoot);

    // phase 2: global replacement
    await sourceReplace(projectName, projectRoot);

    await pluginInfoReplace(projectRoot, projectName, projectDesc) 
    
    // phase 3: rename files (last step)
    await renameFiles(projectName, projectRoot);
    
    console.log(`\nProject successfully renamed to ${projectName}!`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
  }
}

async function getUserInput() {
  try {
    // Get project name
    const projectName = await new Promise((resolve) => {
      rl.question('Enter Project name (e.g., "Project1"): ', (name) => {
        resolve(name.trim());
      });
    });

    if (!projectName) {
      throw new Error('Project name cannot be empty!');
    }

    const projectDesc = await new Promise((resolve) => {
      rl.question('Enter Project Description: ', (name) => {
        resolve(name.trim());
      });
    });

    // Get project root path
    const projectRoot = await new Promise((resolve) => {
      rl.question('Enter project root directory path: ', (rootPath) => {
        // Remove any surrounding quotes and normalize path
        const cleanPath = rootPath.trim().replace(/^["']|["']$/g, '');
        resolve(path.resolve(cleanPath));
      });
    });

    // Validate path exists
    if (!fs.existsSync(projectRoot)) {
      throw new Error(`Directory does not exist: ${projectRoot}\n` +
                     `Please enter the full path without quotes, like: C:\\Users\\name\\Desktop\\Folder Name`);
    }

    return { projectName, projectDesc, projectRoot };
  } finally {
    rl.close();
  }
}

// not using
/*
async function getProjectName() {
  const rl = createInterface({ input, output });
  
  return new Promise((resolve) => {
    rl.question('Enter Project name (e.g., "Project1"): ', (name) => {
      rl.close();
      resolve(name);
    });
  });
}
*/

async function modifyVcpkgJson(lowercaseName, projectRoot) {
	console.log(projectRoot);
  const filePath = path.join(projectRoot, 'vcpkg.json');
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found. Skipping...`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /"name": "asa-api-plugin-template"/,
    `"name": "asa-api-plugin-${lowercaseName}"`
  );
  fs.writeFileSync(filePath, updated);
  console.log(`Updated vcpkg.json name to ${lowercaseName}`);
}

async function modifySolutionFile(projectName, projectRoot) {
  const filePath = path.join(projectRoot, 'PluginTemplate.sln');
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found. Skipping...`);
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
  console.log('Updated PluginTemplate.sln');
}

async function modifyFilterFile(projectName, projectRoot) {
  const filePath = path.join(projectRoot, 'AsaApi.Plugins.Template.vcxproj.filters');
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found. Skipping...`);
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
  console.log('Updated AsaApi.Plugins.Template.vcxproj.filters');
}

async function modifyProjectFile(projectName, projectRoot) {
  const filePath = path.join(projectRoot, 'AsaApi.Plugins.Template.vcxproj');
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found. Skipping...`);
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
  console.log('Updated AsaApi.Plugins.Template.vcxproj');
}

async function sourceReplace(projectName, projectRoot){
  const files =[
    path.join(projectRoot, 'Source'),
    path.join(projectRoot, 'Source', 'Public')
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      editFilesInDirectory(file, "PluginTemplate", projectName);
    }
  }
}

async function pluginInfoReplace(projectRoot, projectDesc) {
  const config_path = path.join(projectRoot, 'Configs');
  editFilesInDirectory(config_path, "PluginTemplate", projectName);

  //replace description in PluginInfo.json
  editFilesInDirectory(config_path, "A Super simple Plugin that actually works", projectDesc);
  
}

// has errors try to find new code
async function globalReplace(projectName, projectRoot) {
  try {
    const results = await replaceInFile({
      files: [
        projectRoot,
        path.join(projectRoot, 'Source', '*.h'),
		path.join(projectRoot, 'Source', '*.cpp'),
        path.join(projectRoot, 'Source', 'Public','PluginTemplate.h'),
		path.join(projectRoot, 'Configs', 'PluginInfo.json')
      ].filter(fs.existsSync),
      from: /PluginTemplate/g,
      to: projectName,
	   countMatches: true,
	   disableGlobs: false,
	   allowEmptyPaths: true,
	   dry: false
    });
    console.log(`Global replacement completed. ${results.length} files processed.`);
  } catch (error) {
    console.error('Error during global replacement:', error);
  }
}

async function renameFiles(projectName, projectRoot) {
  try {
    // Rename solution file
    const oldSolutionPath = path.join(projectRoot, 'PluginTemplate.sln');
    const newSolutionPath = path.join(projectRoot, `${projectName}.sln`);
    if (fs.existsSync(oldSolutionPath)) {
      fs.renameSync(oldSolutionPath, newSolutionPath);
      console.log(`Renamed solution file to ${projectName}.sln`);
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
        console.log(`Renamed ${file} to ${path.basename(newPath)}`);
      }
    }

    // Rename source files
    if (fs.existsSync(path.join(projectRoot, 'Source'))) {
      // Rename .cpp file
      const oldCppPath = path.join(projectRoot, 'Source', 'PluginTemplate.cpp');
      const newCppPath = path.join(projectRoot, 'Source', `${projectName}.cpp`);
      if (fs.existsSync(oldCppPath)) {
        fs.renameSync(oldCppPath, newCppPath);
        console.log(`Renamed source file to ${projectName}.cpp`);
      }

      // Rename .h file
      if (fs.existsSync(path.join(projectRoot, 'Source', 'Public'))) {
        const oldHPath = path.join(projectRoot, 'Source', 'Public', 'PluginTemplate.h');
        const newHPath = path.join(projectRoot, 'Source', 'Public', `${projectName}.h`);
        if (fs.existsSync(oldHPath)) {
          fs.renameSync(oldHPath, newHPath);
          console.log(`Renamed header file to ${projectName}.h`);
        }
      }
    }
  } catch (error) {
    console.error('Error during file renaming:', error);
  }
}

function replaceLine(content, lineNumber, pattern, replacement) {
  const lines = content.split('\n');
  if (lines.length >= lineNumber) {
    lines[lineNumber - 1] = lines[lineNumber - 1].replace(pattern, replacement);
  }
  return lines.join('\n');
}

function editFilesInDirectory(dirPath, searchString, replaceString) {
    // Read the contents of the directory
    fs.readdir(dirPath, (err, files) => {
        if (err) {
          return console.error(`Unable to scan directory: ${err}`);
        }

        // Loop through each file/directory in the current directory
        files.forEach((file) => {
            const filePath = path.join(dirPath, file);
            // Check if the current path is a directory or a file
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Unable to get stats for file: ${filePath} - ${err}`);
                    return;
                }

                if (stats.isDirectory()) {
                    // If it's a directory, recursively call the function
                    //editFilesInDirectory(filePath, searchString, replaceString);
                } else if (stats.isFile()) {
                    // If it's a file, read the file content
                    fs.readFile(filePath, 'utf8', (err, data) => {
                        if (err) {
                          console.log(`ERROR: Unable to read file: ${filePath} - ${err}`);
                            return;
                        }

                        // Check if the search string exists in the file
                        if (data.includes(searchString)) {
                            // Replace the search string with the replace string
                            const updatedData = data.replace(new RegExp(searchString, 'g'), replaceString);

                            // Write the updated content back to the file
                            fs.writeFile(filePath, updatedData, 'utf8', (err) => {
                                if (err) {
                                    console.error(`ERROR: Unable to write file: ${filePath} - ${err}`);
                                    return;
                                }
                                console.log(`UPDATED: ${filePath}`);
                            });
                        } else {
                            // If the search string is not found, skip the file
                            console.log(`SKIPPED: ${filePath} (String not found)`);
                        }
                    });
                }
            });
        });
    });
}
























// Execute
main();