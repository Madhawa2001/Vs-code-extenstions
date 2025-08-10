Here’s a filled-in `README.md` tailored for your **Inverse File Tree Generator** extension:

---

# Inverse File Tree Generator

**Inverse File Tree Generator** is a VS Code extension that lets you take a **text-based file tree description** and instantly generate the corresponding folders and files inside your current workspace — all without overwriting anything you already have.

This is the **reverse** of file tree visualizers: instead of reading your folder structure, it creates one for you from text.

---

## Features

- **Multiple Tree Format Support**
  Detects and parses common file tree notations automatically, including:

  - `tree` command style (`├──`, `└──`, `│`)
  - ASCII style (`|--`, `` `--``)
  - Indentation-based style (spaces or tabs)
  - Dot-based style (same # of . for same directory)
  - Markdown code blocks with any of the above

- **Preserves Existing Files**
  Never overwrites files that already exist — keeps your existing work safe.

- **Optional Inline File Content**
  Supports specifying initial file content in the tree:

  ```
  README.md: # My Project
  ```

- **Preview Before Creation**
  ![alt text](<Screenshot (343).png>)
  ![alt text](<Screenshot (344).png>)

- **Base Directory Choice**
  Option to generate structure in the workspace root or a custom folder.

---

### Example

**Input:**

```
my-project/
├── src/
│   ├── index.js
│   └── utils/
│       └── helper.js
├── package.json
└── README.md: # My Project
```

**Result:**
Creates:

```
my-project/
  src/
    index.js
    utils/
      helper.js
  package.json
  README.md (with "# My Project" inside)
```

---

## Requirements

- VS Code version 1.75.0 or higher
- Node.js installed (for extension runtime)

No extra dependencies are required.

---

## Extension Settings

This extension contributes the following settings:

- `inverseFileTreeGenerator.overwritePolicy`:
  How to handle existing files.

  - `"skip"` (default) — Do not overwrite
  - `"prompt"` — Ask before overwriting
  - `"overwrite"` — Always overwrite

- `inverseFileTreeGenerator.baseDirectory`:
  Path (relative to workspace root) where files should be generated.

---

## Known Issues

- Mixed indentation styles in indentation-based trees may cause parsing errors.
- Tree detection may fail if custom ASCII symbols are used that differ from standard ones.

---

## Release Notes

### 1.0.0

- Initial release
- Supports multiple file tree formats
- Skips overwriting existing files
- Optional inline file content
- Preview before creation

---

## Following extension guidelines

We follow [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines) to ensure best practices.

---

## For more information

- [VS Code Extension Docs](https://code.visualstudio.com/api)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

---

**Enjoy creating projects instantly from text-based file trees!**

---
