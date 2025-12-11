import { Router, Request, Response } from "express";
import { prisma } from "../prisma/db";

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

router.post("/command", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { command_text } = req.body;

    console.log(`[COMMAND RECEIVED] User: ${user.username} (${user.role}) | Command: ${command_text}`);

    if (!command_text || typeof command_text !== "string") {
      return res.status(400).json({
        error: "command_text is required and must be a string",
      });
    }

    const regexRules = await prisma.regexRule.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });

    let matchedRule = null;
    for (const rule of regexRules) {
      try {
        const regex = new RegExp(rule.pattern);
        if (regex.test(command_text)) {
          matchedRule = rule;
          break;
        }
      } catch (error) {
        console.warn(`Invalid regex pattern in rule ${rule.id}: ${rule.pattern}`);
        continue;
      }
    }

    if (!matchedRule) {
      return res.status(400).json({
        status: "rejected",
        command: command_text,
        error: "Command does not match any allowed pattern",
        message: "The command does not match any regex rule in the system",
      });
    }

    if (matchedRule.action === "AUTO_REJECT") {
      return res.status(403).json({
        status: "rejected",
        command: command_text,
        error: "Command rejected by security rule",
        message: `Command matches a rejected pattern: ${matchedRule.pattern}`,
        matched_rule: {
          pattern: matchedRule.pattern,
          action: matchedRule.action,
        },
      });
    }

    if (user.credits < 10) {
      return res.status(403).json({
        error: "Insufficient credits",
        message: `You need at least 10 credits to submit a command. Your current balance: ${user.credits}`,
        current_balance: user.credits,
      });
    }

    const creditsBefore = user.credits;
    const creditsDeducted = 10;

    const [updatedUser, auditTrail] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          credits: {
            decrement: creditsDeducted,
          },
        },
        select: {
          credits: true,
        },
      }),
      prisma.auditTrail.create({
        data: {
          userId: user.id,
          commandText: command_text,
          creditsDeducted: creditsDeducted,
          creditsBefore: creditsBefore,
          creditsAfter: creditsBefore - creditsDeducted,
        },
      }),
    ]);

    res.status(200).json({
      status: "executed",
      command: command_text,
      message: "Command logged successfully",
      new_balance: updatedUser.credits,
      credits_deducted: creditsDeducted,
      audit_trail_id: auditTrail.id,
      matched_rule: {
        pattern: matchedRule.pattern,
        action: matchedRule.action,
      },
    });
  } catch (error) {
    console.error("Command processing error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/get-credit-balance", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        credits: true, 
        username: true 
      },
    });

    if (!currentUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.status(200).json({
      username: currentUser.username,
      credits: currentUser.credits,
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/command-history", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const history = await prisma.auditTrail.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.status(200).json({
      history,
      count: history.length,
    });
  } catch (error) {
    console.error("Get command history error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

