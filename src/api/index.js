import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/connection.js';
import { enableVectorExtension, testConnection } from '../db/connection.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { agentRoutes } from '../routes/agents.js';
import { taskRoutes } from '../routes/tasks.js';
import { experienceRoutes } from '../routes/experiences.js';
import { knowledgeRoutes } from '../routes/knowledge.js';
import { universalRoutes } from '../routes/universal.js';
// import { auditLog } from '../middleware/audit.js'; // TODO: implement

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// Security middleware
// ========================================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting per ARCHITECTURE-ESSENTIALS §54
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later.' }
});
app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ========================================
// Request ID for observability (ARCHITECTURE-ESSENTIALS §36)
// ========================================
app.use((req, res, next) => {
  req.request_id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  res.setHeader('X-Request-ID', req.request_id);
  next();
});

// ========================================
// Health check
// ========================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', request_id: req.request_id });
});

// ========================================
// API v1 routes (authenticated)
// ========================================
app.use('/v1', authenticateApiKey);

// Agent routes
app.use('/v1/agents', agentRoutes);
// Task routes
app.use('/v1/tasks', taskRoutes);
// Experience routes
app.use('/v1/experiences', experienceRoutes);
// Knowledge routes - Continuous Knowledge Engine (§18)
app.use('/v1/knowledge', knowledgeRoutes);
app.use('/knowledge', knowledgeRoutes);
// Universal domain-agnostic query (§36)
app.use('/v1/query', universalRoutes);

// ========================================
// Root route
// ========================================
app.get('/', (req, res) => {
  res.json({
    name: 'NeuraNet API',
    version: '0.1.0',
    status: 'operational',
    request_id: req.request_id
  });
});

// ========================================
// 404
// ========================================
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', request_id: req.request_id });
});

// ========================================
// Error handler
// ========================================
app.use((err, req, res, next) => {
  console.error(`[${req.request_id}] Error:`, err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    request_id: req.request_id
  });
});

// ========================================
// Initialize and start
// ========================================
const init = async () => {
  try {
    await testConnection();
    await enableVectorExtension();
    console.log('Database connected OK');
  } catch (err) {
    console.error('Database connection failed, running without DB:', err.message);
    // Continue without DB - routes will handle errors gracefully
  }
  
  app.listen(PORT, () => {
    console.log(`NeuraNet API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Request ID: will be attached to each request`);
    console.log('DB status: will be checked on first request');
  });
};

init().catch(err => {
  console.error('Critical initialization failure:', err);
  process.exit(1);
});