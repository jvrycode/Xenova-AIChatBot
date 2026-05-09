import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    image?: string;
    timestamp: Date;
}

interface ChatMessageProps {
    message: Message;
    onEdit?: (messageId: string, newContent: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onEdit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const [copied, setCopied] = useState(false);

    // Reset edit content if the message changes (e.g. switching conversations)
    useEffect(() => {
        setEditContent(message.content);
        setIsEditing(false);
    }, [message.content, message.id]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleSave = () => {
        if (editContent.trim() && editContent.trim() !== message.content && onEdit) {
            onEdit(message.id, editContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(message.content);
        setIsEditing(false);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className={`chat-message ${message.role}`}>
            <div className="message-content">
                {isEditing ? (
                    <div className="edit-container">
                        <textarea 
                            value={editContent} 
                            onChange={(e) => setEditContent(e.target.value)}
                            className="edit-textarea"
                            autoFocus
                        />
                        <div className="edit-actions">
                            <button className="edit-btn save" onClick={handleSave}>Save & Submit</button>
                            <button className="edit-btn cancel" onClick={handleCancel}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={`message-text ${message.role === 'assistant' ? 'markdown-body' : ''}`}>
                            {message.role === 'assistant' ? (
                                <ReactMarkdown
                                    components={{
                                        code({ node, inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            return !inline && match ? (
                                                <div className="code-block-wrapper">
                                                    <div className="code-block-header">
                                                        <span>{match[1]}</span>
                                                        <button 
                                                            className="code-copy-btn"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                                                            }}
                                                        >
                                                            Copy
                                                        </button>
                                                    </div>
                                                    <SyntaxHighlighter
                                                        {...props}
                                                        children={String(children).replace(/\n$/, '')}
                                                        style={vscDarkPlus}
                                                        language={match[1]}
                                                        PreTag="div"
                                                        customStyle={{
                                                            margin: 0,
                                                            borderTopLeftRadius: 0,
                                                            borderTopRightRadius: 0,
                                                            borderBottomLeftRadius: '6px',
                                                            borderBottomRightRadius: '6px',
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <code {...props} className={className}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            ) : (
                                message.content
                            )}
                        </div>
                        {message.image && (
                            <div className="message-image-container">
                                <img src={message.image} alt="Attached" className="message-image" />
                            </div>
                        )}
                        <div className="message-footer">
                            <div className="message-timestamp">{formatTime(message.timestamp)}</div>
                            <div className="message-actions">
                                <button className="icon-btn" onClick={handleCopy} title="Copy message">
                                    {copied ? (
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    )}
                                </button>
                                {message.role === 'user' && onEdit && (
                                    <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit message">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;
