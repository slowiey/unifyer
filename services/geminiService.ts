
import { GoogleGenAI, Type } from "@google/genai";

// Always initialize GoogleGenAI with a named parameter using process.env.API_KEY directly.
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateProjectBreakdown = async (projectTitle: string, description: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Break down this university project into a logical list of 5-8 actionable tasks. 
    Assign each task a priority ('Low', 'Medium', or 'High') based on its likely importance to the project's completion.
    Project Title: ${projectTitle}
    Description: ${description}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Short title of the task" },
            priority: { type: Type.STRING, enum: ["Low", "Medium", "High"], description: "The priority of the task" },
          },
          required: ["title", "priority"],
        },
      },
    },
  });

  try {
    // response.text is a getter property that returns the generated string output.
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse AI response", error);
    return [];
  }
};

export const generateStudyPlan = async (examCourse: string, examDate: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a concise 5-day study plan for the exam: ${examCourse} scheduled on ${examDate}. 
    Focus on key preparation steps.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING, description: "Day label (e.g., Day 1)" },
            focus: { type: Type.STRING, description: "What to study" },
            action: { type: Type.STRING, description: "Actionable step" },
          },
          required: ["day", "focus", "action"],
        },
      },
    },
  });

  try {
    // response.text is a getter property that returns the generated string output.
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse AI response", error);
    return [];
  }
};
