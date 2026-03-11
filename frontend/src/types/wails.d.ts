import { git } from '../go/models';

declare global {
    interface Window {
        go: {
            main: {
                App: {
                    OpenRepository(path: string): Promise<boolean | string>;
                    GetRepositoryPath(): Promise<string>;
                    GetStatus(): Promise<git.FileStatus[] | string>;
                    StageFile(filePath: string): Promise<string>;
                    UnstageFile(filePath: string): Promise<string>;
                    StageAll(): Promise<string>;
                    UnstageAll(): Promise<string>;
                    Commit(message: string): Promise<string>;
                    GetDiff(filePath: string, staged: boolean): Promise<string | string>;
                    GetBranches(): Promise<git.Branch[] | string>;
                    GetCurrentBranch(): Promise<string | string>;
                    CheckoutBranch(branchName: string): Promise<string>;
                    Pull(): Promise<string | string>;
                    Push(): Promise<string | string>;
                    Fetch(): Promise<string | string>;
                    GetLog(limit: number): Promise<git.Commit[] | string>;
                    DiscardChanges(filePath: string): Promise<string>;
                    GetFileContent(filePath: string): Promise<[string, string]>;
                    OpenDirectoryDialog(): Promise<string>;
                    OpenTerminal(): Promise<string>;
                };
            };
        };
    }
}

export {};
