import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

// Lazy initialization of Gemini client to prevent crash on startup if key is missing.
let aiClient: GoogleGenAI | null = null;
function getAi() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined. Please add your key in the Settings > Secrets configuration.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Log request endpoint
  app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`);
    next();
  });

  // --- API ROUTES ---

  /**
   * Parse natural language task info into structured task listings.
   */
  app.post("/api/tasks/parse", async (req, res) => {
    try {
      const { text, currentDate } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text prompt is required" });
      }

      const ai = getAi();
      const prompt = `
Context Date: ${currentDate || '2026-05-28'}
Convert the raw student input text describing their academic agenda, assignments, exams, homework, or studies into an array of structured Tasks.

User Raw Input:
"${text}"

For any tasks where a deadline is mentioned (like "tomorrow", "this Friday", "next Wednesday"), calculate the correct YYYY-MM-DD date based on the Context Date (${currentDate || '2026-05-28'}). If no date is mentioned, estimate a reasonable date starting from tomorrow.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Clear, title of the study task or homework item." },
                subject: { type: Type.STRING, description: "Subject/Course name, e.g., Math, Bio, Literature, Computer Science." },
                dueDate: { type: Type.STRING, description: "The task due date in YYYY-MM-DD format." },
                estimatedHours: { type: Type.NUMBER, description: "Estimated homework preparation hours (0.5 to 10.0)." },
                difficulty: { type: Type.INTEGER, description: "Cognitive difficulty from 1 (very simple/passive) to 5 (extreme difficulty/preparation exam/long-form thesis)." },
                cognitiveType: {
                  type: Type.STRING,
                  enum: ["analytical", "creative", "memorization", "repetitive", "synthesis"],
                  description: "Primary cognitive mental focus required: analytical (coding, problem sets), creative (art, project brainstorming), memorization (flashcards, quiz prep), repetitive (practice sheets, vocabulary drill), synthesis (writing essays, reading long texts)."
                },
                notes: { type: Type.STRING, description: "Short descriptive extraction from input (optional)." }
              },
              required: ["title", "subject", "dueDate", "estimatedHours", "difficulty", "cognitiveType"]
            }
          }
        }
      });

      const parsedData = JSON.parse(response.text || "[]");
      res.json(parsedData);
    } catch (error: any) {
      console.error("[Parse Endpoint Error]:", error);
      res.status(500).json({ error: error.message || "Failed to parse task with Gemini API" });
    }
  });

  /**
   * Optimize task schedule to balance daily workloads and avoid peak cognitive stress.
   */
  app.post("/api/schedule/optimize", async (req, res) => {
    try {
      const { tasks, currentDate } = req.body;
      if (!tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ error: "Tasks array is required" });
      }

      const ai = getAi();
      const prompt = `
Context Date: ${currentDate || "2026-05-28"}
You are an expert academic advisor specialized in student workload, stress mitigation, and cognitive health.
Analyze the following academic task load structure. Focus on peak stress waves (dates where multiple high difficulty/long hour tasks land on the same due date).

Existing Tasks Profile:
${JSON.stringify(tasks, null, 2)}

Your strategy:
1. Identify deadline bottlenecks (dates where sum of (difficulty * estimatedHours) is high, say above 8).
2. Recommend balancing out the days. Suggest safe dates to shift work start or reschedule due-dates earlier so the student gets steady intellectual stimulation (e.g. pairing analytical tasks with brief creative ones, or spacing synthesis days).
3. Draft specific suggested rescheduling shifts (with taskId, originalDate, suggestedNewDate, and explaining the cognitive balancing reason).
  `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestionDescription: { type: Type.STRING, description: "Analysis of the current workload highlighting stress points." },
              suggestedRescheduling: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING, description: "The unique ID of the task to be rescheduled." },
                    originalDate: { type: Type.STRING, description: "The original YYYY-MM-DD input date." },
                    suggestedDate: { type: Type.STRING, description: "The suggested new YYYY-MM-DD date to focus on or shift task." },
                    reason: { type: Type.STRING, description: "Workload balancing reason for the shift." }
                  },
                  required: ["taskId", "originalDate", "suggestedDate", "reason"]
                }
              },
              generalAdvice: { type: Type.STRING, description: "Broad cognitive advice on work patterns based on current course mix." }
            },
            required: ["suggestionDescription", "suggestedRescheduling", "generalAdvice"]
          }
        }
      });

      const parsedData = JSON.parse(response.text || "{}");
      res.json(parsedData);
    } catch (error: any) {
      console.error("[Optimize Endpoint Error]:", error);
      res.status(500).json({ error: error.message || "Failed to optimize schedule with Gemini API" });
    }
  });

  /**
   * Generating adaptive real-time micro-interventions for procrastination recovery.
   */
  app.post("/api/focus/intervention", async (req, res) => {
    try {
      const { task, disruptionType, elapsedMinutes } = req.body;
      if (!task) {
        return res.status(400).json({ error: "Task details are required" });
      }

      const ai = getAi();
      const prompt = `
The student is currently working on: "${task.title}" (Subject: ${task.subject}, Cognitive Load Type: ${task.cognitiveType}, Difficulty Level: ${task.difficulty}/5).
The system detected a real-time study disruption: "${disruptionType}" (e.g., Tab switching/App Blur, Idle inactivity, or mental block timer alert).
The timer has been running for ${elapsedMinutes || 0} minutes.

Create a friendly, personalized interruption micro-intervention card to re-capture and reset their focus.
It must fall under one of these types:
- 'microtask': An ultra-simple, 2-minute actionable sub-goal that breaks inertia (e.g., 'Just type out one title line', 'Write down three formulas').
- 'reset': A short mental somatic grounding break (e.g., 'The 4-7-8 breathing shift', 'A physical stretch or quick eye shift away from blue light' for 30s).
- 'recovery': Quick self-compassion reassurance to handle performance blockades and executive dysfunction.

Provide advice that fits the task's Cognitive Type (${task.cognitiveType}).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["microtask", "reset", "recovery"], description: "The type of intervention chosen." },
              title: { type: Type.STRING, description: "An eye-catching, creative, supportive title." },
              content: { type: Type.STRING, description: "Short, ultra-precise instructions to execute right now." }
            },
            required: ["type", "title", "content"]
          }
        }
      });

      const parsedData = JSON.parse(response.text || "{}");
      res.json(parsedData);
    } catch (error: any) {
      console.error("[Intervention Endpoint Error]:", error);
      res.status(500).json({ error: error.message || "Failed to create custom focus intervention" });
    }
  });

  // --- VITE ENTRYPOINT MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Dev/Prod server executing on protocol http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Express Startup Crash]:", err);
});
