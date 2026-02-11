#!/usr/bin/env bash
set -euo pipefail

# Deploy script for Supabase functions and frontend (production)
# Usage:
# 1) Ensure `supabase` CLI is installed and authenticated (or set SUPABASE_ACCESS_TOKEN env var).
# 2) From project root run: cd vsians && SUPABASE_ACCESS_TOKEN="<token>" ./scripts/deploy_prod.sh

PROJECT_REF="${VITE_SUPABASE_PROJECT_ID:-godsiqhlobdujjsarwjn}"
echo "Using project ref: $PROJECT_REF"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is not set. Export it or pass it in the command line." >&2
  exit 2
fi

echo "Deploying Supabase functions..."
FUNCTIONS=(interview-chat elevenlabs-tts elevenlabs-scribe-token analyze-emotion extract-resume generate-feedback interview-coach health)
for fn in "${FUNCTIONS[@]}"; do
  echo "-> Deploying function: $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo "Setting secrets (LOVABLE_API_KEY and ELEVENLABS_API_KEY). Make sure you exported them or set them in your CI."
if [ -z "${LOVABLE_API_KEY:-}" ] || [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo "WARNING: LOVABLE_API_KEY or ELEVENLABS_API_KEY env var not set. Skipping secrets set."
else
  supabase secrets set LOVABLE_API_KEY="$LOVABLE_API_KEY" ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" --project-ref "$PROJECT_REF"
fi

echo "Building frontend..."
npm ci
npm run build

echo "Frontend built. Deploy the `dist` folder using your hosting provider (Vercel/Netlify/etc.)."

echo "Deployment script finished. Verify functions and health endpoint now."
echo "Health endpoint: https://$PROJECT_REF.supabase.co/functions/v1/health"
