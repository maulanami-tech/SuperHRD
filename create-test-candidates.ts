import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function createTestCandidates() {
  // Get the HRD user
  const user = await prisma.user.findUnique({
    where: { email: "hrd@superhrd.com" },
  });

  if (!user) {
    console.error("HRD user not found. Run seed first.");
    process.exit(1);
  }

  const candidates = [
    {
      name: "John Doe",
      email: "john.doe@example.com",
      fileName: "john-doe-cv.pdf",
      filePath: "/uploads/john-doe-cv.pdf",
      status: "completed",
      overallScore: 85,
      posisi: "Software Engineer",
      submittedById: user.id,
      submittedBy: user.name,
    },
    {
      name: "Jane Smith",
      email: "jane.smith@example.com",
      fileName: "jane-smith-cv.pdf",
      filePath: "/uploads/jane-smith-cv.pdf",
      status: "completed",
      overallScore: 92,
      posisi: "Product Manager",
      submittedById: user.id,
      submittedBy: user.name,
    },
    {
      name: "Bob Wilson",
      email: "bob.wilson@example.com",
      fileName: "bob-wilson-cv.pdf",
      filePath: "/uploads/bob-wilson-cv.pdf",
      status: "pending",
      overallScore: null,
      posisi: "UX Designer",
      submittedById: user.id,
      submittedBy: user.name,
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidate.create({
      data: {
        id: crypto.randomUUID(),
        name: candidate.name,
        email: candidate.email,
        fileName: candidate.fileName,
        filePath: candidate.filePath,
        status: candidate.status,
        overallScore: candidate.overallScore,
        posisi: candidate.posisi,
        kriteria: null,
        prompt: null,
        n8nRunId: null,
        submittedBy: candidate.submittedBy,
        submittedById: candidate.submittedById,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        screeningResult: candidate.overallScore
          ? {
              create: {
                id: crypto.randomUUID(),
                overallScore: candidate.overallScore,
                summary: `Scored ${candidate.overallScore}/100`,
                criteria: JSON.stringify([
                  { name: "Technical Skills", score: candidate.overallScore - 10, notes: "Good technical knowledge" },
                  { name: "Experience", score: candidate.overallScore, notes: "Relevant experience" },
                ]),
                scoredAt: new Date().toISOString(),
                rawResponse: null,
              },
            }
          : undefined,
      },
    });
    console.log(`Created candidate: ${candidate.name}`);
  }

  console.log("\nTest candidates created successfully!");
  console.log(`Total: ${candidates.length} candidates`);
  await prisma.$disconnect();
}

createTestCandidates().catch(console.error);
