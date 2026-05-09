# XENOVA 

AI-powered chatbot with ChatGPT-style interface, real-time messaging, and conversation management.

## Features

- **Modern ChatGPT UI** - Minimalist dark theme matching ChatGPT 2024-2025 design  
- **Real-time AI Chat** - Powered by Groq AI with WebSocket support  
- **Conversation Persistence** - MongoDB database for chat history  
- **Projects & Organization** - Create and manage project-specific conversations  
- **Advanced Search** - Real-time search with auto-complete  
- **Full CRUD** - Create, read, update, and delete conversations  
- **Responsive Design** - Works on desktop and mobile  

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Socket.io Client (real-time messaging)
- CSS3 with CSS variables (theming)

**Backend:**
- Node.js + Express
- Socket.io (WebSocket server)
- MongoDB + Mongoose (database)
- Groq AI SDK (AI responses)

## Prerequisites

- Node.js 16+ and npm
- MongoDB Atlas account (free tier)
- Groq API key (free)

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/jvrycode/AI-CHAT-BOT.git
cd AI-CHAT-BOT
```

### 2. Install dependencies
```bash
npm run install-all
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
# Groq AI API Key
GROQ_API_KEY=your_groq_api_key_here



# Server Configuration
PORT=5000
NODE_ENV=development

# Client URLs
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

### 4. Get API Keys

**Groq API Key:**
1. Go to https://console.groq.com
2. Sign up for free account
3. Create an API key
4. Copy to `.env` file

**MongoDB Atlas:**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Create database user
4. Whitelist IP address (0.0.0.0/0 for development)
5. Get connection string
6. Replace username/password in `.env`

## Running the App

### Development Mode
```bash
# Start both backend and frontend
npm run dev

# OR start separately:
npm run server    # Backend on port 5000
npm run client    # Frontend on port 3000
```

### Production Mode
```bash
# Build frontend
npm run build

# Start production server
npm start
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Project Structure

```
AIChatBot/
├── client/                  # React frontend
│   ├── public/
│   └── src/
│       ├── components/      # UI components
│       │   ├── Sidebar.tsx
│       │   ├── ChatContainer.tsx
│       │   ├── ChatInputBar.tsx
│       │   └── ...
│       ├── services/        # API services
│       │   └── api.ts
│       ├── App.tsx          # Main app component
│       └── index.css        # Global styles
├── server/                  # Express backend
│   ├── config/
│   │   └── database.js      # MongoDB connection
│   ├── models/
│   │   ├── Conversation.js  # Conversation schema
│   │   └── Project.js       # Project schema
│   ├── routes/
│   │   ├── conversations.js # Conversation API
│   │   ├── projects.js      # Projects API
│   │   └── chat.js          # Chat routes
│   └── index.js             # Server entry point
├── .env                     # Environment variables
└── package.json             # Root dependencies
```

## Features in Detail

### Conversation Management
- Auto-save all conversations to MongoDB
- Real-time search across conversation titles and content
- Delete conversations with custom modal
- Auto-generated conversation titles

### Projects
- Group related conversations
- Create and manage projects
- Filter conversations by project

### Search
- Real-time search with 300ms debounce
- Searches titles and message content
- Prefix matching prioritization
- Instant results as you type

### UI/UX
- ChatGPT-style interface
- Dark theme with professional palette
- Smooth animations and transitions
- Hover effects and micro-interactions
- Three-dot menu for conversation actions
- Custom modals (no browser alerts)

## API Endpoints

### Conversations
- `GET /api/conversations` - Get all conversations
- `GET /api/conversations/:id` - Get specific conversation
- `GET /api/conversations/search?q=query` - Search conversations
- `DELETE /api/conversations/:id` - Delete conversation

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id/conversations` - Get project conversations
- `DELETE /api/projects/:id` - Delete project

### WebSocket Events
- `join-conversation` - Join conversation room
- `new-message` - Send message
- `message-received` - Receive message (user + AI)

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard

4. Update MongoDB Atlas IP whitelist to allow Vercel IPs

### Environment Variables for Production
Update your `.env` for production:
```env
NODE_ENV=production
CLIENT_URL=https://your-app.vercel.app
```

## Troubleshooting

### MongoDB Connection Issues
- Check connection string format
- Verify database user credentials
- Ensure IP whitelist includes your IP or 0.0.0.0/0
- Check network connectivity

### AI Not Responding
- Verify GROQ_API_KEY is set correctly
- Check Groq API quota/limits
- Check console for error messages

### Port Already in Use
```bash
# Kill process on port 5000
npx kill-port 5000

# Or use different port in .env
PORT=5001
```

## Development

### Available Scripts
- `npm run dev` - Start both frontend and backend
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run build` - Build frontend for production
- `npm start` - Start production server
- `npm run install-all` - Install all dependencies

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Author

[GitHub](https://github.com/jvrycode)

## Acknowledgments

- OpenAI ChatGPT UI inspiration
- Groq AI for fast AI inference
- MongoDB Atlas for database hosting
- React and Express communities

---

**Current Version:** 1.0.0 (Pre-Authentication)  
**Last Updated:** December 2024

For questions or issues, please open an issue on GitHub.
