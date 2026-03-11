package main

import (
	"context"
	"fmt"

	"gitgui/git"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx        context.Context
	repository *git.Repository
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OpenRepository(path string) (bool, string) {
	repo, err := git.OpenRepository(path)
	if err != nil {
		return false, err.Error()
	}
	a.repository = repo
	return true, ""
}

func (a *App) GetRepositoryPath() string {
	if a.repository == nil {
		return ""
	}
	return a.repository.Path
}

func (a *App) GetStatus() ([]git.FileStatus, string) {
	if a.repository == nil {
		return nil, "No repository opened"
	}
	files, err := a.repository.GetStatus()
	if err != nil {
		return nil, err.Error()
	}
	return files, ""
}

func (a *App) StageFile(filePath string) string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.StageFile(filePath)
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) UnstageFile(filePath string) string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.UnstageFile(filePath)
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) StageAll() string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.StageAll()
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) UnstageAll() string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.UnstageAll()
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) Commit(message string) string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.Commit(message)
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) GetDiff(filePath string, staged bool) (string, string) {
	if a.repository == nil {
		return "", "No repository opened"
	}
	diff, err := a.repository.GetDiff(filePath, staged)
	if err != nil {
		return "", err.Error()
	}
	return diff, ""
}

func (a *App) GetBranches() ([]git.Branch, string) {
	if a.repository == nil {
		return nil, "No repository opened"
	}
	branches, err := a.repository.GetBranches()
	if err != nil {
		return nil, err.Error()
	}
	return branches, ""
}

func (a *App) GetCurrentBranch() (string, string) {
	if a.repository == nil {
		return "", "No repository opened"
	}
	branch, err := a.repository.GetCurrentBranch()
	if err != nil {
		return "", err.Error()
	}
	return branch, ""
}

func (a *App) CheckoutBranch(branchName string) string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.CheckoutBranch(branchName)
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) Pull() (string, string) {
	if a.repository == nil {
		return "", "No repository opened"
	}
	output, err := a.repository.Pull()
	if err != nil {
		return output, err.Error()
	}
	return output, ""
}

func (a *App) Push() (string, string) {
	if a.repository == nil {
		return "", "No repository opened"
	}
	output, err := a.repository.Push()
	if err != nil {
		return output, err.Error()
	}
	return output, ""
}

func (a *App) Fetch() (string, string) {
	if a.repository == nil {
		return "", "No repository opened"
	}
	output, err := a.repository.Fetch()
	if err != nil {
		return output, err.Error()
	}
	return output, ""
}

func (a *App) GetLog(limit int) ([]git.Commit, string) {
	if a.repository == nil {
		return nil, "No repository opened"
	}
	commits, err := a.repository.GetLog(limit)
	if err != nil {
		return nil, err.Error()
	}
	return commits, ""
}

func (a *App) DiscardChanges(filePath string) string {
	if a.repository == nil {
		return "No repository opened"
	}
	err := a.repository.DiscardChanges(filePath)
	if err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) GetFileContent(filePath string) (string, string) {
	if a.repository == nil {
		return "", "No repository opened"
	}
	content, err := a.repository.GetFileContent(filePath)
	if err != nil {
		return "", err.Error()
	}
	return content, ""
}

func (a *App) OpenDirectoryDialog() string {
	if a.ctx == nil {
		return ""
	}
	result, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Git Repository",
	})
	if err != nil {
		return ""
	}
	return result
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
