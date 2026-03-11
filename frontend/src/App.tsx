import { useState } from 'react';
import './App.css';
import { git } from '../wailsjs/go/models';

function App() {
  const [repoPath, setRepoPath] = useState('');
  const [files, setFiles] = useState<git.FileStatus[]>([]);
  const [branches, setBranches] = useState<git.Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [selectedFile, setSelectedFile] = useState<git.FileStatus | null>(null);
  const [diff, setDiff] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [splitPosition, setSplitPosition] = useState({ left: '20%', middle: '70%' });
  const [dragTarget, setDragTarget] = useState<'left' | 'middle' | null>(null);
  const [tip, setTip] = useState('');

  const handleMouseDown = (target: 'left' | 'middle') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragTarget(target);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragTarget) return;
    const totalWidth = window.innerWidth;
    const percentage = (e.clientX / totalWidth) * 100;
    if (dragTarget === 'left') {
      const newLeft = Math.max(10, Math.min(40, percentage));
      setSplitPosition(prev => ({ ...prev, left: `${newLeft}%` }));
    } else if (dragTarget === 'middle') {
      const newMiddle = Math.max(parseFloat(splitPosition.left) + 20, Math.min(90, percentage));
      setSplitPosition(prev => ({ ...prev, middle: `${newMiddle}%` }));
    }
  };

  const handleMouseUp = () => {
    setDragTarget(null);
  };

  const loadStatus = async () => {
    if (!repoPath) return;
    try {
      const result = await window.go.main.App.GetStatus();
      console.log("GetStatus result:", result);
      
      // Wails v2: if function returns ([]T, error), success returns array directly
      // error is returned as a rejected promise
      if (Array.isArray(result)) {
        setFiles(result || []);
        setError('');
      } else if (typeof result === 'string' && result) {
        setError(result);
      } else {
        setFiles([]);
      }
    } catch (e) {
      console.error("GetStatus error:", e);
      setError(String(e));
    }
  };

  const loadBranches = async () => {
    try {
      const result = await window.go.main.App.GetBranches();
      console.log("GetBranches result:", result);
      
      // Success returns array directly, error throws exception
      if (Array.isArray(result)) {
        setBranches(result || []);
      } else if (typeof result === 'string' && result) {
        console.log("GetBranches error:", result);
        setError(result);
      } else {
        setBranches([]);
      }
      
      // Get current branch separately
      try {
        const currResult = await window.go.main.App.GetCurrentBranch();
        console.log("GetCurrentBranch result:", currResult);
        
        if (typeof currResult === 'string') {
          setCurrentBranch(currResult || '');
        } else if (Array.isArray(currResult)) {
          setCurrentBranch(currResult[0] || '');
        }
      } catch (e) {
        console.error("GetCurrentBranch error:", e);
      }
      
      setError('');
    } catch (e) {
      console.error("loadBranches error:", e);
      setError(String(e));
    }
  };

  const loadDiff = async (file: git.FileStatus) => {
    setSelectedFile(file);
    setError('');
    try {
      // For untracked files, directly read file content
      if (file.Status === 'untracked') {
        const contentResult = await window.go.main.App.GetFileContent(file.Path);
        const [content, contentErr] = Array.isArray(contentResult) ? [contentResult[0], contentResult[1]] : [contentResult, null];
        if (contentErr || !content) {
          setError(contentErr || 'Cannot read file');
          return;
        }
        
        // Check if file appears to be binary
        const isBinary = content.includes('\x00') || 
          file.Path.match(/\.(png|jpg|jpeg|gif|ico|exe|dll|so|dylib|zip|rar|7z|pdf|docx|xlsx|pptx|doc|xls|ppt)$/i);
        
        if (isBinary) {
          setDiff(`Binary file: ${file.Path}\n\nThis file cannot be previewed.`);
          return;
        }
        
        const lines = content.split('\n');
        const formattedDiff = `diff --git a/${file.Path} b/${file.Path}\nnew file mode 100644\n--- /dev/null\n+++ b/${file.Path}\n@@ -0,0 +${lines.length} @@\n${lines.map((line: string) => '+' + line).join('\n')}`;
        setDiff(formattedDiff);
        return;
      }

      const result = await window.go.main.App.GetDiff(file.Path, file.IsStaged);
      const [diffContent, err] = Array.isArray(result) ? [result[0], result[1]] : [result, null];
      if (err) {
        // Check if it's a binary file
        if (err.startsWith('BINARY:')) {
          setDiff(`Binary file: ${file.Path}\n\nThis file cannot be previewed.`);
          return;
        }
        setError(err);
        return;
      }
      setDiff(diffContent || '');
    } catch (e) {
      console.error("GetDiff error:", e);
      setError(String(e));
    }
  };

  const openRepository = async () => {
    try {
      const path = await window.go.main.App.OpenDirectoryDialog();
      if (!path) return;
      
      setLoading(true);
      const success = await window.go.main.App.OpenRepository(path);
      setLoading(false);
      
      if (typeof success === 'string') {
        setError(success);
        return;
      }
      
      if (!success) {
        setError("Failed to open repository");
        return;
      }
      
      // Reset all state for new repository
      setRepoPath(path);
      setFiles([]);
      setBranches([]);
      setCurrentBranch('');
      setSelectedFile(null);
      setDiff('');
      setError('');
      await loadStatus();
      await loadBranches();
    } catch (e) {
      console.error("Error opening repository:", e);
      setError(String(e));
      setLoading(false);
    }
  };

  const handleStage = async (file: git.FileStatus) => {
    try {
      const err = await window.go.main.App.StageFile(file.Path);
      if (err) {
        setError(err);
        return;
      }
      await loadStatus();
      if (selectedFile?.Path === file.Path) {
        await loadDiff({ ...file, IsStaged: true } as git.FileStatus);
      }
    } catch (e) {
      console.error("StageFile error:", e);
      setError(String(e));
    }
  };

  const handleUnstage = async (file: git.FileStatus) => {
    try {
      const err = await window.go.main.App.UnstageFile(file.Path);
      if (err) {
        setError(err);
        return;
      }
      await loadStatus();
      if (selectedFile?.Path === file.Path) {
        await loadDiff({ ...file, IsStaged: false } as git.FileStatus);
      }
    } catch (e) {
      console.error("UnstageFile error:", e);
      setError(String(e));
    }
  };

  const handleStageAll = async () => {
    try {
      const err = await window.go.main.App.StageAll();
      if (err) {
        setError(err);
        return;
      }
      await loadStatus();
    } catch (e) {
      console.error("StageAll error:", e);
      setError(String(e));
    }
  };

  const handleUnstageAll = async () => {
    try {
      const err = await window.go.main.App.UnstageAll();
      if (err) {
        setError(err);
        return;
      }
      await loadStatus();
    } catch (e) {
      console.error("UnstageAll error:", e);
      setError(String(e));
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message cannot be empty');
      return;
    }
    
    try {
      const err = await window.go.main.App.Commit(commitMessage);
      if (err) {
        setError(err);
        return;
      }
      
      setCommitMessage('');
      await loadStatus();
    } catch (e) {
      console.error("Commit error:", e);
      setError(String(e));
    }
  };

  const handlePull = async () => {
    setLoading(true);
    setTip('Pulling...');
    try {
      const result = await window.go.main.App.Pull();
      const [output, err] = Array.isArray(result) ? result : [result, null];
      if (err) {
        setError(err);
        setTip('');
      } else {
        setError('');
        setTip(output || 'Pull completed');
        setTimeout(() => setTip(''), 3000);
      }
      await loadStatus();
    } catch (e) {
      console.error("Pull error:", e);
      setError(String(e));
      setTip('');
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    setLoading(true);
    setTip('Pushing...');
    try {
      const result = await window.go.main.App.Push();
      const [output, err] = Array.isArray(result) ? result : [result, null];
      if (err) {
        setError(err);
        setTip('');
      } else {
        setError('');
        setTip(output || 'Push completed');
        setTimeout(() => setTip(''), 3000);
      }
    } catch (e) {
      console.error("Push error:", e);
      setError(String(e));
      setTip('');
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    setLoading(true);
    try {
      const result = await window.go.main.App.Fetch();
      const [output, err] = Array.isArray(result) ? result : [result, null];
      if (err) {
        setError(err);
      } else {
        setError('');
        if (output) alert(output);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (branchName: string) => {
    if (branchName === currentBranch) return;
    setTip(`Switching to ${branchName}...`);
    try {
      const err = await window.go.main.App.CheckoutBranch(branchName);
      if (err) {
        setError(err);
        setTip('');
        return;
      }
      setCurrentBranch(branchName);
      await loadBranches();
      await loadStatus();
      setSelectedFile(null);
      setDiff('');
      setError('');
      setTip(`Switched to ${branchName}`);
      setTimeout(() => setTip(''), 3000);
    } catch (e) {
      console.error("CheckoutBranch error:", e);
      setError(String(e));
      setTip('');
    }
  };

  const handleDiscard = async (file: git.FileStatus) => {
    if (!confirm(`Discard changes to ${file.Path}?`)) return;
    
    try {
      const err = await window.go.main.App.DiscardChanges(file.Path);
      if (err) {
        setError(err);
        return;
      }
      await loadStatus();
      setSelectedFile(null);
      setDiff('');
    } catch (e) {
      console.error("DiscardChanges error:", e);
      setError(String(e));
    }
  };

  const stagedFiles = files.filter(f => f.IsStaged);
  const unstagedFiles = files.filter(f => !f.IsStaged);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified': return '#e6b800';
      case 'deleted': return '#ff6b6b';
      case 'untracked': return '#51cf66';
      case 'renamed': return '#339af0';
      case 'staged': return '#51cf66';
      default: return '#868e96';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified': return 'M';
      case 'deleted': return 'D';
      case 'untracked': return 'U';
      case 'renamed': return 'R';
      case 'staged': return 'A';
      default: return '?';
    }
  };

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={openRepository} disabled={loading}>Open Repository</button>
        <div className="toolbar-right">
          <button onClick={async () => { await loadStatus(); setTip('Refreshed'); setTimeout(() => setTip(''), 2000); }} disabled={loading || !repoPath}>Refresh</button>
          <button onClick={handleFetch} disabled={loading || !repoPath}>Fetch</button>
          <button onClick={handlePull} disabled={loading || !repoPath}>Pull</button>
          <button onClick={handlePush} disabled={loading || !repoPath}>Push</button>
        </div>
      </div>

      <div className={`tip-bar ${error ? 'has-error' : ''} ${tip ? 'has-tip' : ''}`}>
        {error || tip || 'Ready'}
      </div>

      <div className="main" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div className="sidebar" style={{ width: splitPosition.left }}>
          <div className="repo-info">
            {repoPath ? (
              <>
                <div className="repo-path">{repoPath}</div>
                <div className="branch-info">
                  <span className="branch-label">Branch:</span>
                  <select 
                    value={currentBranch} 
                    onChange={(e) => handleCheckout(e.target.value)}
                    className="branch-select"
                    disabled={currentBranch.startsWith('(detached')}
                  >
                    {branches.map(b => (
                      <option key={`${b.IsRemote ? 'remote-' : 'local-'}${b.Name}`} value={b.Name}>
                        {b.IsRemote ? '🌐 ' : ''}{b.Name}
                      </option>
                    ))}
                  </select>
                  {currentBranch.startsWith('(detached') && (
                    <span className="detached-badge">Detached</span>
                  )}
                </div>
              </>
            ) : (
              <div className="no-repo">No repository opened</div>
            )}
          </div>
        </div>

        <div className="resize-handle" onMouseDown={handleMouseDown('left')}></div>

        <div className="content" style={{ width: `calc(${splitPosition.middle} - ${splitPosition.left})` }}>
          {repoPath ? (
            <div className="changes-panel">
              <div className="staged-section">
                <div className="section-header">
                  <span>Staged Changes ({stagedFiles.length})</span>
                  <button className="small-btn" onClick={handleUnstageAll} disabled={stagedFiles.length === 0}>
                    Unstage All
                  </button>
                </div>
                <div className="file-list">
                  {stagedFiles.map(file => (
                    <div 
                      key={file.Path} 
                      className={`file-item ${selectedFile?.Path === file.Path ? 'selected' : ''}`}
                      onClick={() => loadDiff(file)}
                    >
                      <span className="file-status" style={{ color: getStatusColor(file.Status) }}>
                        {getStatusIcon(file.Status)}
                      </span>
                      <span className="file-path">{file.Path}</span>
                      <button 
                        className="action-btn"
                        onClick={(e) => { e.stopPropagation(); handleUnstage(file); }}
                      >
                        -
                      </button>
                    </div>
                  ))}
                  {stagedFiles.length === 0 && <div className="empty">No staged changes</div>}
                </div>
              </div>

              <div className="unstaged-section">
                <div className="section-header">
                  <span>Changes ({unstagedFiles.length})</span>
                  <div>
                    <button className="small-btn" onClick={handleStageAll} disabled={unstagedFiles.length === 0}>
                      Stage All
                    </button>
                  </div>
                </div>
                <div className="file-list">
                  {unstagedFiles.map(file => (
                    <div 
                      key={file.Path} 
                      className={`file-item ${selectedFile?.Path === file.Path ? 'selected' : ''}`}
                      onClick={() => loadDiff(file)}
                    >
                      <span className="file-status" style={{ color: getStatusColor(file.Status) }}>
                        {getStatusIcon(file.Status)}
                      </span>
                      <span className="file-path">{file.Path}</span>
                      <div className="file-actions">
                        {file.Status !== 'untracked' && (
                          <button 
                            className="action-btn discard"
                            onClick={(e) => { e.stopPropagation(); handleDiscard(file); }}
                            title="Discard changes"
                          >
                            ×
                          </button>
                        )}
                        <button 
                          className="action-btn"
                          onClick={(e) => { e.stopPropagation(); handleStage(file); }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  {unstagedFiles.length === 0 && <div className="empty">No changes</div>}
                </div>
              </div>

              <div className="commit-section">
                <textarea
                  placeholder="Commit message..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="commit-input"
                />
                <button 
                  className="commit-btn" 
                  onClick={handleCommit}
                  disabled={stagedFiles.length === 0 || !commitMessage.trim() || loading}
                >
                  Commit ({stagedFiles.length} staged)
                </button>
              </div>
            </div>
          ) : (
            <div className="welcome">
              <h2>Welcome to GitGUI</h2>
              <p>Click "Open Repository" to get started</p>
            </div>
          )}
        </div>

        <div className="resize-handle" onMouseDown={handleMouseDown('middle')}></div>

        <div className="diff-panel">
          {selectedFile ? (
            <>
              <div className="diff-header">
                <span>{selectedFile.Path}</span>
                <span className="diff-status" style={{ color: getStatusColor(selectedFile.Status) }}>
                  {selectedFile.Status}
                </span>
              </div>
              <DiffViewer content={diff} />
            </>
          ) : (
            <div className="no-diff">Select a file to view diff</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DiffHunk {
  header: string;
  lines: { type: 'context' | 'add' | 'remove'; content: string; lineNum?: number }[];
}

function parseDiff(content: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = content.split('\n');
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { header: line, lines: [] };
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLine = parseInt(match[1]);
        newLine = parseInt(match[2]);
      }
      continue;
    }
    if (currentHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({ type: 'add', content: line.substring(1), lineNum: newLine++ });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({ type: 'remove', content: line.substring(1), lineNum: oldLine++ });
      } else if (!line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
        currentHunk.lines.push({ type: 'context', content: line, lineNum: oldLine++ });
        newLine++;
      }
    }
  }
  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

function DiffViewer({ content }: { content: string }) {
  const [expandedHunks, setExpandedHunks] = useState<Set<number>>(new Set([0, 1, 2]));
  const [showAll, setShowAll] = useState(false);

  if (!content) return <div className="diff-empty">No changes to display</div>;

  const hunks = parseDiff(content);
  const totalLines = hunks.reduce((sum, h) => sum + h.lines.length, 0);
  const isLargeDiff = hunks.length > 3;

  const toggleHunk = (index: number) => {
    setExpandedHunks(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleShowAll = () => {
    if (showAll) {
      // Collapse back to default (first 3)
      const initial = new Set<number>();
      for (let i = 0; i < Math.min(3, hunks.length); i++) {
        initial.add(i);
      }
      setExpandedHunks(initial);
    } else {
      // Expand all
      const all = new Set<number>();
      for (let i = 0; i < hunks.length; i++) {
        all.add(i);
      }
      setExpandedHunks(all);
    }
    setShowAll(!showAll);
  };

  const displayHunks = showAll ? hunks : hunks.slice(0, 3);

  return (
    <div className="diff-viewer">
      {isLargeDiff && (
        <div className="diff-summary">
          <span>{hunks.length} hunks, {totalLines} lines</span>
          <button onClick={toggleShowAll} className="diff-expand-btn">
            {showAll ? 'Collapse' : 'Show all changes'}
          </button>
        </div>
      )}
      {displayHunks.map((hunk, hunkIndex) => {
        const isExpanded = expandedHunks.has(hunkIndex);
        return (
          <div key={hunkIndex} className="diff-hunk">
            <div className="diff-hunk-header" onClick={() => toggleHunk(hunkIndex)}>
              <span className="diff-hunk-expand">{isExpanded ? '▼' : '▶'}</span>
              <span>{hunk.header}</span>
            </div>
            {isExpanded && (
              <div className="diff-hunk-content">
                {hunk.lines.map((line, lineIndex) => (
                  <div key={lineIndex} className={`diff-line diff-${line.type}`}>
                    <span className="diff-line-num">{line.lineNum || ''}</span>
                    <span className="diff-line-prefix">{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
                    <span className="diff-line-content">{line.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
