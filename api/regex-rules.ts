import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { prisma } from "../prisma/db";

const router = Router();

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

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    return false;
  }
}

router.post("/add-regex-rule", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { pattern, action, exampleMatch } = req.body;

    if (!pattern || typeof pattern !== "string") {
      return res.status(400).json({
        error: "pattern is required and must be a string",
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        error: "action is required and must be a string",
      });
    }

    if (action !== "AUTO_REJECT" && action !== "AUTO_ACCEPT") {
      return res.status(400).json({
        error: "action must be either 'AUTO_REJECT' or 'AUTO_ACCEPT'",
      });
    }

    if (!isValidRegex(pattern)) {
      return res.status(400).json({
        error: "Invalid regex pattern",
        message: "The provided pattern is not a valid regular expression",
      });
    }

    const existingRule = await prisma.regexRule.findUnique({
      where: { pattern },
    });

    if (existingRule) {
      return res.status(409).json({
        error: "Pattern already exists",
        message: "A rule with this pattern already exists",
      });
    }

    const regexRule = await prisma.regexRule.create({
      data: {
        pattern,
        action: action as "AUTO_REJECT" | "AUTO_ACCEPT",
        exampleMatch: exampleMatch || null,
      },
    });

    res.status(201).json({
      message: "Regex rule added successfully",
      rule: {
        id: regexRule.id,
        pattern: regexRule.pattern,
        action: regexRule.action,
        exampleMatch: regexRule.exampleMatch,
        createdAt: regexRule.createdAt,
      },
    });
  } catch (error) {
    console.error("Add regex rule error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.put("/regex-rules/:ruleId", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const { pattern, action, exampleMatch } = req.body;

    if (!pattern || typeof pattern !== "string") {
      return res.status(400).json({
        error: "pattern is required and must be a string",
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        error: "action is required and must be a string",
      });
    }

    if (action !== "AUTO_REJECT" && action !== "AUTO_ACCEPT") {
      return res.status(400).json({
        error: "action must be either 'AUTO_REJECT' or 'AUTO_ACCEPT'",
      });
    }

    if (!isValidRegex(pattern)) {
      return res.status(400).json({
        error: "Invalid regex pattern",
        message: "The provided pattern is not a valid regular expression",
      });
    }

    const existingRule = await prisma.regexRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      return res.status(404).json({
        error: "Regex rule not found",
      });
    }

    const patternExists = await prisma.regexRule.findUnique({
      where: { pattern },
    });

    if (patternExists && patternExists.id !== ruleId) {
      return res.status(409).json({
        error: "Pattern already exists",
        message: "A rule with this pattern already exists",
      });
    }

    const updatedRule = await prisma.regexRule.update({
      where: { id: ruleId },
      data: {
        pattern,
        action: action as "AUTO_REJECT" | "AUTO_ACCEPT",
        exampleMatch: exampleMatch || null,
      },
    });

    res.status(200).json({
      message: "Regex rule updated successfully",
      rule: {
        id: updatedRule.id,
        pattern: updatedRule.pattern,
        action: updatedRule.action,
        exampleMatch: updatedRule.exampleMatch,
        createdAt: updatedRule.createdAt,
        updatedAt: updatedRule.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update regex rule error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.delete("/regex-rules/:ruleId", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    const existingRule = await prisma.regexRule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      return res.status(404).json({
        error: "Regex rule not found",
      });
    }

    await prisma.regexRule.delete({
      where: { id: ruleId },
    });

    res.status(200).json({
      message: "Regex rule deleted successfully",
    });
  } catch (error) {
    console.error("Delete regex rule error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/regex-rules", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const rules = await prisma.regexRule.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error("Get regex rules error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/users", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { username, email, role } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({
        error: "username is required and must be a string",
      });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        error: "email is required and must be a string",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: "Username must be at least 3 characters long",
      });
    }

    const validRoles = ["admin", "approver", "member", "lead", "junior"];
    const userRole = validRoles.includes(role) ? role : "member";

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "Username already exists",
      });
    }

    const existingEmail = await prisma.user.findFirst({
      where: { email },
    });

    if (existingEmail) {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    const apiKey = `sk_${randomBytes(32).toString("hex")}`;

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: "",
        role: userRole,
        credits: 100,
        apiKeys: {
          create: {
            key: apiKey,
          },
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
        credits: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        ...user,
        apiKey: apiKey,
      },
    });
  } catch (error) {
    console.error("Add user error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/users", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        credits: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      users,
      count: users.length,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.put("/users/:userId/credits", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { credits } = req.body;

    if (typeof credits !== "number" || credits < 0) {
      return res.status(400).json({
        error: "credits must be a non-negative number",
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { credits },
      select: {
        id: true,
        username: true,
        credits: true,
      },
    });

    res.status(200).json({
      message: "User credits updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user credits error:", error);
    if (error instanceof Error && error.message.includes("Record to update does not exist")) {
      return res.status(404).json({
        error: "User not found",
      });
    }
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/audit-logs", authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditTrail.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    });

    res.status(200).json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

