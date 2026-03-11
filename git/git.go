package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

type Repository struct {
	Path string
}

func hideWindowCmd(cmd *exec.Cmd) *exec.Cmd {
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: 0x08000000, // CREATE_NO_WINDOW
		}
	}
	// Set git output encoding to UTF-8 for proper Chinese display
	cmd.Env = append(os.Environ(), "GIT_OUTPUT_ENCODING=utf-8")
	return cmd
}

type FileStatus struct {
	Path        string
	Status      string // untracked, modified, staged, deleted, renamed
	IsStaged    bool
	IsUntracked bool
}

type Commit struct {
	Hash    string
	Message string
	Author  string
	Date    string
}

type Branch struct {
	Name   string
	IsHead bool
}

type DiffResult struct {
	Content string
	File    string
}

func OpenRepository(path string) (*Repository, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}

	gitDir := filepath.Join(absPath, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		return nil, err
	}

	return &Repository{Path: absPath}, nil
}

func (r *Repository) GetStatus() ([]FileStatus, error) {
	cmd := exec.Command("git", "status", "--porcelain", "-uall")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var files []FileStatus
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if len(line) < 3 {
			continue
		}

		indexStatus := line[0]
		workTreeStatus := line[1]
		filePath := strings.TrimSpace(line[3:])
		if filePath == "" {
			filePath = strings.TrimSpace(line[2:])
		}

		status := ""
		isStaged := indexStatus != ' ' && indexStatus != '?'
		isUntracked := indexStatus == '?'

		switch indexStatus {
		case 'A':
			status = "staged"
		case 'M':
			status = "modified"
		case 'D':
			status = "deleted"
		case 'R':
			status = "renamed"
		case 'C':
			status = "copied"
		case 'U':
			status = "unmerged"
		case '?':
			status = "untracked"
		default:
			if workTreeStatus == 'M' {
				status = "modified"
			} else if workTreeStatus == 'D' {
				status = "deleted"
			}
		}

		if isUntracked {
			status = "untracked"
		}

		files = append(files, FileStatus{
			Path:        filePath,
			Status:      status,
			IsStaged:    isStaged,
			IsUntracked: isUntracked,
		})
	}

	return files, nil
}

func (r *Repository) StageFile(filePath string) error {
	cmd := exec.Command("git", "add", filePath)
	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) UnstageFile(filePath string) error {
	cmd := exec.Command("git", "reset", "HEAD", "--", filePath)
	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) StageAll() error {
	cmd := exec.Command("git", "add", "-A")
	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) UnstageAll() error {
	cmd := exec.Command("git", "reset", "HEAD")
	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) Commit(message string) error {
	cmd := exec.Command("git", "commit", "-m", message)
	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) GetDiff(filePath string, staged bool) (string, error) {
	var cmd *exec.Cmd
	if staged {
		cmd = exec.Command("git", "diff", "--cached", "--", filePath)
	} else {
		cmd = exec.Command("git", "diff", "--", filePath)
	}
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	// Check if the diff contains binary file markers
	diffContent := string(output)
	if strings.Contains(diffContent, "Binary files") || strings.Contains(diffContent, "GIT binary patch") {
		return "BINARY:" + filePath, nil
	}

	return diffContent, nil
}

func (r *Repository) GetBranches() ([]Branch, error) {
	cmd := exec.Command("git", "branch", "-a")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var branches []Branch
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		isHead := strings.HasPrefix(line, "*")
		name := strings.TrimPrefix(line, "* ")
		name = strings.TrimSpace(name)

		// Skip specific branches: remotes/origin/HEAD (the reference pointer)
		if strings.HasPrefix(name, "remotes/origin/HEAD") {
			continue
		}

		branches = append(branches, Branch{
			Name:   name,
			IsHead: isHead,
		})
	}

	// Re-check current branch if we have one
	currentBranch, err := r.GetCurrentBranch()
	if err == nil && currentBranch != "" {
		for i := range branches {
			branches[i].IsHead = (branches[i].Name == currentBranch)
		}
	}

	return branches, nil
}

func (r *Repository) GetCurrentBranch() (string, error) {
	cmd := exec.Command("git", "branch", "--show-current")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		// HEAD detached state - get the commit info
		cmd2 := exec.Command("git", "rev-parse", "--short", "HEAD")
		hideWindowCmd(cmd2).Dir = r.Path
		headOutput, _ := cmd2.Output()
		head := strings.TrimSpace(string(headOutput))
		cmd3 := exec.Command("git", "describe", "--tags", "--always")
		hideWindowCmd(cmd3).Dir = r.Path
		tagOutput, _ := cmd3.Output()
		tag := strings.TrimSpace(string(tagOutput))
		if tag != "" {
			return "(detached at " + tag + ")", nil
		}
		return "(detached at " + head + ")", nil
	}
	return strings.TrimSpace(string(output)), nil
}

func (r *Repository) CheckoutBranch(branchName string) error {
	var cmd *exec.Cmd

	// Handle remote branches
	if strings.HasPrefix(branchName, "remotes/") {
		// Extract the actual branch name from remotes/origin/branch
		parts := strings.SplitN(branchName, "/", 3)
		if len(parts) >= 3 {
			localName := parts[2]
			remoteBranch := branchName
			cmd = exec.Command("git", "checkout", "-b", localName, "--track", remoteBranch)
		} else {
			cmd = exec.Command("git", "checkout", branchName)
		}
	} else {
		cmd = exec.Command("git", "checkout", branchName)
	}

	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) Pull() (string, error) {
	cmd := exec.Command("git", "pull")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func (r *Repository) Push() (string, error) {
	cmd := exec.Command("git", "push")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func (r *Repository) Fetch() (string, error) {
	cmd := exec.Command("git", "fetch", "--all")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func (r *Repository) GetLog(limit int) ([]Commit, error) {
	cmd := exec.Command("git", "log", "-"+string(rune('0'+limit)), "--pretty=format:%H|%s|%an|%ad", "--date=short")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var commits []Commit
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "|", 4)
		if len(parts) < 4 {
			continue
		}

		commits = append(commits, Commit{
			Hash:    parts[0],
			Message: parts[1],
			Author:  parts[2],
			Date:    parts[3],
		})
	}

	return commits, nil
}

func (r *Repository) GetRemotes() ([]string, error) {
	cmd := exec.Command("git", "remote")
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var remotes []string
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			remotes = append(remotes, line)
		}
	}

	return remotes, nil
}

func (r *Repository) DiscardChanges(filePath string) error {
	cmd := exec.Command("git", "checkout", "--", filePath)
	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	return err
}

func (r *Repository) GetFileContent(filePath string) (string, error) {
	fullPath := filepath.Join(r.Path, filePath)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func GetRecentRepositories() []string {
	return nil
}
