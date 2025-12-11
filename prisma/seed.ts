import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding default regex rules...");

  // Default regex rules based on the requirements
  const defaultRules = [
    {
      pattern: ":(){ :|:& };:",
      action: "AUTO_REJECT" as const,
      exampleMatch: ":(){ :|:& };: (fork bomb)",
    },
    {
      pattern: "rm\\s+-rf\\s+/",
      action: "AUTO_REJECT" as const,
      exampleMatch: "rm -rf /",
    },
    {
      pattern: "mkfs\\.",
      action: "AUTO_REJECT" as const,
      exampleMatch: "mkfs.ext4 /dev/sda",
    },
    {
      pattern: "git\\s+(status|log|diff)",
      action: "AUTO_ACCEPT" as const,
      exampleMatch: "git status, git log",
    },
    {
      pattern: "^(ls|cat|pwd|echo)",
      action: "AUTO_ACCEPT" as const,
      exampleMatch: "ls -la, cat file.txt",
    },
  ];

  for (const rule of defaultRules) {
    try {
      await prisma.regexRule.upsert({
        where: { pattern: rule.pattern },
        update: {},
        create: rule,
      });
      console.log(`✓ Added rule: ${rule.pattern}`);
    } catch (error) {
      console.error(`✗ Failed to add rule: ${rule.pattern}`, error);
    }
  }

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

