import { Router, Request, Response } from "express";
import { prisma } from "../prisma/db";
import { randomBytes } from "crypto";

const router = Router();

function generateApiKey(): string {
  return `sk_${randomBytes(32).toString("hex")}`;
}

async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

router.post("/login", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return res.status(400).json({
        error: "API key is required",
      });
    }

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

    res.status(200).json({
      message: "Login successful",
      userId: keyRecord.user.id,
      username: keyRecord.user.username,
      role: keyRecord.user.role,
      credits: keyRecord.user.credits,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;

