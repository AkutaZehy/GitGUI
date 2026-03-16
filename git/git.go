package git

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
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
	Name     string
	IsHead   bool
	IsRemote bool
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

		isUntracked := indexStatus == '?'

		if isUntracked {
			files = append(files, FileStatus{
				Path:        filePath,
				Status:      "untracked",
				IsStaged:    false,
				IsUntracked: true,
			})
			continue
		}

		hasIndexChange := indexStatus != ' ' && indexStatus != '?'
		hasWorkTreeChange := workTreeStatus != ' ' && workTreeStatus != '?'

		if hasIndexChange && hasWorkTreeChange {
			indexStatusStr := getStatusFromCode(rune(indexStatus))
			files = append(files, FileStatus{
				Path:        filePath,
				Status:      indexStatusStr,
				IsStaged:    true,
				IsUntracked: false,
			})

			workTreeStatusStr := getStatusFromCode(rune(workTreeStatus))
			files = append(files, FileStatus{
				Path:        filePath,
				Status:      workTreeStatusStr,
				IsStaged:    false,
				IsUntracked: false,
			})
			continue
		}

		if hasIndexChange {
			status := getStatusFromCode(rune(indexStatus))
			files = append(files, FileStatus{
				Path:        filePath,
				Status:      status,
				IsStaged:    true,
				IsUntracked: false,
			})
			continue
		}

		if hasWorkTreeChange {
			status := getStatusFromCode(rune(workTreeStatus))
			files = append(files, FileStatus{
				Path:        filePath,
				Status:      status,
				IsStaged:    false,
				IsUntracked: false,
			})
			continue
		}
	}

	return files, nil
}

func getStatusFromCode(code rune) string {
	switch code {
	case 'A':
		return "staged"
	case 'M':
		return "modified"
	case 'D':
		return "deleted"
	case 'R':
		return "renamed"
	case 'C':
		return "copied"
	case 'U':
		return "unmerged"
	default:
		return "unknown"
	}
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
	var localBranchNames []string
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		isHead := strings.HasPrefix(line, "*")
		name := strings.TrimPrefix(line, "* ")
		name = strings.TrimSpace(name)

		// Skip problematic branches
		// 1. remotes/origin/HEAD (the reference pointer, not an actual branch)
		if name == "remotes/origin/HEAD" {
			continue
		}

		// Detect if this is a remote branch
		isRemote := strings.HasPrefix(name, "remotes/")

		// For local branches, extract and store the name for duplicate filtering
		if !isRemote {
			localBranchNames = append(localBranchNames, name)
		}

		branches = append(branches, Branch{
			Name:     name,
			IsHead:   isHead,
			IsRemote: isRemote,
		})
	}

	// Filter out remote branches that have the same name as local branches
	// (happens when user checks out a remote branch, creating a local copy)
	localSet := make(map[string]bool)
	for _, name := range localBranchNames {
		localSet[name] = true
	}

	filteredBranches := make([]Branch, 0)
	for _, b := range branches {
		if b.IsRemote {
			// Extract branch name after "remotes/origin/"
			remoteName := strings.TrimPrefix(b.Name, "remotes/origin/")
			if localSet[remoteName] {
				continue // Skip this remote branch, local version exists
			}
		}
		filteredBranches = append(filteredBranches, b)
	}

	// Re-check current branch if we have one
	currentBranch, err := r.GetCurrentBranch()
	if err == nil && currentBranch != "" {
		for i := range filteredBranches {
			filteredBranches[i].IsHead = (filteredBranches[i].Name == currentBranch)
		}
	}

	return filteredBranches, nil
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

	// Handle remote branches (remotes/origin/xxx)
	if strings.HasPrefix(branchName, "remotes/") {
		// Extract the branch name after remotes/origin/
		parts := strings.SplitN(branchName, "/", 3)
		if len(parts) >= 3 {
			remoteBranch := parts[2]
			// Try to checkout existing local branch first, or create new one
			cmd = exec.Command("git", "checkout", "-b", remoteBranch, "--track", branchName)
		} else {
			cmd = exec.Command("git", "checkout", "-b", branchName)
		}
	} else {
		// Local branch - just checkout
		cmd = exec.Command("git", "checkout", branchName)
	}

	hideWindowCmd(cmd).Dir = r.Path
	_, err := cmd.Output()
	if err != nil {
		// If checkout failed, try with force
		cmd = exec.Command("git", "checkout", "-B", branchName)
		hideWindowCmd(cmd).Dir = r.Path
		_, err = cmd.Output()
	}
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

type GraphNode struct {
	Hash      string
	ShortHash string
	Message   string
	Author    string
	Date      string
	Parents   []string
	Branches  []string
	IsHead    bool
}

func (r *Repository) GetCommitGraph(limit int) ([]GraphNode, error) {
	cmd := exec.Command("git", "log", "--all", "--date=short", "--format=%H|%h|%s|%an|%ad|%P|%D", fmt.Sprintf("-%d", limit))
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var nodes []GraphNode
	lines := strings.Split(string(output), "\n")

	currentBranch, _ := r.GetCurrentBranch()

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		parts := strings.Split(line, "|")
		if len(parts) < 6 {
			continue
		}

		hash := parts[0]
		shortHash := parts[1]
		message := parts[2]
		author := parts[3]
		date := parts[4]

		var parents []string
		if parts[5] != "" {
			parents = strings.Split(parts[5], " ")
		}

		var branches []string
		if len(parts) >= 7 && parts[6] != "" {
			branchesStr := parts[6]
			branchesStr = strings.ReplaceAll(branchesStr, "HEAD ", "")
			branches = strings.Split(branchesStr, ", ")
		}

		isHead := false
		if hash == currentBranch {
			isHead = true
		}

		nodes = append(nodes, GraphNode{
			Hash:      hash,
			ShortHash: shortHash,
			Message:   message,
			Author:    author,
			Date:      date,
			Parents:   parents,
			Branches:  branches,
			IsHead:    isHead,
		})
	}

	cmd = exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	hideWindowCmd(cmd).Dir = r.Path
	headOutput, _ := cmd.Output()
	currentHead := strings.TrimSpace(string(headOutput))

	for i := range nodes {
		for _, branch := range nodes[i].Branches {
			branch = strings.TrimPrefix(branch, "origin/")
			if branch == currentHead || branch == "HEAD" {
				nodes[i].IsHead = true
				break
			}
		}
	}

	return nodes, nil
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

type DiffHunk struct {
	Index    int
	Header   string
	OldStart int
	OldLines int
	NewStart int
	NewLines int
	Lines    []HunkLine
}

type HunkLine struct {
	Index      int
	Type       string
	Content    string
	OldLineNum int
	NewLineNum int
}

func (r *Repository) GetHunks(filePath string, staged bool) ([]DiffHunk, error) {
	var cmd *exec.Cmd
	if staged {
		cmd = exec.Command("git", "diff", "--cached", "-U3", "--", filePath)
	} else {
		cmd = exec.Command("git", "diff", "-U3", "--", filePath)
	}
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	return parseHunks(string(output)), nil
}

func parseHunks(diffOutput string) []DiffHunk {
	var hunks []DiffHunk
	lines := strings.Split(diffOutput, "\n")

	var currentHunk *DiffHunk
	var lineIndex int
	hunkIndex := 0

	for _, line := range lines {
		if strings.HasPrefix(line, "@@") {
			if currentHunk != nil {
				hunks = append(hunks, *currentHunk)
			}

			// Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
			header := strings.TrimSpace(line)
			match := regexp.MustCompile(`@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@`).FindStringSubmatch(header)

			oldStart, _ := strconv.Atoi(match[1])
			oldLines := 1
			if match[2] != "" {
				oldLines, _ = strconv.Atoi(match[2])
			}
			newStart, _ := strconv.Atoi(match[3])
			newLines := 1
			if match[4] != "" {
				newLines, _ = strconv.Atoi(match[4])
			}

			currentHunk = &DiffHunk{
				Index:    hunkIndex,
				Header:   header,
				OldStart: oldStart,
				OldLines: oldLines,
				NewStart: newStart,
				NewLines: newLines,
				Lines:    []HunkLine{},
			}
			hunkIndex++
			lineIndex = 0
			continue
		}

		if currentHunk == nil {
			continue
		}

		// Skip diff headers
		if strings.HasPrefix(line, "diff") ||
			strings.HasPrefix(line, "index") ||
			strings.HasPrefix(line, "---") ||
			strings.HasPrefix(line, "+++") {
			continue
		}

		lineType := "context"
		content := line
		oldLineNum := currentHunk.OldStart + lineIndex
		newLineNum := currentHunk.NewStart + lineIndex

		if strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++") {
			lineType = "add"
			content = strings.TrimPrefix(line, "+")
			newLineNum = currentHunk.NewStart + len(currentHunk.Lines)
			for _, l := range currentHunk.Lines {
				if l.Type == "add" {
					newLineNum--
				}
			}
		} else if strings.HasPrefix(line, "-") && !strings.HasPrefix(line, "---") {
			lineType = "remove"
			content = strings.TrimPrefix(line, "-")
			oldLineNum = currentHunk.OldStart + len(currentHunk.Lines)
			for _, l := range currentHunk.Lines {
				if l.Type == "remove" {
					oldLineNum--
				}
			}
		}

		currentHunk.Lines = append(currentHunk.Lines, HunkLine{
			Index:      lineIndex,
			Type:       lineType,
			Content:    content,
			OldLineNum: oldLineNum,
			NewLineNum: newLineNum,
		})
		lineIndex++
	}

	if currentHunk != nil {
		hunks = append(hunks, *currentHunk)
	}

	return hunks
}

func (r *Repository) StageHunks(filePath string, hunkIndices []int, staged bool) error {
	var cmd *exec.Cmd
	if staged {
		cmd = exec.Command("git", "diff", "--cached", "-U0", "--", filePath)
	} else {
		cmd = exec.Command("git", "diff", "-U0", "--", filePath)
	}
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return err
	}

	hunks := parseHunksForApply(string(output))

	var patchContent string
	for _, idx := range hunkIndices {
		if idx >= 0 && idx < len(hunks) {
			patchContent += hunks[idx] + "\n"
		}
	}

	if patchContent == "" {
		return nil
	}

	tmpFile, err := os.CreateTemp("", "hunk_*.patch")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(patchContent); err != nil {
		return err
	}
	tmpFile.Close()

	if staged {
		cmd = exec.Command("git", "apply", "--cached", "--ignore-whitespace", tmpFile.Name())
	} else {
		cmd = exec.Command("git", "apply", "--ignore-whitespace", tmpFile.Name())
	}
	hideWindowCmd(cmd).Dir = r.Path
	_, err = cmd.Output()
	return err
}

func parseHunksForApply(diffOutput string) []string {
	var hunks []string
	lines := strings.Split(diffOutput, "\n")

	var currentHunk []string
	for _, line := range lines {
		if strings.HasPrefix(line, "@@") {
			if len(currentHunk) > 0 {
				hunks = append(hunks, strings.Join(currentHunk, "\n"))
			}
			currentHunk = []string{line}
		} else if len(currentHunk) > 0 {
			if strings.HasPrefix(line, "diff") ||
				strings.HasPrefix(line, "index") ||
				strings.HasPrefix(line, "---") ||
				strings.HasPrefix(line, "+++") {
				continue
			}
			currentHunk = append(currentHunk, line)
		}
	}

	if len(currentHunk) > 0 {
		hunks = append(hunks, strings.Join(currentHunk, "\n"))
	}

	return hunks
}

func (r *Repository) UnstageHunks(filePath string, hunkIndices []int) error {
	cmd := exec.Command("git", "diff", "--cached", "-U0", "--", filePath)
	hideWindowCmd(cmd).Dir = r.Path
	output, err := cmd.Output()
	if err != nil {
		return err
	}

	hunks := parseHunksForApply(string(output))

	var selectedPatch string
	for _, idx := range hunkIndices {
		if idx >= 0 && idx < len(hunks) {
			selectedPatch += hunks[idx] + "\n"
		}
	}

	tmpFile, err := os.CreateTemp("", "hunk_*.patch")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(selectedPatch); err != nil {
		return err
	}
	tmpFile.Close()

	cmd = exec.Command("git", "apply", "--reverse", "--cached", "--ignore-whitespace", tmpFile.Name())
	hideWindowCmd(cmd).Dir = r.Path
	_, err = cmd.Output()
	return err
}

func GetRecentRepositories() []string {
	return nil
}
