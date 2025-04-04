# VS Code Deep Link Handler

A VS Code extension that processes custom URIs to automate repository cloning, branch switching, file opening, and line navigation in a single action.

## Features

- Process custom `vscode://` URLs with parameters for repository operations
- Clone repositories to specified directories
- Verify existing repositories match the requested URL
- Switch to or create branches
- Open repositories in VS Code
- Navigate to specific files and line numbers

## Installation

1. Install the extension from the VS Code marketplace or build from source.
2. Make sure VS Code is registered as the handler for `vscode://` protocol URLs on your system.

## Usage

Create links in the following format:

```
vscode://vscode-deep-link-handler/clone?repo=[GIT_REPO_URL]&dir=[TARGET_DIRECTORY]&branch=[BRANCH_NAME]&file=[FILE_PATH]&line=[LINE_NUMBER]
```

### Parameters:

- `repo` (required): The Git repository URL to clone
- `dir` (required): The local directory where the repository should be cloned
- `branch` (optional): The branch to check out (will be created if it doesn't exist)
- `file` (optional): The file path within the repository to open
- `line` (optional): The line number to navigate to in the file

### Examples:

```
vscode://vscode-deep-link-handler/clone?repo=https://github.com/microsoft/vscode&dir=C:/Projects/vscode&branch=main&file=README.md&line=10
```

This will:

1. Clone the VS Code repository to `C:/Projects/vscode` (if it doesn't exist)
2. Verify the repository if it already exists
3. Check out the `main` branch
4. Open the README.md file
5. Navigate to line 10

## Development

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open the project in VS Code
4. Press F5 to start debugging the extension

## Building

```
npm run compile
```

## License

MIT
