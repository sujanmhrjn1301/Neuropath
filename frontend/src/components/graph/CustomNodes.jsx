import React from 'react';
import { Handle, Position } from '@xyflow/react';

// Base styling for the bubbles to solve the text overflow issue
const nodeStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%', // Perfect circle
    width: '120px',
    height: '120px',
    padding: '12px',
    textAlign: 'center',
    color: '#fff',
    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
    position: 'relative',
    cursor: 'pointer',
    border: '3px solid transparent'
};

const textStyle = {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    display: '-webkit-box',
    WebkitLineClamp: 3, // Limits to 3 lines
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.2'
};

export const ModuleNode = ({ data }) => {
    // Colors based on status
    const bg = data.status === 'completed' ? '#a6e3a1' : data.status === 'unlocked' ? '#89b4fa' : '#313244';
    const color = data.status === 'completed' || data.status === 'unlocked' ? '#1e1e2e' : '#a6adc8';
    const borderColor = data.status === 'unlocked' ? '#cba6f7' : 'transparent';

    return (
        <div style={{ ...nodeStyle, backgroundColor: bg, color: color, borderColor: borderColor }} title={data.title}>
            <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
            <span style={textStyle}>{data.title}</span>
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Top} id="top" style={{ opacity: 0 }} />
        </div>
    );
};

export const ConfusionNode = ({ data }) => {
    const bg = data.status === 'resolved' ? '#cba6f7' : '#f38ba8'; // Purple for resolved, Red for active
    
    return (
        <div style={{ ...nodeStyle, backgroundColor: bg, color: '#1e1e2e', width: '100px', height: '100px' }} title={data.title}>
            <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
            <span style={{ ...textStyle, fontSize: '0.75rem' }}>{data.title}</span>
        </div>
    );
};
