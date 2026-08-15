import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import { seedInitialData } from './data/seed.js';
import { streamController } from './simulator/streamController.js';

import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import alertRoutes from './routes/alert.routes.js';
import investigationRoutes from './routes/investigation.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration for local React Vite frontend
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for local dev
  },
  credentials: true
}));

app.use(express.json());

// Socket.IO Setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.emit('simulator_status', streamController.getStatus());

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

streamController.setSocketIO(io);

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/investigation', investigationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FraudShield Backend API',
    version: '2.4.0',
    simulator: streamController.getStatus()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error Middleware]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await connectDB();
    await seedInitialData();

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  🛡️  FRAUDSHIELD BACKEND RUNNING ON http://localhost:${PORT}`);
      console.log(`  ⚡ Socket.IO Real-time Engine initialized.`);
      console.log(`  📊 Deterministic 6-Rule Engine & ML Ensemble Active.`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
