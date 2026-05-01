import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TextSelectionWrapper = ({ children, disabled, rootModuleId, parentConfusionId, token }) => {
    const navigate = useNavigate();
    const [capturedText, setCapturedText] = useState('');
    const [messageId, setMessageId] = useState(null);
    const [tooltipPos, setTooltipPos] = useState(null);
    const [showInput, setShowInput] = useState(false);
    const [userQuery, setUserQuery] = useState('');
    const wrapperRef = useRef(null);

    // Watch the entire document for selection changes
    useEffect(() => {
        const handleSelectionChange = () => {
            const currentText = window.getSelection().toString().trim();
            
            // If the text selection is cleared, hide the button.
            if (!currentText) {
                setShowInput((prevShowInput) => {
                    // We ONLY hide it if it's currently a 'button' (!showInput). If it's an 'input', we let them finish typing.
                    if (!prevShowInput) {
                        setTooltipPos(null);
                        setCapturedText('');
                        setMessageId(null);
                        setUserQuery('');
                    }
                    return prevShowInput;
                });
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        
        // Cleanup listener on unmount
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, []);

    useEffect(() => {
        const handleMouseUp = () => {
            if (disabled) return;

            const selection = window.getSelection();
            const text = selection.toString().trim();

            if (text && text.length > 0) {
                // Find the closest message ID
                let node = selection.anchorNode;
                if (node.nodeType === 3) node = node.parentNode; // text node -> element

                const messageElem = node.closest('[data-message-id]');
                if (!messageElem) return;

                const msgId = messageElem.getAttribute('data-message-id');
                const range = selection.getRangeAt(0).getBoundingClientRect();
                const wrapperRect = wrapperRef.current.getBoundingClientRect();

                // Calculate fixed viewport position for the tooltip
                const pos = {
                    top: range.top,
                    left: range.left + (range.width / 2)
                };

                setCapturedText(text);
                setMessageId(parseInt(msgId, 10) || msgId);
                setTooltipPos(pos);
                setShowInput(false);
                setUserQuery('');
            } else if (!showInput) {
                // If they click away and not currently typing
                clearSelection();
            }
        };

        const wrapperElement = wrapperRef.current;
        if (wrapperElement) {
            wrapperElement.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            if (wrapperElement) {
                wrapperElement.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }, [disabled, showInput]);

    const clearSelection = () => {
        setCapturedText('');
        setMessageId(null);
        setTooltipPos(null);
        setShowInput(false);
        setUserQuery('');
    };

    const handleStart = async () => {
        if (!userQuery.trim()) return;
        
        try {
            const res = await fetch('/api/confusions/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    root_module_id: rootModuleId,
                    parent_confusion_id: parentConfusionId,
                    message_id: messageId,
                    highlighted_text: capturedText,
                    user_query: userQuery.trim()
                })
            });

            if (!res.ok) throw new Error("Failed to start side-quest");
            const data = await res.json();
            
            navigate('/confusion/' + data.id);
        } catch (e) {
            console.error("Side-quest error:", e);
        } finally {
            clearSelection();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleStart();
        } else if (e.key === 'Escape') {
            clearSelection();
        }
    };

    return (
        <div ref={wrapperRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {children}

            {tooltipPos && (
                <div
                    className="selection-popup-container"
                    style={{
                        position: 'fixed',
                        // Ensure it floats cleanly ABOVE the text
                        top: tooltipPos.top - 60, 
                        left: tooltipPos.left,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        // Opaque container box
                        backgroundColor: '#1e1e2e', 
                        border: '1px solid #444',
                        borderRadius: '8px',
                        // Heavy drop shadow so it pops off the background
                        boxShadow: '0 8px 24px rgba(0,0,0,0.8)', 
                        padding: '6px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                    }}
                >
                    {!showInput ? (
                        <button
                            onMouseDown={(e) => {
                                // Use onMouseDown + preventDefault to stop the browser 
                                // from clearing the text selection when the button is clicked!
                                e.preventDefault(); 
                            }}
                            onClick={() => setShowInput(true)}
                            style={{ 
                                backgroundColor: '#ffb86c', // Solid bright accent color
                                color: '#000000', // Black text for high contrast
                                padding: '8px 16px', 
                                borderRadius: '4px', 
                                border: 'none', 
                                cursor: 'pointer', 
                                fontWeight: 'bold',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>❓</span> Confused?
                        </button>
                    ) : (
                        <>
                            <input
                                autoFocus
                                type="text"
                                placeholder="What's confusing about this?"
                                value={userQuery}
                                onChange={(e) => setUserQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ 
                                    padding: '8px 12px', 
                                    borderRadius: '4px', 
                                    border: '1px solid #555', 
                                    backgroundColor: '#0f0f17', 
                                    color: '#fff', 
                                    outline: 'none', 
                                    width: '250px' 
                                }}
                            />
                            <button
                                onClick={clearSelection}
                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStart}
                                style={{ 
                                    backgroundColor: '#50fa7b', 
                                    color: '#000000', 
                                    padding: '8px 16px', 
                                    borderRadius: '4px', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    fontWeight: 'bold' 
                                }}
                            >
                                Ask
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default TextSelectionWrapper;
