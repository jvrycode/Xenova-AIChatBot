import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatContainer from './components/ChatContainer';
import ChatInputBar from './components/ChatInputBar';
import Auth from './components/Auth';
import { Message } from './components/ChatMessage';
import { conversationsAPI, projectsAPI } from './services/api';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface ConversationSummary {
    conversationId: string;
    title: string;
    updatedAt: string;
}

interface Project {
    projectId: string;
    name: string;
}

const ChatApp: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [conversationId, setConversationId] = useState<string>('default-conversation');
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isAITyping, setIsAITyping] = useState(false);

    const isAuthenticated = !!localStorage.getItem('token');

    // Fetch conversations and projects on mount
    useEffect(() => {
        if (isAuthenticated) {
            loadConversations();
            loadProjects();
        }
    }, [isAuthenticated]);

    const loadConversations = async () => {
        const data = await conversationsAPI.getAll();
        setConversations(data);
    };

    const loadProjects = async () => {
        const data = await projectsAPI.getAll();
        setProjects(data);
    };

    useEffect(() => {
        // Connect to WebSocket server
        const newSocket = io(API_URL);

        newSocket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
            // Join default conversation room
            newSocket.emit('join-conversation', conversationId);
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });

        // Listen for messages from server
        newSocket.on('message-received', (data: { id: number; type: string; content: string; image?: string; timestamp: string }) => {
            const newMessage: Message = {
                id: data.id.toString(),
                role: data.type === 'user' ? 'user' : 'assistant',
                content: data.content,
                image: data.image,
                timestamp: new Date(data.timestamp)
            };
            setMessages(prev => [...prev, newMessage]);

            // Refresh sidebar after AI responds (conversation is saved to DB by then)
            if (data.type === 'ai') {
                setIsAITyping(false);
                setTimeout(() => loadConversations(), 500);
            }
        });

        newSocket.on('error', (err) => {
            console.error('Socket error:', err);
            setIsAITyping(false);
        });

        // Listen for conversation updates (e.g., after an edit that truncates history)
        newSocket.on('conversation-updated', (updatedMessages: any[]) => {
            const loadedMessages: Message[] = updatedMessages.map((msg: any, index: number) => ({
                id: `${conversationId}-${index}`,
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));
            setMessages(loadedMessages);
            setTimeout(() => loadConversations(), 500);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [conversationId]);

    const handleSendMessage = (content: string, image?: string) => {
        if (socket && isConnected) {
            setIsAITyping(true);
            // Send message to server
            socket.emit('new-message', {
                conversationId: conversationId,
                message: content,
                image: image || null,
                userId: socket.id,
                isGuest: !isAuthenticated
            });
        }
    };

    const handleEditMessage = (messageId: string, newContent: string) => {
        if (socket && isConnected) {
            setIsAITyping(true);
            socket.emit('edit-message', {
                conversationId,
                messageId,
                newContent,
                isGuest: !isAuthenticated
            });
        }
    };

    const handleNewChat = () => {
        // Create new conversation
        const newConversationId = `conversation-${Date.now()}`;
        setConversationId(newConversationId);
        setMessages([]);

        // Join new conversation room
        if (socket && isConnected) {
            socket.emit('join-conversation', newConversationId);
        }

        // Reload conversations list
        if (isAuthenticated) {
            setTimeout(() => loadConversations(), 1000);
        }
    };

    const handleLoadConversation = async (id: string) => {
        const conversation = await conversationsAPI.getById(id);
        if (conversation) {
            setConversationId(conversation.conversationId);
            const loadedMessages: Message[] = conversation.messages.map((msg: any, index: number) => ({
                id: `${conversation.conversationId}-${index}`,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp)
            }));
            setMessages(loadedMessages);

            if (socket && isConnected) {
                socket.emit('join-conversation', id);
            }
        }
    };

    const handleCreateProject = async (name: string) => {
        try {
            await projectsAPI.create(name);
            await loadProjects();
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    };

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            // Reset to all conversations
            await loadConversations();
        } else {
            // Search conversations
            const results = await conversationsAPI.search(query);
            setConversations(results);
        }
    };

    return (
        <div className="app">
            <Sidebar
                isOpen={isSidebarOpen}
                isAuthenticated={isAuthenticated}
                onNewChat={handleNewChat}
                    conversations={conversations}
                    projects={projects}
                    onLoadConversation={handleLoadConversation}
                    onCreateProject={handleCreateProject}
                    onSearch={handleSearch}
                    activeConversationId={conversationId}
                    onToggleSidebar={() => setIsSidebarOpen(false)}
                    onLogout={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                    }}
                />
            <div className={`main-content ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
                {!isSidebarOpen && (
                    <button className="open-sidebar-btn" onClick={() => setIsSidebarOpen(true)} title="Open sidebar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                        </svg>
                    </button>
                )}
                <TopBar title="Chatbot" isAuthenticated={isAuthenticated} />
                <ChatContainer messages={messages} onEditMessage={handleEditMessage} isAITyping={isAITyping} />
                <ChatInputBar onSendMessage={handleSendMessage} disabled={!isConnected || isAITyping} isSidebarClosed={!isSidebarOpen} />
            </div>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Auth />} />
                <Route 
                    path="/" 
                    element={<ChatApp />} 
                />
            </Routes>
        </Router>
    );
};

export default App;
