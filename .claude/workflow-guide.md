# Efficient Git Workflow - Claude Code + VS Code

## 🎯 Quick Reference

### Your Daily Commands

```bash
# Morning: Pull latest changes
git pull

# During work: Check status
git status

# After changes: Commit and push
git add .
git commit -m "Description of changes"
git push
```

---

## 🔄 The Workflow Loop

### When Claude Pushes Changes:

1. **You'll see**: GitLens notification or VS Code status bar shows `↓1`
2. **You do**: Click sync button OR run `git pull`
3. **Result**: Files auto-update in VS Code ✨

### When You Make Changes:

1. **Edit files** in VS Code (auto-saves)
2. **Commit** via Source Control panel or terminal
3. **Push** via sync button or `git push`
4. **Tell Claude**: "Changes pushed, please pull"

---

## 🚀 One-Time Setup for Maximum Automation

### 1. VS Code Settings

Add to your VS Code settings (`Cmd+,` → search for each):

```json
{
  "git.autofetch": true,
  "git.autofetchPeriod": 60,
  "git.confirmSync": false,
  "git.enableSmartCommit": true,
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

### 2. Install GitLens Extension

- Go to Extensions
- Search "GitLens"
- Install
- Restart VS Code

### 3. Set Default Terminal Directory (Optional)

Make terminal always open in project directory:
- Right-click `whale-pod-fresh` folder
- "Open in Terminal"
- Terminal → Preferences → Set as default

---

## 🌿 Branch Strategy

### Active Feature Branch

We work on **one branch at a time**:

```
main (stable)
  ↓
  claude/feature-name ← CURRENT WORK
```

### When Starting New Feature:

**Claude creates branch and tells you:**
```bash
git fetch origin
git checkout claude/new-feature-name
```

**You run it once, then stay on that branch.**

### When Feature Complete:

**Merge to main:**
```bash
git checkout main
git merge claude/feature-name
git push
```

---

## 🔔 Communication Protocol

### Claude Will Say:

- ✅ "Starting new feature: `claude/feature-name`"
- ✅ "Changes pushed! Run `git pull`"
- ✅ "Feature complete, ready to merge to main"

### You Should Say:

- ✅ "Pulled successfully, files updated"
- ✅ "I made changes and pushed, please pull"
- ✅ "I'm working on [description], will push when done"

---

## 🛠️ Troubleshooting

### "Your local changes would be overwritten"

```bash
# Save your changes temporarily
git stash

# Pull updates
git pull

# Restore your changes
git stash pop
```

### "Diverged branches"

```bash
# Pull with rebase (cleaner history)
git pull --rebase
```

### "Merge conflict"

1. VS Code shows conflicts with markers
2. Edit file to resolve (keep what you want)
3. Save file
4. Run: `git add .`
5. Run: `git commit`
6. Run: `git push`

### Files Not Updating in VS Code

- Click "File" → "Reload Window"
- Or press `Cmd+R`

---

## ⚡ Pro Tips

### 1. Use VS Code Source Control Panel

- Click Source Control icon (left sidebar)
- See all changes visually
- Stage, commit, push with clicks

### 2. Git Graph Extension (Optional)

- Install "Git Graph" extension
- Visual branch history
- Click to checkout branches

### 3. Terminal Shortcuts

```bash
# Quick status check
alias gs='git status'

# Quick pull
alias gp='git pull'

# Quick add, commit, push
alias gcp='git add . && git commit -m'
```

Add these to your `~/.zshrc` or `~/.bash_profile`

---

## 📊 Current Branch Info

**Check where you are:**
```bash
git branch
```

The `*` shows your current branch.

**See all branches:**
```bash
git branch -a
```

---

## ✅ Daily Checklist

**Start of day:**
- [ ] Open Terminal
- [ ] `cd ~/Documents/whale-pod-fresh`
- [ ] `git pull`
- [ ] Open VS Code

**During work:**
- [ ] Watch for GitLens notifications
- [ ] Pull when Claude pushes
- [ ] Commit your changes regularly
- [ ] Push when done

**End of day:**
- [ ] Commit any uncommitted changes
- [ ] Push to GitHub
- [ ] Tell Claude if you have work-in-progress

---

## 🎯 Goal: Zero Manual File Copying

**Never do this:**
- ❌ Copy/paste code between directories
- ❌ Manually save files from chat
- ❌ Email code back and forth

**Always do this:**
- ✅ Git pull to get Claude's changes
- ✅ Git push to share your changes
- ✅ Let VS Code auto-reload files

---

**Questions?** Check `.claude/project-status.md` for project context!
