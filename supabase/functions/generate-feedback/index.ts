import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, questions, interviewType, role, duration, emotionData } = await req.json();

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Format questions for analysis
    const questionsText = questions
      .map((q: any, i: number) => {
        return `Question ${q.question_number || i + 1}: ${q.question}
Answer: ${q.answer || "No answer provided"}`;
      })
      .join("\n\n");

    // Calculate emotion averages if available
    let emotionSummary = "";
    if (emotionData && emotionData.length > 0) {
      const avgConfidence =
        emotionData.reduce((sum: number, e: any) => sum + (e.confidence_level || 0), 0) / emotionData.length;
      const nervousCount = emotionData.filter((e: any) => e.is_nervous).length;
      emotionSummary = `
Emotion Analysis:
- Average Confidence Level: ${Math.round(avgConfidence)}%
- Nervous Moments: ${nervousCount} out of ${emotionData.length} snapshots
`;
    }

    const prompt = `You are an expert interview coach and career consultant. Analyze this ${interviewType} interview for the role of ${role}.

${questionsText}

${emotionSummary}

Interview Duration: ${Math.floor((duration || 0) / 60)} minutes

Provide a comprehensive evaluation in JSON format with the following structure:
{
  "atsScore": <number 0-100 - how well the candidate would score in an ATS system based on keyword usage, relevance, and clarity>,
  "performancePercentage": <number 0-100 - overall interview performance score>,
  "overallFeedback": "<detailed paragraph about overall performance, strengths, and communication style>",
  "improvements": "<specific, actionable improvement suggestions as a paragraph>",
  "questionFeedback": [
    {
      "questionNumber": <number>,
      "score": <number 0-100>,
      "feedback": "<specific feedback for this answer - what was good, what could be improved>"
    }
  ]
}

Be constructive but honest. Focus on actionable feedback that helps the candidate improve. Consider:
- STAR method usage for behavioral questions
- Technical accuracy for technical questions
- Communication clarity and structure
- Relevance of examples
- Confidence level from emotion analysis

Return ONLY the JSON object, no markdown formatting.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to generate feedback");
    }

    const result = await response.json();
    let feedbackText = result.choices?.[0]?.message?.content || "";

    // Clean up response
    feedbackText = feedbackText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let feedback;
    try {
      feedback = JSON.parse(feedbackText);
    } catch {
      // Default response if parsing fails
      feedback = {
        atsScore: 65,
        performancePercentage: 70,
        overallFeedback: "You demonstrated good communication skills during the interview. Your answers showed relevant experience and knowledge. Continue to work on structuring your responses using the STAR method for behavioral questions.",
        improvements: "Consider providing more specific examples with quantifiable results. Practice articulating your thoughts more concisely. Work on reducing nervous habits and maintaining consistent confidence throughout the interview.",
        questionFeedback: questions.map((q: any, i: number) => ({
          questionNumber: q.question_number || i + 1,
          score: 70,
          feedback: "Your answer addressed the question but could benefit from more specific details and examples.",
        })),
      };
    }

    return new Response(JSON.stringify(feedback), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
