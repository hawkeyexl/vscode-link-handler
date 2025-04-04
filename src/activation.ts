import * as vscode from 'vscode';

/**
 * This file handles the URI activation
 * VS Code protocol handler will activate the extension with a URI
 */

export async function handleUriActivation(uri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
  // Store the URI in globalState for activation
  await context.globalState.update('uri', uri.toString());
  
  // Execute the handleUri command with the URI
  await vscode.commands.executeCommand('vscode-deep-link-handler.handleUri', uri);
}