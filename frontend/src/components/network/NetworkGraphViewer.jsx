import React, { useState } from 'react';
import { Network, Server, Smartphone, User, ShoppingBag, CreditCard, ShieldAlert } from 'lucide-react';

export function NetworkGraphViewer({ graphData, selectedEntityId, onSelectEntity, title = 'Fraud Syndicate Entity Linkage' }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
        <Network className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No network relationships detected for this entity.</p>
      </div>
    );
  }

  const { nodes, links, metrics } = graphData;

  // Calculate layout positions in a circular / radial layout
  const width = 600;
  const height = 340;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 50;

  const nodePositions = new Map();
  nodes.forEach((node, index) => {
    if (node.id === selectedEntityId || (graphData.centerEntities && graphData.centerEntities.includes(node.id))) {
      nodePositions.set(node.id, { x: centerX, y: centerY, ...node });
    } else {
      const angle = (index / (nodes.length || 1)) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      nodePositions.set(node.id, { x, y, ...node });
    }
  });

  const getNodeColor = (node) => {
    if (node.riskLevel === 'CRITICAL') return { fill: '#ef4444', stroke: '#f87171', bg: 'rgba(239, 68, 68, 0.2)' };
    if (node.riskLevel === 'HIGH') return { fill: '#f97316', stroke: '#fb923c', bg: 'rgba(249, 115, 22, 0.2)' };
    if (node.riskLevel === 'MEDIUM') return { fill: '#f59e0b', stroke: '#fbbf24', bg: 'rgba(245, 158, 11, 0.2)' };
    return { fill: '#06b6d4', stroke: '#22d3ee', bg: 'rgba(6, 182, 212, 0.2)' };
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'DEVICE': return Smartphone;
      case 'IP': return Server;
      case 'MERCHANT': return ShoppingBag;
      case 'CARD': return CreditCard;
      default: return User;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">{title}</h4>
        </div>
        {metrics && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={`px-2 py-0.5 rounded font-bold ${
              metrics.syndicateThreatLevel === 'CRITICAL_RING_DETECTED'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : metrics.syndicateThreatLevel === 'ELEVATED'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}>
              Threat: {metrics.syndicateThreatLevel || 'CLEAN'}
            </span>
            <span className="text-slate-400">
              {nodes.length} Entities / {links.length} Links
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden flex justify-center items-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-h-[300px] select-none">
          
          {/* Background Grid Pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />

          {/* Links / Edges */}
          {links.map((link, idx) => {
            const sourcePos = nodePositions.get(link.source);
            const targetPos = nodePositions.get(link.target);
            if (!sourcePos || !targetPos) return null;

            const isSharedDevice = link.relationship === 'SHARED_DEVICE';
            const strokeColor = isSharedDevice ? '#ef4444' : 'rgba(148, 163, 184, 0.3)';
            const strokeDash = isSharedDevice ? '4,4' : 'none';

            return (
              <g key={`link-${idx}`}>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={strokeColor}
                  strokeWidth={isSharedDevice ? 2 : 1.2}
                  strokeDasharray={strokeDash}
                />
                {/* Link Label */}
                <text
                  x={(sourcePos.x + targetPos.x) / 2}
                  y={(sourcePos.y + targetPos.y) / 2 - 4}
                  fill="#94a3b8"
                  fontSize="8"
                  textAnchor="middle"
                  className="font-mono font-medium"
                >
                  {link.relationship}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {Array.from(nodePositions.values()).map((node) => {
            const colors = getNodeColor(node);
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedEntityId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onSelectEntity && onSelectEntity(node)}
                className="cursor-pointer transition-transform"
              >
                {/* Pulse Ring for Critical Nodes */}
                {node.riskLevel === 'CRITICAL' && (
                  <circle
                    r="22"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    opacity="0.6"
                    className="animate-ping origin-center"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={isSelected ? 18 : 15}
                  fill={colors.fill}
                  stroke={isSelected ? '#ffffff' : colors.stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Node ID label */}
                <text
                  y={25}
                  fill="#e2e8f0"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  className="font-mono drop-shadow-md"
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover / Selected Entity Card Overlay */}
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 border border-slate-700 p-2.5 rounded-xl text-xs backdrop-blur-md shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${hoveredNode.riskLevel === 'CRITICAL' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
              <div>
                <span className="font-bold text-white">{hoveredNode.label || hoveredNode.id}</span>
                <span className="text-[10px] text-slate-400 ml-2 font-mono">[{hoveredNode.type}]</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-slate-400">Risk:</span>
              <span className={`font-bold ${hoveredNode.riskLevel === 'CRITICAL' ? 'text-rose-400' : 'text-cyan-400'}`}>
                {hoveredNode.riskLevel}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
