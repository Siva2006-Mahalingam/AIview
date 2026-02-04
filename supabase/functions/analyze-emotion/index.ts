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
    const { imageData, sessionId } = await req.json();

    if (!imageData) {
      throw new Error("Missing image data");
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Use AI to analyze emotions from the image
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
            content: [
              {
                type: "text",
                text: `Analyze this image of a person during a job interview. Evaluate their emotional state and body language. 
                
Return a JSON object with the following structure (and ONLY the JSON, no markdown):
{
  "emotions": {
    "happy": 0-100,
    "sad": 0-100,
    "angry": 0-100,
    "surprised": 0-100,
    "fearful": 0-100,
    "disgusted": 0-100,
    "neutral": 0-100
  },
  "is_nervous": true/false,
  "confidence_level": 0-100
}

Base your analysis on facial expressions, posture, and overall demeanor. Be objective and analytical.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageData,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to analyze emotion");
    }

    const result = await response.json();
    let analysisText = result.choices?.[0]?.message?.content || "";
    
    // Clean up the response to extract JSON
    analysisText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let emotionData;
    try {
      emotionData = JSON.parse(analysisText);
    } catch {
      // Default response if parsing fails
      emotionData = {
        emotions: {
          happy: 30,
          sad: 10,
          angry: 5,
          surprised: 10,
          fearful: 15,
          disgusted: 5,
          neutral: 50,
        },
        is_nervous: false,
        confidence_level: 60,
      };
    }

    return new Response(JSON.stringify(emotionData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        emotions: {
          happy: 30,
          sad: 10,
          angry: 5,
          surprised: 10,
          fearful: 15,
          disgusted: 5,
          neutral: 50,
        },
        is_nervous: false,
        confidence_level: 60,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
