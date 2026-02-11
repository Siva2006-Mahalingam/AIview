param(
  [string]$ProjectRef = $env:VITE_SUPABASE_PROJECT_ID
)

if (-not $ProjectRef) {
  $ProjectRef = 'godsiqhlobdujjsarwjn'
}

Write-Host "Using project ref: $ProjectRef"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Error "SUPABASE_ACCESS_TOKEN is not set. Set it in your session before running this script."
  exit 2
}

$functions = @('interview-chat','elevenlabs-tts','elevenlabs-scribe-token','analyze-emotion','extract-resume','generate-feedback','interview-coach','health')
foreach ($fn in $functions) {
  Write-Host "Deploying function: $fn"
  supabase functions deploy $fn --project-ref $ProjectRef
}

if (-not $env:LOVABLE_API_KEY -or -not $env:ELEVENLABS_API_KEY) {
  Write-Warning "LOVABLE_API_KEY or ELEVENLABS_API_KEY not set. Skipping secrets set."
} else {
  supabase secrets set LOVABLE_API_KEY="$env:LOVABLE_API_KEY" ELEVENLABS_API_KEY="$env:ELEVENLABS_API_KEY" --project-ref $ProjectRef
}

Write-Host "Building frontend..."
npm ci
npm run build
Write-Host "Build complete. Deploy the dist folder with your hosting provider."
