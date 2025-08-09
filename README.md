# code-analyzer-online

VS Code extension to generate detailed rationale documents from code analysis metadata.  
Supports offline formatting and optional AI-enhanced rationale generation via Google Gemini API.

---

## Overview

This extension analyzes your source code files or entire workspace, collecting function/class metrics and snippets, and generates Markdown rationale documents that explain:

- Purpose of functions and classes  
- Design decisions and trade-offs  
- Possible origin prompts  
- Inspirations and references  
- Improvement suggestions  

It helps developers and reviewers quickly understand codebases with minimal manual effort.

---

## Features

- Analyze current open file or entire workspace  
- Supports advanced metrics like cyclomatic complexity and call graphs  
- Generates clean Markdown rationale documents  
- Optional AI mode using Google Gemini (requires API key)  
- Configurable workspace scanning options  

---

## Commands

| Command                       | Description                       |
| -----------------------------|---------------------------------|
| `Rationale: Analyze current file`     | Generate rationale for active file  |
| `Rationale: Analyze workspace`         | Generate rationale for entire workspace |

---

## Configuration Settings

| Setting                    | Type    | Default          | Description                                             |
|----------------------------|---------|------------------|---------------------------------------------------------|
| `rationale.aiEnabled`       | boolean | `false`          | Enable AI mode. Sends code snippets to configured AI provider. |
| `rationale.geminiApiKey`    | string  | `""` (empty)     | API key for Google Gemini AI. Leave empty to disable AI mode. |
| `rationale.geminiModel`     | string  | `"gemini-2.0-flash"` | Gemini model to use when AI mode is enabled.            |
| `rationale.includeNodeModules` | boolean | `false`      | Include `node_modules` when scanning the workspace.     |

---

## Installation

1. Clone this repository:  
   ```bash
   git clone https://github.com/yourusername/code-analyzer-online.git
   cd code-analyzer-online
1. Install dependencies and build:  
   ```bash
   npm install
   npm run build

## Configuration: Adding Your Gemini API Key

To enable AI-powered rationale generation with Google Gemini, add your API key and optionally specify the model in your VS Code `settings.json`.

Open VS Code, then open your user or workspace `settings.json` (via **File > Preferences > Settings** → click `{}` icon top right), and add:

```json
{
  "rationale.aiEnabled": true,
  "rationale.geminiApiKey": "YOUR_GOOGLE_GEMINI_API_KEY_HERE",
  "rationale.geminiModel": "gemini-2.0-flash"
}
