import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const getSystemPrompt = (interviewType: string, role: string) => {
  const basePrompt = `You are an experienced, professional AI interviewer conducting a mock interview. The candidate is interviewing for a ${role} position.

Your role is to:
1. Ask thoughtful, relevant interview questions one at a time
2. Listen carefully to responses and ask follow-up questions when appropriate
3. Provide a realistic interview experience
4. Be encouraging but professional
5. After 5-7 questions, wrap up the interview with brief constructive feedback

Guidelines:
- Keep questions clear and concise
- Wait for responses before moving to the next question
- Maintain a natural conversational flow
- Be supportive and help the candidate feel comfortable`;

  const typePrompts: Record<string, string> = {
    behavioral: `
Focus on behavioral questions using the STAR method (Situation, Task, Action, Result).
Ask about past experiences, challenges overcome, teamwork, leadership, and problem-solving.
Example topics: conflict resolution, handling pressure, learning from failure, collaboration.`,
    technical: `
Focus on technical questions relevant to the ${role} position.
Cover concepts, problem-solving approaches, and technical scenarios.
Ask about specific technologies, methodologies, and best practices.
Include some practical scenario-based questions.`,
    case: `
Present business case studies and strategic problems.
Ask the candidate to walk through their thinking process.
Focus on analytical skills, problem decomposition, and strategic thinking.
Probe their assumptions and reasoning.`,
    general: `
Ask common interview questions that apply to any role.
Cover motivation, career goals, strengths/weaknesses, and work style.
Include questions about the candidate's background and aspirations.
Ask about their interest in the role and company.`,
  };

  return `${basePrompt}
${typePrompts[interviewType] || typePrompts.general}

Start by warmly greeting the candidate and asking your first interview question. Keep your response concise - one question at a time.`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, interviewType, role, isInit } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = getSystemPrompt(interviewType || "general", role || "professional");

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    if (isInit) {
      apiMessages.push({
        role: "user",
        content: "Please start the interview with a warm greeting and your first question.",
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Interview chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
