# GitHub Publish Checklist

GitHub에 올리기 전 확인할 항목입니다.

## 1. Tool Check

새 PowerShell을 열고 확인합니다.

```powershell
git --version
gh --version
python --version
npm --version
gh auth status
```

현재 작업 머신에는 다음 도구를 준비했습니다.

- Python 3.13
- Node.js LTS / npm
- GitHub CLI
- portable MinGit 경로를 사용자 PATH에 추가

`gh auth status`가 로그인되지 않았다고 나오면 다음 명령으로 로그인합니다.

```powershell
gh auth login
```

## 2. Verify

```powershell
$env:PYTHONPATH="$PWD\backend"
python -m pytest backend\tests -q
```

```powershell
cd frontend
npm run build
cd ..
```

PowerShell 실행 정책이 `npm.ps1`을 막으면 아래처럼 `npm.cmd`를 사용합니다.

```powershell
npm.cmd run build
```

## 3. Create GitHub Repository

GitHub 웹에서 빈 repository를 만들거나 GitHub CLI로 생성합니다.

추천 repository name:

```text
cfa-hue-modification-lab
```

GitHub CLI 사용 예:

```powershell
gh repo create CyberHamster500/cfa-hue-modification-lab --public --source . --remote origin --push
```

이미 GitHub에서 repository를 만들었다면 remote만 추가합니다.

```powershell
git remote add origin https://github.com/CyberHamster500/cfa-hue-modification-lab.git
git push -u origin main
```

## 4. Do Not Publish

다음 항목은 저장소에 올리지 않습니다.

- 원본 논문 PDF
- Dresden 원본 데이터셋
- `frontend/node_modules`
- `frontend/dist`
- `.pytest_cache`
- `__pycache__`
- 개인 IP, Tailscale 주소, 로컬 전용 경로

## 5. Current Commit State

현재 로컬 저장소는 다음 기능을 포함합니다.

- FastAPI backend
- React GUI
- 한국어/영어 GUI 토글
- 단일 이미지 CLI 분석 도구
- EXIF camera metadata 기반 CFA lookup
- README, MIT license, 논문 citation
