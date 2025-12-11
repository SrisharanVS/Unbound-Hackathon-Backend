import express, { Request, Response } from "express";
import cors from "cors";
import registerRouter from "./api/register";
import commandsRouter from "./api/commands";
import regexRulesRouter from "./api/regex-rules";
import approvalRequestsRouter from "./api/approval-requests";

const app = express();
const port = 8080;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));
app.use(express.json());

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

// API routes
app.use("/api", registerRouter);
app.use("/api", commandsRouter);
app.use("/api", regexRulesRouter);
app.use("/api", approvalRequestsRouter);

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});