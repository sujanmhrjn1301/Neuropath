import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ModuleNode, ConfusionNode } from './graph/CustomNodes';

export default function PathGraph({ pathId, token }) {
    const navigate = useNavigate();
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const nodeTypes = useMemo(() => ({ module: ModuleNode, confusion: ConfusionNode }), []);

    useEffect(() => {
        const fetchGraph = async () => {
            try {
                const res = await fetch(`/api/learning-paths/${pathId}/graph`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                
                const newNodes = [];
                const newEdges = [];
                
                const X_SPACING = 200;
                const Y_SPACING_CONFUSION = -150; // Place confusions above the main path

                data.modules.forEach((mod, index) => {
                    // 1. Add Main Module Node
                    const modNodeId = `mod-${mod.id}`;
                    newNodes.push({
                        id: modNodeId,
                        type: 'module',
                        position: { x: index * X_SPACING, y: 0 },
                        data: { ...mod },
                    });

                    // Connect to previous module
                    if (index > 0) {
                        newEdges.push({
                            id: `e-mod-${data.modules[index-1].id}-${mod.id}`,
                            source: `mod-${data.modules[index-1].id}`,
                            target: modNodeId,
                            animated: mod.status === 'unlocked', // Animate the line leading to the current active node!
                            style: { stroke: '#89b4fa', strokeWidth: 3 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#89b4fa' }
                        });
                    }

                    // 2. Add Confusion Nodes attached to this module
                    mod.confusions.forEach((conf, cIdx) => {
                        const confNodeId = `conf-${conf.id}`;
                        newNodes.push({
                            id: confNodeId,
                            type: 'confusion',
                            // Stack them vertically if there are multiple
                            position: { x: index * X_SPACING + 10, y: Y_SPACING_CONFUSION - (cIdx * 120) },
                            data: { ...conf },
                        });

                        // Connect confusion to its parent (either the module or another confusion)
                        const sourceId = conf.parent_confusion_id ? `conf-${conf.parent_confusion_id}` : modNodeId;
                        newEdges.push({
                            id: `e-conf-${sourceId}-${confNodeId}`,
                            source: sourceId,
                            target: confNodeId,
                            sourceHandle: conf.parent_confusion_id ? null : 'top',
                            style: { stroke: '#cba6f7', strokeWidth: 2, strokeDasharray: '5 5' } // Dashed line for side-quests
                        });
                    });
                });

                setNodes(newNodes);
                setEdges(newEdges);
            } catch (err) {
                console.error("Failed to load graph", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGraph();
    }, [pathId, token]);

    const onNodeClick = (_, node) => {
        if (node.type === 'module') {
            if (node.data.status !== 'locked') {
                navigate(`/module/${node.data.id}/chat`);
            } else {
                alert("This module is locked. Complete previous modules first!");
            }
        } else if (node.type === 'confusion') {
            navigate(`/confusion/${node.data.id}`);
        }
    };

    if (isLoading) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>Loading Skill Tree...</div>;

    return (
        <div style={{ width: '100%', height: '600px', background: '#11111b', borderRadius: '12px', border: '1px solid #313244', overflow: 'hidden' }}>
            <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#313244" gap={16} />
                <Controls style={{ button: { backgroundColor: '#1e1e2e', color: '#cdd6f4', borderBottom: '1px solid #313244' } }} />
            </ReactFlow>
        </div>
    );
}
