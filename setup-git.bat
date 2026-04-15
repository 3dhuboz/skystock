@echo off
REM SkyStock FPV — Git + GitHub Setup
REM Run this from the project root: C:\Users\Steve\Desktop\GitHub\skystock

echo Cleaning up stale .git directory...
rmdir /s /q .git 2>nul

echo Initializing fresh git repo...
git init -b main

echo Adding all files...
git add .env.example .gitignore COWORK_BRIEF.md README.md db functions index.html package.json postcss.config.js public src tailwind.config.js tsconfig.json vite.config.ts wrangler.toml setup-git.bat

echo Creating initial commit...
git commit -m "Initial commit: SkyStock FPV stock footage marketplace" -m "Full-stack marketplace for FPV drone footage built with React 18, Vite, Cloudflare Workers/D1/R2, Clerk auth, PayPal Smart Buttons, and Resend email." -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo Creating GitHub repo and pushing...
gh repo create skystock --public --source=. --remote=origin --push

echo.
echo Done! Your repo should now be live at https://github.com/cupcycledrones/skystock
echo (or check 'gh repo view --web' to open it)
pause
