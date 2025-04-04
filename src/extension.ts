import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { z } from 'zod';
import { promisify } from 'util';

const exec = promisify(cp.exec);

// Define the schema for URL parameters using Zod
const DeepLinkParamsSchema = z.object({
  repo: z.string().url('Repository URL must be a valid URL'),
  dir: z.string().min(1, 'Directory path must not be empty'),
  branch: z.string().optional(),
  file: z.string().optional(),
  line: z.string().regex(/^\d+$/, 'Line must be a number').transform(Number).optional(),
});

type DeepLinkParams = z.infer<typeof DeepLinkParamsSchema>;

export function activate(context: vscode.ExtensionContext) {
  console.log('VS Code Deep Link Handler extension is now active');

  // Register the command to handle deep links
  const disposable = vscode.commands.registerCommand('vscode-deep-link-handler.handleUri', async (uri: vscode.Uri) => {
    try {
      await handleDeepLink(uri);
    } catch (error) {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(`Deep Link Handler Error: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`Deep Link Handler Error: Unknown error occurred`);
      }
    }
  });

  // Handle when the extension is activated by a URI
  if (context.globalState.get('uri')) {
    const uriString = context.globalState.get('uri') as string;
    const uri = vscode.Uri.parse(uriString);
    handleDeepLink(uri).catch(error => {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(`Deep Link Handler Error: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`Deep Link Handler Error: Unknown error occurred`);
      }
    });
    context.globalState.update('uri', undefined);
  }

  context.subscriptions.push(disposable);
}

export function deactivate() {}

async function handleDeepLink(uri: vscode.Uri): Promise<void> {
  // Parse the query parameters
  const queryParams = new URLSearchParams(uri.query);
  const paramsObj: Record<string, string> = {};
  
  for (const [key, value] of queryParams.entries()) {
    paramsObj[key] = value;
  }

  try {
    // Validate parameters with Zod
    const params = DeepLinkParamsSchema.parse(paramsObj);
    
    // Process the parameters
    await processRepository(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Invalid URL parameters: ${errorMessage}`);
    }
    throw error;
  }
}

async function processRepository(params: DeepLinkParams): Promise<void> {
  const targetDir = path.resolve(params.dir);
  const repoExists = fs.existsSync(targetDir);

  // Check if directory exists and is a git repository
  if (repoExists) {
    // Verify it's the correct repository
    try {
      const isGitRepo = fs.existsSync(path.join(targetDir, '.git'));
      if (!isGitRepo) {
        throw new Error(`Directory exists but is not a git repository: ${targetDir}`);
      }

      // Check if remote URL matches
      const remoteUrl = await getGitRemoteUrl(targetDir);
      const normalizedRequestedUrl = normalizeGitUrl(params.repo);
      const normalizedExistingUrl = normalizeGitUrl(remoteUrl);

      if (normalizedRequestedUrl !== normalizedExistingUrl) {
        throw new Error(`Repository mismatch. Expected: ${params.repo}, Found: ${remoteUrl}`);
      }

      vscode.window.showInformationMessage(`Repository verified: ${params.repo}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Repository verification failed: ${error.message}`);
      } else {
        throw new Error('Repository verification failed with unknown error');
      }
    }
  } else {
    // Clone the repository
    try {
      await cloneRepository(params.repo, targetDir);
      vscode.window.showInformationMessage(`Repository cloned: ${params.repo}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to clone repository: ${error.message}`);
      } else {
        throw new Error('Failed to clone repository with unknown error');
      }
    }
  }

  // Handle branch checkout
  if (params.branch) {
    try {
      await checkoutBranch(targetDir, params.branch);
      vscode.window.showInformationMessage(`Branch checked out: ${params.branch}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to checkout branch: ${error.message}`);
      } else {
        throw new Error('Failed to checkout branch with unknown error');
      }
    }
  }

  // Open the repository in VS Code
  try {
    const uri = vscode.Uri.file(targetDir);
    await vscode.commands.executeCommand('vscode.openFolder', uri);
    
    // Open the specified file if provided
    if (params.file) {
      await openFile(targetDir, params.file, params.line);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to open repository: ${error.message}`);
    } else {
      throw new Error('Failed to open repository with unknown error');
    }
  }
}

async function getGitRemoteUrl(dir: string): Promise<string> {
  const { stdout } = await exec('git config --get remote.origin.url', { cwd: dir });
  return stdout.trim();
}

function normalizeGitUrl(url: string): string {
  // Remove trailing .git if present
  let normalized = url.trim().replace(/\.git$/, '');
  
  // Handle SSH URLs (convert to HTTPS format for comparison)
  if (normalized.startsWith('git@')) {
    // Convert git@github.com:username/repo to https://github.com/username/repo
    normalized = normalized.replace(/^git@([^:]+):(.+)$/, 'https://$1/$2');
  }
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
}

async function cloneRepository(repoUrl: string, targetDir: string): Promise<void> {
  // Ensure parent directory exists
  const parentDir = path.dirname(targetDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  
  await exec(`git clone ${repoUrl} ${targetDir}`);
}

async function checkoutBranch(dir: string, branch: string): Promise<void> {
  try {
    // Try to checkout the branch
    await exec(`git checkout ${branch}`, { cwd: dir });
  } catch (error) {
    // Branch doesn't exist, try to create it
    await exec(`git checkout -b ${branch}`, { cwd: dir });
  }
}

async function openFile(repoDir: string, filePath: string, line?: number): Promise<void> {
  const fullPath = path.join(repoDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const fileUri = vscode.Uri.file(fullPath);
  const document = await vscode.workspace.openTextDocument(fileUri);
  
  const options: vscode.TextDocumentShowOptions = {};
  if (line) {
    // VS Code positions are zero-based
    options.selection = new vscode.Range(line - 1, 0, line - 1, 0);
  }
  
  await vscode.window.showTextDocument(document, options);
}