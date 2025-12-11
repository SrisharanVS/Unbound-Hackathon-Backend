import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { prisma } from "../prisma/db";
import { sendApprovalRequestNotification } from "../lib/email";

const router = Router();

async function authenticateApiKey(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: "API key is required. Please provide it in the X-API-Key header.",
    });
  }

  try {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!keyRecord) {
      return res.status(401).json({
        error: "Invalid API key",
      });
    }

    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() },
    });

    req.user = keyRecord.user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      error: "Internal server error during authentication",
    });
  }
}

async function authenticateAdmin(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: "API key is required. Please provide it in the X-API-Key header.",
    });
  }

  try {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!keyRecord) {
      return res.status(401).json({
        error: "Invalid API key",
      });
    }

    if (keyRecord.user.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only administrators can access this endpoint",
      });
    }

    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() },
    });

    req.user = keyRecord.user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      error: "Internal server error during authentication",
    });
  }
}

async function authenticateApprover(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: "API key is required. Please provide it in the X-API-Key header.",
    });
  }

  try {
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!keyRecord) {
      return res.status(401).json({
        error: "Invalid API key",
      });
    }

    if (keyRecord.user.role !== "approver") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only approvers can access this endpoint",
      });
    }

    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() },
    });

    req.user = keyRecord.user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      error: "Internal server error during authentication",
    });
  }
}

router.post("/approval-request", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { command_text } = req.body;

    if (!command_text || typeof command_text !== "string") {
      return res.status(400).json({
        error: "command_text is required and must be a string",
      });
    }

    if (command_text.trim().length === 0) {
      return res.status(400).json({
        error: "command_text cannot be empty",
      });
    }

    const approvalRequest = await prisma.approvalRequest.create({
      data: {
        userId: user.id,
        commandText: command_text.trim(),
        status: "pending",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    try {
      const approvers = await prisma.user.findMany({
        where: { role: "approver" },
        select: { email: true },
      });

      for (const approver of approvers) {
        if (approver.email) {
          await sendApprovalRequestNotification(
            approver.email,
            user.username,
            command_text.trim(),
            approvalRequest.id
          );
        }
      }
    } catch (emailError) {
      console.error("Failed to send approval request notifications:", emailError);
    }

    res.status(201).json({
      message: "Approval request submitted successfully",
      request: {
        id: approvalRequest.id,
        commandText: approvalRequest.commandText,
        status: approvalRequest.status,
        createdAt: approvalRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("Create approval request error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/approval-requests", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (user.role === "admin" || user.role === "approver") {
      const requests = await prisma.approvalRequest.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.status(200).json({
        requests,
        count: requests.length,
      });
    } else {
      const requests = await prisma.approvalRequest.findMany({
        where: { userId: user.id },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.status(200).json({
        requests,
        count: requests.length,
      });
    }
  } catch (error) {
    console.error("Get approval requests error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/approval-requests/:requestId/approve", authenticateApprover, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const approverUser = req.user!;

    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!approvalRequest) {
      return res.status(404).json({
        error: "Approval request not found",
      });
    }

    if (approvalRequest.status !== "pending") {
      return res.status(400).json({
        error: `Request is already ${approvalRequest.status}`,
      });
    }

    const escapedCommand = approvalRequest.commandText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `^${escapedCommand}$`;

    const [updatedRequest, regexRule] = await prisma.$transaction([
      prisma.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: approverUser.id,
        },
      }),
      prisma.regexRule.create({
        data: {
          pattern: pattern,
          action: "AUTO_ACCEPT",
          exampleMatch: approvalRequest.commandText,
        },
      }),
    ]);

    res.status(200).json({
      message: "Approval request approved and regex rule created",
      request: updatedRequest,
      rule: {
        id: regexRule.id,
        pattern: regexRule.pattern,
        action: regexRule.action,
      },
    });
  } catch (error) {
    console.error("Approve request error:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return res.status(409).json({
        error: "A regex rule for this command already exists",
      });
    }
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/approval-requests/:requestId/reject", authenticateApprover, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const approverUser = req.user!;

    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!approvalRequest) {
      return res.status(404).json({
        error: "Approval request not found",
      });
    }

    if (approvalRequest.status !== "pending") {
      return res.status(400).json({
        error: `Request is already ${approvalRequest.status}`,
      });
    }

    const updatedRequest = await prisma.approvalRequest.update({
      where: { id: requestId },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: approverUser.id,
        },
    });

    res.status(200).json({
      message: "Approval request rejected",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

