import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

interface GraphNode {
  Hash: string;
  ShortHash: string;
  Message: string;
  Author: string;
  Date: string;
  Parents: string[];
  Branches: string[];
  IsHead: boolean;
}

const branchColors: Record<string, string> = {
  main: '#22c55e',
  master: '#22c55e',
  develop: '#3b82f6',
  dev: '#3b82f6',
  feature: '#a855f7',
  fix: '#f97316',
  bugfix: '#f97316',
  hotfix: '#ef4444',
  release: '#eab308',
};

const getBranchColor = (branch: string): string => {
  if (!branch || branch === '') {
    return '#ffffff';
  }
  if (branch.startsWith('tag:')) {
    return '#f59e0b';
  }
  const lower = branch.toLowerCase();
  for (const [key, color] of Object.entries(branchColors)) {
    if (lower.includes(key)) {
      return color;
    }
  }
  const colors = ['#14b8a6', '#8b5cf6', '#6366f1', '#3b82f6'];
  let hash = 0;
  for (let i = 0; i < branch.length; i++) {
    hash = branch.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getStringWidth = (str: string): number => {
  let width = 0;
  for (const char of str) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], maxBranchLen: number, messageWidth: number) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = Math.max(200, messageWidth * 9 + 100);
  const nodeHeight = 60;
  
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

const CommitNode = ({ data }: { data: any }) => {
  const isHead = data.IsHead;
  const branches = data.Branches || [];
  const primaryBranch = branches[0] || '';
  const branchColor = getBranchColor(primaryBranch);

  const maxBranchLen = Math.max(...branches.map((b: string) => b.length), 1);
  const charsPerLine = Math.floor(maxBranchLen * 1.2);
  const branchLines: string[][] = [];
  let currentLine: string[] = [];
  let currentLineLen = 0;

  branches.forEach((b: string) => {
    if (currentLine.length === 0) {
      currentLine.push(b);
      currentLineLen = getStringWidth(b);
    } else if (currentLineLen + getStringWidth(b) + 1 <= charsPerLine) {
      currentLine.push(b);
      currentLineLen += getStringWidth(b) + 1;
    } else {
      branchLines.push(currentLine);
      currentLine = [b];
      currentLineLen = getStringWidth(b);
    }
  });
  if (currentLine.length > 0) {
    branchLines.push(currentLine);
  }

  const msgWidth = getStringWidth(data.Message);
  const displayMessage = msgWidth > 40 ? data.Message.substring(0, Math.floor(40 * 0.5)) + '...' : data.Message;

  return (
    <div className="commit-node-container">
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div
        className="commit-circle-wrapper"
        style={{ borderColor: branchColor }}
        title={`${data.Hash}\n${data.Message}\n${data.Author} - ${data.Date}`}
      >
        <div className={`commit-circle ${isHead ? 'head' : ''}`} />
      </div>
      <div className="commit-info">
        <div className="commit-hash">{data.ShortHash}</div>
        <div className="commit-message" title={data.Message}>
          {displayMessage}
        </div>
        {branches.length > 0 && (
          <div className="commit-branches">
            {branchLines.map((line, lineIdx) => (
              <div key={lineIdx} className="branch-line">
                {line.map((b: string) => (
                  <span
                    key={b}
                    className="branch-tag"
                    style={{ backgroundColor: getBranchColor(b) }}
                  >
                    {getStringWidth(b) > maxBranchLen ? b.substring(0, Math.floor(maxBranchLen * 0.5)) + '..' : b}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
};

const nodeTypes = {
  commit: CommitNode,
};

interface BranchGraphProps {
  repoPath: string;
}

export default function BranchGraph({ repoPath }: BranchGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGraph = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError('');

    try {
      const result = await window.go.main.App.GetCommitGraph(30);
      if (typeof result === 'string') {
        setError(result);
        setLoading(false);
        return;
      }

      const graphNodes = result as any as GraphNode[];
      if (!graphNodes || graphNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        setLoading(false);
        return;
      }

      const nodeMap = new Map<string, number>();
      graphNodes.forEach((n, idx) => nodeMap.set(n.Hash, idx));

      let maxBranchLen = 0;
      let maxMessageWidth = 0;
      graphNodes.forEach((n) => {
        n.Branches?.forEach((b) => {
          if (getStringWidth(b) > maxBranchLen) maxBranchLen = getStringWidth(b);
        });
        const msgWidth = getStringWidth(n.Message);
        const effectiveWidth = Math.min(msgWidth, 40);
        if (effectiveWidth > maxMessageWidth) maxMessageWidth = effectiveWidth;
      });

      const flowNodes: Node[] = graphNodes.map((n) => ({
        id: n.Hash,
        type: 'commit',
        data: n,
        position: { x: 0, y: 0 },
        draggable: false,
      }));

      const flowEdges: Edge[] = [];
      graphNodes.forEach((n) => {
        const primaryBranch = n.Branches?.[0] || '';
        const edgeColor = getBranchColor(primaryBranch);
        
        n.Parents?.forEach((parentHash) => {
          if (nodeMap.has(parentHash)) {
            flowEdges.push({
              id: `e-${parentHash}-${n.Hash}`,
              source: parentHash,
              target: n.Hash,
              type: 'bezier',
              animated: false,
              style: { stroke: edgeColor, strokeWidth: 2 },
            });
          }
        });
      });

      const layouted = getLayoutedElements(flowNodes, flowEdges, maxBranchLen, maxMessageWidth);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [repoPath, setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  if (loading) {
    return <div className="branch-graph-loading">Loading...</div>;
  }

  if (error) {
    return <div className="branch-graph-error">{error}</div>;
  }

  if (nodes.length === 0) {
    return <div className="branch-graph-empty">No commits to display</div>;
  }

  return (
    <div className="branch-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#3c3c3c" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
