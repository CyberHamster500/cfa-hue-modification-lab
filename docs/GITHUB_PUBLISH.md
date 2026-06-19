# GitHub Publish Checklist

이 프로젝트를 GitHub에 올릴 때 사용할 체크리스트입니다.

## 1. 사전 확인

```powershell
git --version
gh --version
gh auth status
```

`git` 또는 `gh`가 없다면 먼저 설치합니다.

```powershell
winget install Git.Git
winget install GitHub.cli
```

새 터미널을 열어 PATH가 갱신된 뒤 다시 확인합니다.

## 2. 검증

```powershell
$env:PYTHONPATH="$PWD\backend"
python -m pytest backend\tests -q

cd frontend
npm install
npm run build
cd ..
```

## 3. Git 저장소 초기화

새 GitHub repository를 만든 뒤, 아래 명령의 `<OWNER>/<REPO>`와 URL을 바꿉니다.

```powershell
git init
git branch -M main
git add .gitattributes .gitignore LICENSE README.md package.json backend docs frontend
git status --short
git commit -m "Reproduce CFA hue modification estimation"
git remote add origin https://github.com/<OWNER>/<REPO>.git
git push -u origin main
```

## 4. 올리면 안 되는 것

- Dresden 원본 데이터셋
- 논문 PDF 원본
- `frontend/node_modules`
- `frontend/dist`
- `.pytest_cache`
- `__pycache__`
- 개인 IP, Tailscale 주소, 로컬 사용자 경로

