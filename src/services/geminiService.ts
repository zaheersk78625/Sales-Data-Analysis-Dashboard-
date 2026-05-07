import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getSalesInsights(data: any) {
  const prompt = `
    Analyze the following sales data summary and provide 3 executive insights and a 3-month forecast summary.
    Data Summary:
    ${JSON.stringify(data)}
    
    Provide the response in JSON format:
    {
      "insights": ["insight1", "insight2", "insight3"],
      "forecast": "short forecast description",
      "recommendations": ["rec1", "rec2"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    const text = response.text || '';
    return JSON.parse(text.replace(/```json|```/g, ''));
  } catch (error) {
    console.error("AI Insights Error:", error);
    return null;
  }
}
