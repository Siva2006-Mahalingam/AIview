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
      // Return default emotion data if no image provided
      return new Response(JSON.stringify({
        error: "Missing image data",
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
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Note: Groq API doesn't support vision/image analysis
    // Return simulated emotion data based on interview context
    // In production, consider using a dedicated vision API (e.g., Azure Face API, AWS Rekognition)
    
    // Generate slightly randomized but realistic emotion data
    const baseConfidence = 50 + Math.floor(Math.random() * 30); // 50-80
    const isNervous = Math.random() > 0.6; // 40% chance of appearing nervous
    
    const emotionData = {
      emotions: {
        happy: 20 + Math.floor(Math.random() * 30),
        sad: 5 + Math.floor(Math.random() * 15),
        angry: Math.floor(Math.random() * 10),
        surprised: 5 + Math.floor(Math.random() * 15),
        fearful: isNervous ? 15 + Math.floor(Math.random() * 20) : 5 + Math.floor(Math.random() * 10),
        disgusted: Math.floor(Math.random() * 5),
        neutral: 30 + Math.floor(Math.random() * 30),
      },
      is_nervous: isNervous,
      confidence_level: baseConfidence,
      session_id: sessionId,
      note: "Emotion analysis simulated - vision API not available",
    };

    console.log("Returning emotion data for session:", sessionId);

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
