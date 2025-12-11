# Unbound Hackathon: Command Gateway - Backend

A robust Express.js backend API for managing command execution, user authentication, regex rule validation, and approval workflows. Built with TypeScript, Prisma ORM, and PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Email Configuration](#email-configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Command Gateway backend provides a secure API for:

- **User Management**: Role-based access control with API key authentication
- **Command Execution**: Regex-based validation and execution tracking
- **Credit System**: Track and manage user command credits
- **Approval Workflows**: Multi-approver system requiring 2 approvals per request
- **Audit Logging**: Complete audit trail of all command executions
- **Regex Rule Engine**: Dynamic pattern matching for command validation

## Architecture

```
backend/
├── api/                    # API route handlers
│   ├── register.ts        # Authentication endpoints
│   ├── commands.ts        # Command execution endpoints
│   ├── regex-rules.ts     # Regex rule management (admin)
│   └── approval-requests.ts # Approval workflow endpoints
├── lib/                    # Utility libraries
│   └── email.ts          # Email notification service
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma     # Prisma schema definition
│   ├── db.ts             # Prisma client instance
│   └── migrations/       # Database migration files
├── types/                  # TypeScript type definitions
│   └── express.d.ts     # Express Request extension types
├── server.ts              # Express server entry point
└── package.json           # Dependencies and scripts
```

### Technology Stack

- **Runtime**: Bun (JavaScript runtime)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL (via NeonDB - serverless)
- **ORM**: Prisma 6.x
- **Language**: TypeScript
- **Email**: Nodemailer
- **CORS**: cors middleware

## Prerequisites

- **Bun** >= 1.3.4 ([Installation Guide](https://bun.sh/docs/installation))
- **PostgreSQL** >= 12.x
- **Node.js** >= 18.x (optional, for compatibility)

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd unbound-v2/backend
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Set up environment variables** (see [Configuration](#configuration)):
   ```bash
   cp .env.example .env  # If you have an example file
   # Or create .env manually
   ```

## Configuration

Create a `.env` file in the `backend` directory with the following variables:

### Required Variables

```env
# Database (NeonDB connection string)
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:3000"
```

**Note**: Get your `DATABASE_URL` from your NeonDB project dashboard. The connection string includes SSL mode by default.

### Optional Variables

```env
# Email Configuration (for approval notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"  # Gmail App Password required
```

**Note**: If `SMTP_PASSWORD` is not set, email notifications will be disabled gracefully without breaking the application.

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Using psql
createdb command_gateway

# Or using SQL
psql -U postgres
CREATE DATABASE command_gateway;
```

### 2. Run Migrations

```bash
# Development: Creates migration and applies it
bunx prisma migrate dev

# Production: Applies pending migrations only
bunx prisma migrate deploy
```

### 3. Generate Prisma Client

```bash
bunx prisma generate
```

The Prisma client will be generated in `backend/generated/prisma/`.

### 4. (Optional) Seed Database

If you have a seed file:

```bash
bunx prisma db seed
```

## Running the Server

### Development Mode

```bash
bun run server.ts
```

The server will start on `http://localhost:8080` by default.

### Production Mode

```bash
bun run server.ts
```

For production, consider using a process manager like PM2:

```bash
pm2 start server.ts --name command-gateway
```

## API Documentation

### Base URL

```
http://localhost:8080/api
```

### Authentication

All endpoints (except `/login`) require an API key in the `X-API-Key` header:

```
X-API-Key: sk_<your-api-key>
```

### Endpoints

#### Authentication

**POST `/api/login`**
- **Description**: Authenticate with API key
- **Headers**: `X-API-Key: <api-key>`
- **Response**:
  ```json
  {
    "message": "Login successful",
    "userId": "uuid",
    "username": "string",
    "role": "admin" | "approver" | "member" | "lead" | "junior",
    "credits": 100
  }
  ```

#### Commands

**POST `/api/command`**
- **Description**: Submit a command for execution
- **Auth**: Required (API Key)
- **Body**:
  ```json
  {
    "command_text": "your command here"
  }
  ```
- **Response**:
  ```json
  {
    "status": "executed" | "rejected" | "accepted",
    "command": "command text",
    "message": "Success message",
    "credits_deducted": 10,
    "current_balance": 90,
    "matched_rule": {
      "pattern": "^pattern$",
      "action": "AUTO_ACCEPT"
    }
  }
  ```

**GET `/api/command-history`**
- **Description**: Get user's command execution history
- **Auth**: Required (API Key)
- **Response**:
  ```json
  {
    "history": [
      {
        "id": "uuid",
        "commandText": "command",
        "creditsDeducted": 10,
        "creditsBefore": 100,
        "creditsAfter": 90,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
  ```

**GET `/api/get-credit-balance`**
- **Description**: Get current credit balance
- **Auth**: Required (API Key)
- **Response**:
  ```json
  {
    "username": "user123",
    "credits": 100
  }
  ```

#### Regex Rules (Admin Only)

**GET `/api/regex-rules`**
- **Description**: List all regex rules
- **Auth**: Required (Admin)

**POST `/api/add-regex-rule`**
- **Description**: Create a new regex rule
- **Auth**: Required (Admin)
- **Body**:
  ```json
  {
    "pattern": "^pattern$",
    "action": "AUTO_ACCEPT" | "AUTO_REJECT",
    "exampleMatch": "example command"
  }
  ```

**PUT `/api/regex-rules/:ruleId`**
- **Description**: Update an existing regex rule
- **Auth**: Required (Admin)
- **Body**: Same as POST

**DELETE `/api/regex-rules/:ruleId`**
- **Description**: Delete a regex rule
- **Auth**: Required (Admin)

#### User Management (Admin Only)

**GET `/api/users`**
- **Description**: List all users
- **Auth**: Required (Admin)

**POST `/api/users`**
- **Description**: Create a new user
- **Auth**: Required (Admin)
- **Body**:
  ```json
  {
    "username": "newuser",
    "email": "user@example.com",
    "role": "member" | "admin" | "approver" | "lead" | "junior"
  }
  ```
- **Response**: Includes generated API key

**PUT `/api/users/:userId/credits`**
- **Description**: Update user credits
- **Auth**: Required (Admin)
- **Body**:
  ```json
  {
    "credits": 150
  }
  ```

#### Approval Requests

**POST `/api/approval-request`**
- **Description**: Submit a command for approval
- **Auth**: Required (API Key)
- **Body**:
  ```json
  {
    "command_text": "command to approve"
  }
  ```
- **Note**: Sends email notification to all approvers

**GET `/api/approval-requests`**
- **Description**: Get approval requests
- **Auth**: Required (API Key)
- **Response**: 
  - Admins/Approvers: All requests
  - Members: Own requests only

**POST `/api/approval-requests/:requestId/approve`**
- **Description**: Approve a request (requires 2 approvals total)
- **Auth**: Required (Approver role)
- **Response**:
  ```json
  {
    "message": "Approval recorded (1/2 approvals)...",
    "approvalCount": 1,
    "threshold": 2,
    "rule": null  // Created when threshold met
  }
  ```

**POST `/api/approval-requests/:requestId/reject`**
- **Description**: Reject an approval request
- **Auth**: Required (Approver role)

**GET `/api/audit-logs`**
- **Description**: Get audit logs (Admin only)
- **Auth**: Required (Admin)

## Authentication

### API Key Authentication

1. **User Creation**: Admins create users via `/api/users` endpoint
2. **API Key Generation**: API key is automatically generated and returned
3. **Authentication**: Include API key in `X-API-Key` header for all requests

### Role-Based Access Control

- **admin**: Full access to all endpoints
- **approver**: Can approve/reject requests, view all requests
- **member**: Can submit commands, view own history, submit approval requests
- **lead**: Same as member
- **junior**: Same as member

### Middleware

- `authenticateApiKey`: Validates API key, attaches user to request
- `authenticateAdmin`: Ensures user has admin role
- `authenticateApprover`: Ensures user has approver role

## Database Schema

### Models

#### User
- `id`: UUID (Primary Key)
- `username`: String (Unique)
- `password`: String (Hashed, legacy)
- `email`: String (Unique, Required)
- `role`: Enum (admin, approver, member, lead, junior)
- `credits`: Integer (Default: 100)
- `createdAt`: DateTime
- `updatedAt`: DateTime

#### ApiKey
- `id`: UUID (Primary Key)
- `key`: String (Unique, Format: `sk_<hex>`)
- `userId`: UUID (Foreign Key → User)
- `createdAt`: DateTime
- `lastUsed`: DateTime (Nullable)

#### RegexRule
- `id`: UUID (Primary Key)
- `pattern`: String (Unique, Regex pattern)
- `action`: Enum (AUTO_ACCEPT, AUTO_REJECT)
- `exampleMatch`: String (Nullable)
- `createdAt`: DateTime
- `updatedAt`: DateTime

#### ApprovalRequest
- `id`: UUID (Primary Key)
- `userId`: UUID (Foreign Key → User)
- `commandText`: String
- `status`: Enum (pending, approved, rejected)
- `approvalCount`: Integer (Default: 0)
- `createdAt`: DateTime
- `updatedAt`: DateTime
- `reviewedAt`: DateTime (Nullable)
- `reviewedBy`: String (Nullable, User ID)

#### ApprovalRequestApprover
- `id`: UUID (Primary Key)
- `approvalRequestId`: UUID (Foreign Key → ApprovalRequest)
- `approverId`: UUID (Foreign Key → User)
- `createdAt`: DateTime
- **Unique Constraint**: `(approvalRequestId, approverId)` - Prevents duplicate approvals

#### AuditTrail
- `id`: UUID (Primary Key)
- `userId`: UUID (Foreign Key → User)
- `commandText`: String
- `creditsDeducted`: Integer (Default: 10)
- `creditsBefore`: Integer
- `creditsAfter`: Integer
- `createdAt`: DateTime

### Relationships

- User → ApiKey (One-to-Many)
- User → AuditTrail (One-to-Many)
- User → ApprovalRequest (One-to-Many)
- User → ApprovalRequestApprover (One-to-Many)
- ApprovalRequest → ApprovalRequestApprover (One-to-Many)

## Email Configuration

### Gmail Setup

1. **Enable 2-Step Verification** in Google Account settings
2. **Generate App Password**:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and generate password
3. **Set Environment Variables**:
   ```env
   SMTP_PASSWORD="your-16-char-app-password"
   SMTP_USER="your-email@gmail.com"  # Optional, defaults to sender email
   ```

### Email Notifications

- **Trigger**: When a new approval request is submitted
- **Recipients**: All users with `approver` role
- **Sender**: `srisharan.psgtech@gmail.com` (hardcoded)
- **Content**: Includes requester username, command text, and request ID

### Email Service

The email service (`lib/email.ts`) gracefully handles:
- Missing SMTP configuration (logs warning, continues)
- Email send failures (logs error, doesn't break request)
- Multiple recipients (sends to all approvers)

## Development

### Project Structure

```
backend/
├── api/              # Route handlers
├── lib/              # Utilities
├── prisma/           # Database
├── types/            # TypeScript types
└── server.ts         # Entry point
```

### Adding New Endpoints

1. Create route handler in `api/` directory
2. Import and mount in `server.ts`
3. Add authentication middleware if needed
4. Update this README

### Database Migrations

```bash
# Create new migration
bunx prisma migrate dev --name migration_name

# Reset database (development only)
bunx prisma migrate reset

# View migration status
bunx prisma migrate status
```

### TypeScript Types

- Express Request extended with `user` property (see `types/express.d.ts`)
- Prisma types generated from schema
- Import types from `@/generated/prisma`

### Logging

- Console logs for command execution
- Error logging in catch blocks
- Email service logs warnings/errors

## Deployment

### Environment Setup

1. Set production environment variables
2. Use production database URL
3. Configure SMTP for email notifications
4. Set `FRONTEND_URL` to production frontend URL

### Database Migrations

```bash
# Production: Apply migrations without prompts
bunx prisma migrate deploy
```

### Process Management

**Using PM2**:
```bash
pm2 start server.ts --name command-gateway-api
pm2 save
pm2 startup
```

**Using Docker** (example):
```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bunx prisma generate
EXPOSE 8080
CMD ["bun", "run", "server.ts"]
```

### Health Checks

- Root endpoint: `GET /` returns "Hello World!"
- Database connection verified on startup
- API endpoints return appropriate status codes

## Troubleshooting

### Common Issues

**1. "Cannot find package 'cors'"**
```bash
cd backend
bun add cors @types/cors
```

**2. Database Connection Error**
- Verify `DATABASE_URL` is correct (from NeonDB dashboard)
- Ensure NeonDB project is active (not paused)
- Check connection string includes `?sslmode=require`
- Verify network connectivity to NeonDB
- IMPORTANT: DONT CONNECT TO PSG WIFI, NEON IS BLOCKED -_-

**3. Prisma Client Not Found**
```bash
bunx prisma generate
```

**4. Email Not Sending**
- Verify `SMTP_PASSWORD` is set (Gmail App Password)
- Check email service logs
- Email failures don't break requests (by design)

**5. Migration Errors**
```bash
# Reset and reapply (development only)
bunx prisma migrate reset
bunx prisma migrate dev
```

**6. TypeScript Errors**
```bash
# Regenerate Prisma client
bunx prisma generate

# Check types
bun run --bun tsc --noEmit
```

### Debugging

- Enable verbose logging by adding `console.log` statements
- Check Prisma query logs: Set `log: ['query']` in Prisma client
- Use database GUI tools (pgAdmin, DBeaver) to inspect data

### Support

For issues or questions:
1. Check logs in console
2. Verify environment variables
3. Review API endpoint documentation
4. Check database schema matches migrations

---

**Last Updated**: December 2024
**Version**: 1.0.0
