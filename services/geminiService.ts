
import { GoogleGenAI, Type } from "@google/genai";

// Always initialize GoogleGenAI with a named parameter using import.meta.env
const getAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("An API Key must be set when running in a browser");
  }
  return new GoogleGenAI({ apiKey });
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

export const generateStudyPlan = async (examCourse: string, examDate: string, examNotes?: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create a detailed 7-10 day comprehensive study plan for the exam: ${examCourse} scheduled on ${examDate}.
    ${examNotes ? `Additional context: ${examNotes}` : ''}
    
    Include:
    - Daily focus topics with specific chapters/concepts
    - Concrete actionable steps (what to read, practice, review)
    - Estimated time allocation in hours
    - Practice exercises or problems to solve
    - Review strategies for better retention
    
    Make it practical and realistic for a university student.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING, description: "Day label (e.g., Day 1, Day 2)" },
            focus: { type: Type.STRING, description: "Main topic/chapter to study" },
            action: { type: Type.STRING, description: "Detailed actionable steps" },
            hours: { type: Type.NUMBER, description: "Estimated hours needed" },
            exercises: { type: Type.STRING, description: "Practice problems or exercises" },
          },
          required: ["day", "focus", "action", "hours"],
        },
      },
    },
  });

  try {
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse AI response", error);
    return [];
  }
};

export const chatWithAI = async (message: string, conversationHistory: Array<{role: string, content: string}> = []) => {
  const ai = getAIClient();
  
  // Build conversation context
  const contextMessages = conversationHistory.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n\n');
  
  const fullPrompt = contextMessages 
    ? `${contextMessages}\n\nUser: ${message}\n\nAssistant:`
    : `You are a helpful academic assistant for university students. Help them with their studies, assignments, exam preparation, and academic questions. Be concise but thorough.\n\nUser: ${message}\n\nAssistant:`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: fullPrompt,
  });

  try {
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Chat AI failed", error);
    return "I encountered an error. Please try again.";
  }
};
