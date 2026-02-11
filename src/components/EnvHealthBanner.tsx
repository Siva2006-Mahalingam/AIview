import { useEffect, useState } from "react";

interface HealthStatus {
  groq?: boolean;
  elevenlabs?: boolean;
  error?: string;
}

export function EnvHealthBanner() {
  const [status, setStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health`;

    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then(async (res) => {
        const json = await res.json();
        if (!mounted) return;
        setStatus(json);
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus({ error: err?.message || "Failed to reach health endpoint" });
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!status) return null;

  const missing: string[] = [];
  if (status.error) missing.push("health check failed");
  if (status.groq === false) missing.push("AI gateway (GROQ_API_KEY)");
  if (status.elevenlabs === false) missing.push("ElevenLabs TTS (ELEVENLABS_API_KEY)");

  if (missing.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 text-sm rounded-md mx-4 my-2">
      <strong>Warning:</strong> Missing or misconfigured services: {missing.join(", ")}. Please configure production secrets before deploying.
    </div>
  );
}

export default EnvHealthBanner;
