# GitHub Publish Checklist

Checklist before publishing this repository to GitHub.

## 1. Tool Check

Open a new PowerShell session and verify the tools:

```powershell
git --version
gh --version
python --version
npm --version
gh auth status
```

Expected tools:

- Python
- Node.js LTS / npm
- Git or portable MinGit
- GitHub CLI

If `gh auth status` reports that you are not logged in, run:

```powershell
gh auth login
```

## 2. Verify

Backend:

```powershell
$env:PYTHONPATH="$PWD\backend"
python -m pytest backend\tests -q
```

Optional frontend build:

```powershell
cd frontend
npm run build
cd ..
```

If PowerShell execution policy blocks `npm.ps1`, use:

```powershell
npm.cmd run build
```

## 3. Create GitHub Repository

Recommended repository name:

```text
cfa-hue-modification-lab
```

GitHub CLI example:

```powershell
gh repo create CyberHamster500/cfa-hue-modification-lab --public --source . --remote origin --push
```

If the repository already exists on GitHub, add the remote and push:

```powershell
git remote add origin https://github.com/CyberHamster500/cfa-hue-modification-lab.git
git push -u origin main
```

## 4. Do Not Publish

Do not commit:

- original paper PDFs;
- original Dresden or other external datasets;
- `frontend/node_modules`;
- `frontend/dist`;
- `.pytest_cache`;
- `__pycache__`;
- personal IP addresses, Tailscale addresses, or local-only paths.

## 5. Expected Scope

The public repository should contain:

- FastAPI backend;
- optional React demo;
- single-image CLI analysis;
- RAW ablation CLI;
- EXIF camera metadata based CFA lookup;
- README, MIT license, and paper citations.
