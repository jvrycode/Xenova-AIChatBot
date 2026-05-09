const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Startup diagnostics
console.log('🔍 MONGODB_URI loaded:', process.env.MONGODB_URI ? '✅ Yes' : '❌ Missing');
console.log('🔍 URI protocol:', process.env.MONGODB_URI?.substring(0, 20) + '...');
console.log('🔍 JWT_SECRET loaded:', process.env.JWT_SECRET ? '✅ Yes' : '❌ Missing');

// Database
const connectDB = require('./config/database');
const Conversation = require('./models/Conversation');
const Project = require('./models/Project');

const app = express();
const server = http.createServer(app);
const corsOptions = {
  origin: true, // Reflects the exact origin of the request (needed for credentials: true)
  credentials: true
};

const io = socketIo(server, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Import routes
const chatRoutes = require('./routes/chat');
const conversationsRoutes = require('./routes/conversations');
const projectsRoutes = require('./routes/projects');
const authRoutes = require('./routes/auth');

app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/auth', authRoutes);

// Store active conversations
const conversations = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join conversation room
  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user-typing', {
      userId: socket.id,
      isTyping: data.isTyping
    });
  });

  // Handle new messages
  socket.on('new-message', async (data) => {
    try {
      const { conversationId, message, image, userId, isGuest } = data;

      // Store user message
      if (!conversations.has(conversationId)) {
        conversations.set(conversationId, []);
      }

      const conversation = conversations.get(conversationId);
      const userMessageId = Date.now();
      const userMessage = {
        id: userMessageId,
        type: 'user',
        content: message,
        image: image || null,
        timestamp: new Date().toISOString()
      };

      conversation.push(userMessage);

      // Emit user message to all clients in the room
      io.to(conversationId).emit('message-received', userMessage);

      // Generate AI response
      const aiResponse = await generateAIResponse(message, conversation);

      // Store AI response
      const aiMessageId = Date.now() + 1;
      const aiMessage = {
        id: aiMessageId,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      conversation.push(aiMessage);

      // Emit AI response to all clients in the room
      io.to(conversationId).emit('message-received', aiMessage);

      // Save to MongoDB if connected and not a guest
      if (!isGuest) {
        try {
          let dbConversation = await Conversation.findOne({ conversationId });

          if (!dbConversation) {
            dbConversation = new Conversation({
              conversationId,
              messages: []
            });
          }

          // Add both messages
          dbConversation.messages.push({
            role: 'user',
            content: message,
            image: image || null,
            timestamp: new Date(userMessage.timestamp)
          });

          dbConversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(aiMessage.timestamp)
          });

          await dbConversation.save();
          console.log(`✅ Saved conversation ${conversationId} to database`);
        } catch (dbError) {
          console.error('❌ MongoDB save error:', dbError.message);
        }
      } else {
        console.log(`ℹ️ Skipped saving conversation ${conversationId} to database (Guest user)`);
      }

    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // Handle edit message
  socket.on('edit-message', async (data) => {
    try {
      const { conversationId, messageId, newContent, isGuest } = data;

      // Ensure conversation exists in memory
      if (!conversations.has(conversationId)) {
        // Try loading from DB if not in memory
        const dbConv = await Conversation.findOne({ conversationId });
        if (dbConv) {
          const formattedMessages = dbConv.messages.map((m, index) => ({
            id: `${conversationId}-${index}`,
            type: m.role === 'user' ? 'user' : 'ai',
            content: m.content,
            timestamp: m.timestamp.toISOString()
          }));
          conversations.set(conversationId, formattedMessages);
        } else {
           return socket.emit('error', { message: 'Conversation not found' });
        }
      }

      const conversation = conversations.get(conversationId);
      
      // Find the index of the edited message
      // Note: messageId might be the ID string from client, which we constructed as `${conversationId}-${index}`
      // OR it could be the numeric timestamp ID. We should try to find it.
      let editedIndex = -1;
      
      // Check if messageId is an index format
      if (typeof messageId === 'string' && messageId.includes('-')) {
        const parts = messageId.split('-');
        const idx = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(idx) && idx >= 0 && idx < conversation.length) {
            editedIndex = idx;
        }
      }
      
      // Fallback: search by content matching if it's the exact same message but we lost the ID mapping
      // Or just assume it's finding the first user message that matches
      if (editedIndex === -1) {
          // This fallback is risky if messages are identical, but we'll try to find by string ID match
          editedIndex = conversation.findIndex(m => String(m.id) === String(messageId));
      }

      if (editedIndex === -1) {
        return socket.emit('error', { message: 'Message to edit not found' });
      }

      // 1. Update the message content
      conversation[editedIndex].content = newContent;

      // 2. Truncate the history AFTER the edited message
      conversation.splice(editedIndex + 1);

      // Emit an intermediate update to show the user's edit immediately
      io.to(conversationId).emit('conversation-updated', conversation.map(m => ({
          role: m.type,
          content: m.content,
          timestamp: m.timestamp
      })));

      // 3. Generate new AI response based on truncated history
      // (The last message is now the edited user message)
      // The generateAIResponse expects the history EXCEPT the current message
      const historyForAI = conversation.slice(0, -1);
      const aiResponse = await generateAIResponse(newContent, historyForAI);

      // 4. Append the new AI response
      const aiMessageId = Date.now() + 1;
      const aiMessage = {
        id: aiMessageId,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };
      
      conversation.push(aiMessage);

      // 5. Update MongoDB
      if (!isGuest) {
        try {
          let dbConversation = await Conversation.findOne({ conversationId });
          
          if (dbConversation) {
            // Truncate DB messages to match our updated memory array
            // Since we reconstructed the conversation, we can just replace the whole array
            dbConversation.messages = conversation.map(m => ({
              role: m.type === 'ai' ? 'assistant' : 'user',
              content: m.content,
              timestamp: new Date(m.timestamp)
            }));
            
            await dbConversation.save();
            console.log(`✅ Saved edited conversation ${conversationId} to database`);
          }
        } catch (dbError) {
          console.error('❌ MongoDB save error during edit:', dbError.message);
        }
      } else {
        console.log(`ℹ️ Skipped saving edited conversation ${conversationId} to database (Guest user)`);
      }

      // 6. Emit the final updated conversation to the client
      io.to(conversationId).emit('conversation-updated', conversation.map(m => ({
          role: m.type,
          content: m.content,
          timestamp: m.timestamp
      })));

    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// AI Response Generation - Using Groq (Free AI)
async function generateAIResponse(message, conversationHistory) {
  try {
    // Check if Groq API key is available
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
      console.log('No Groq API key found, using mock responses');
      return getMockResponse(message, conversationHistory);
    }

    const Groq = require('groq-sdk');
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Prepare conversation context
    const messages = [
      {
        role: "system",
        content: "You are Xenova, an advanced AI assistant with a helpful, knowledgeable, and friendly personality. Provide clear, accurate, and engaging responses. Keep responses concise but informative. Be conversational and helpful."
      }
    ];

    // Add conversation history (last 10 messages, excluding current)
    const historyWithoutCurrent = conversationHistory.slice(0, -1);
    const recentHistory = historyWithoutCurrent.slice(-10);
    
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    let hasImage = false;
    const currentMsg = conversationHistory[conversationHistory.length - 1];
    
    if (currentMsg && currentMsg.image) {
      hasImage = true;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: message },
          { type: "image_url", image_url: { url: currentMsg.image } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: message
      });
    }

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: hasImage ? "llama-3.2-11b-vision-preview" : "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 500,
    });

    console.log('Using Groq AI response');
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Groq API Error:', error);
    console.log('Falling back to mock responses');
    return getMockResponse(message, conversationHistory);
  }
}

// Mock AI responses for testing
function getMockResponse(message, conversationHistory = []) {
  const lowerMessage = message.toLowerCase();
  
  // Check if the last message in history has an image
  const lastMsg = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1] : null;
  if (lastMsg && lastMsg.image) {
      return "I received your image! However, the Groq API key configured for this server currently does not have access to the Vision models (they may be disabled or restricted on this tier). Therefore, I can't analyze the image right now. But I'm still here to chat!";
  }

  // Greeting responses (use word boundaries to avoid matching substrings like "Philippines")
  if (/\b(hello|hi|hey)\b/.test(lowerMessage)) {
    return "Hello! I'm Xenova, your AI assistant. How can I help you today?";
  }

  // Help requests
  if (lowerMessage.includes('help')) {
    return "I'm here to help! What specific assistance do you need? I can help with questions, provide information, or just chat!";
  }

  // Weather queries
  if (lowerMessage.includes('weather')) {
    return "I'd love to help with weather information! For current weather data, I'd recommend checking a weather app or website. What's your location?";
  }

  // Time queries
  if (lowerMessage.includes('time') || lowerMessage.includes('what time')) {
    return `The current time is ${new Date().toLocaleTimeString()}. How else can I assist you today?`;
  }

  // Date queries
  if (lowerMessage.includes('date') || lowerMessage.includes('what date')) {
    return `Today is ${new Date().toLocaleDateString()}. Is there anything else you'd like to know?`;
  }

  // Programming/tech questions
  if (lowerMessage.includes('code') || lowerMessage.includes('programming') || lowerMessage.includes('javascript') || lowerMessage.includes('python')) {
    return "I'd be happy to help with programming questions! What specific language or concept are you working with?";
  }

  // Math questions
  if (lowerMessage.includes('math') || lowerMessage.includes('calculate') || lowerMessage.includes('+') || lowerMessage.includes('-') || lowerMessage.includes('*') || lowerMessage.includes('/')) {
    return "I can help with math problems! What calculation do you need assistance with?";
  }

  // Food/cooking
  if (lowerMessage.includes('food') || lowerMessage.includes('cook') || lowerMessage.includes('recipe')) {
    return "I love talking about food! What kind of dish are you interested in making or learning about?";
  }

  // Travel
  if (lowerMessage.includes('travel') || lowerMessage.includes('vacation') || lowerMessage.includes('trip')) {
    return "Travel is exciting! Where are you planning to go, or what travel advice are you looking for?";
  }

  // General responses based on conversation context
  const responses = [
    "That's an interesting question! I'd be happy to help you with that.",
    "I understand you're looking for assistance. Let me provide some helpful information.",
    "Great question! Here's what I can tell you about that topic.",
    "I'm here to help! Could you provide more details about what you need?",
    "That's a fascinating topic! I'd love to discuss this further with you.",
    "I appreciate your message! How can I assist you today?",
    "Thanks for reaching out! I'm ready to help with any questions you have.",
    "That's a great point! Let me think about how I can help you with that.",
    "I'm glad you asked! This is something I can definitely help you explore.",
    "Interesting! I'd love to learn more about what you're working on."
  ];

  // If this is a follow-up message, be more conversational
  if (conversationHistory.length > 0) {
    const followUpResponses = [
      "I see! That makes sense. What else would you like to know?",
      "Ah, I understand now. How can I help you further?",
      "Got it! Is there anything specific about that you'd like me to explain?",
      "That's helpful context! What's your next question?",
      "I'm following along! What would you like to explore next?",
      "Perfect! Now I have a better understanding. What else can I help with?",
      "That clarifies things! How else can I assist you?",
      "I see what you mean! What's the next step you'd like to take?"
    ];
    return followUpResponses[Math.floor(Math.random() * followUpResponses.length)];
  }

  // Default response
  return responses[Math.floor(Math.random() * responses.length)];
}

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

// Connect to MongoDB before starting server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
  });
}).catch(error => {
  console.error('Failed to connect to MongoDB, but server will still run:', error);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (without MongoDB)`);
  });
});
