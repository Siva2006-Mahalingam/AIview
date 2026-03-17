import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, User, Mail, Calendar, Phone, Briefcase, Linkedin, BookOpen } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  target_role: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  bio: string | null;
  created_at?: string;
}

interface ProfileForm {
  full_name: string;
  phone: string;
  target_role: string;
  years_experience: string;
  linkedin_url: string;
  bio: string;
}

const toStr = (value: unknown): string => {
  if (typeof value === "string") return value;
  return "";
};

const toYearsStr = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return Math.floor(value).toString();
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return "";
};

const isLegacyColumnError = (message: string | undefined) =>
  !!message && message.includes("column of 'profiles' in the schema cache");

export const ProfilePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    full_name: "",
    phone: "",
    target_role: "",
    years_experience: "",
    linkedin_url: "",
    bio: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const meta = user.user_metadata || {};

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        setForm({
          full_name: profileData.full_name ?? toStr(meta.full_name),
          phone: profileData.phone ?? toStr(meta.phone),
          target_role: profileData.target_role ?? toStr(meta.target_role),
          years_experience:
            profileData.years_experience?.toString() ?? toYearsStr(meta.years_experience),
          linkedin_url: profileData.linkedin_url ?? toStr(meta.linkedin_url),
          bio: profileData.bio ?? toStr(meta.bio),
        });
      } else {
        // Existing user with no profile row yet — seed from auth metadata
        setForm({
          full_name: toStr(meta.full_name),
          phone: toStr(meta.phone),
          target_role: toStr(meta.target_role),
          years_experience: toYearsStr(meta.years_experience),
          linkedin_url: toStr(meta.linkedin_url),
          bio: toStr(meta.bio),
        });
        setProfile({
          id: "",
          full_name: toStr(meta.full_name) || null,
          email: user.email ?? null,
          phone: null,
          target_role: null,
          years_experience: null,
          linkedin_url: null,
          bio: null,
          created_at: user.created_at,
        });
      }

      setIsLoading(false);
    };

    load();
  }, [navigate]);

  const handleChange = (field: keyof ProfileForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const yearsInput = form.years_experience.trim();
      let parsedYears: number | null = null;
      if (yearsInput) {
        const n = Number(yearsInput);
        if (!Number.isInteger(n) || n < 0) {
          toast.error("Years of experience must be a non-negative whole number");
          return;
        }
        parsedYears = n;
      }

      const basePayload: Record<string, unknown> = {
        full_name: form.full_name.trim() || null,
        email: profile?.email ?? user.email ?? null,
      };

      const extendedPayload: Record<string, unknown> = {
        ...basePayload,
        phone: form.phone.trim() || null,
        target_role: form.target_role.trim() || null,
        years_experience: parsedYears,
        linkedin_url: form.linkedin_url.trim() || null,
        bio: form.bio.trim() || null,
      };

      const updateById = (id: string, payload: Record<string, unknown>) =>
        supabase.from("profiles").update(payload).eq("id", id).select("*").single();

      const insertNew = (payload: Record<string, unknown>) =>
        supabase
          .from("profiles")
          .insert({ user_id: user.id, ...payload })
          .select("*")
          .single();

      // Fetch the canonical profile id (handles deduplication)
      const { data: existingRow, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let usedLegacy = false;
      let saved: Profile | null = null;

      if (existingRow?.id) {
        const { data: ext, error: extErr } = await updateById(existingRow.id, extendedPayload);
        if (extErr) {
          if (!isLegacyColumnError(extErr.message)) throw extErr;
          const { data: base, error: baseErr } = await updateById(existingRow.id, basePayload);
          if (baseErr) throw baseErr;
          saved = base as Profile;
          usedLegacy = true;
        } else {
          saved = ext as Profile;
        }
      } else {
        const { data: ext, error: extErr } = await insertNew(extendedPayload);
        if (extErr) {
          if (!isLegacyColumnError(extErr.message)) throw extErr;
          const { data: base, error: baseErr } = await insertNew(basePayload);
          if (baseErr) throw baseErr;
          saved = base as Profile;
          usedLegacy = true;
        } else {
          saved = ext as Profile;
        }
      }

      if (!saved) throw new Error("Failed to save profile");

      const normalized: Profile = {
        id: saved.id,
        full_name: saved.full_name ?? null,
        email: saved.email ?? null,
        phone: usedLegacy ? (extendedPayload.phone as string | null) : (saved.phone ?? null),
        target_role: usedLegacy
          ? (extendedPayload.target_role as string | null)
          : (saved.target_role ?? null),
        years_experience: usedLegacy
          ? (extendedPayload.years_experience as number | null)
          : (saved.years_experience ?? null),
        linkedin_url: usedLegacy
          ? (extendedPayload.linkedin_url as string | null)
          : (saved.linkedin_url ?? null),
        bio: usedLegacy ? (extendedPayload.bio as string | null) : (saved.bio ?? null),
        created_at: saved.created_at,
      };

      setProfile(normalized);
      setForm({
        full_name: normalized.full_name ?? "",
        phone: normalized.phone ?? "",
        target_role: normalized.target_role ?? "",
        years_experience: normalized.years_experience?.toString() ?? "",
        linkedin_url: normalized.linkedin_url ?? "",
        bio: normalized.bio ?? "",
      });

      // Keep auth metadata in sync so new devices see latest values
      const { error: metaErr } = await supabase.auth.updateUser({
        data: {
          full_name: extendedPayload.full_name,
          phone: extendedPayload.phone,
          target_role: extendedPayload.target_role,
          years_experience: extendedPayload.years_experience,
          linkedin_url: extendedPayload.linkedin_url,
          bio: extendedPayload.bio,
        },
      });
      if (metaErr) console.warn("Auth metadata sync failed:", metaErr.message);

      if (usedLegacy) {
        toast.warning(
          "Basic profile saved. Apply the latest DB migration to persist all extended fields."
        );
      } else {
        toast.success("Profile updated successfully");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (() => {
    const name = form.full_name.trim() || profile?.email || "?";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  })();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-lg font-semibold text-foreground">My Profile</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Avatar + account card */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xl font-semibold text-foreground">
              {form.full_name || "No name set"}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
              {profile?.email && (
                <span className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {profile.email}
                </span>
              )}
              {memberSince && (
                <span className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Member since {memberSince}
                </span>
              )}
            </div>
            {form.target_role && (
              <span className="inline-flex items-center gap-1 mt-2 px-3 py-0.5 rounded-full text-xs bg-primary/15 text-primary font-medium">
                <Briefcase className="h-3 w-3" />
                {form.target_role}
              </span>
            )}
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit Profile</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Keep your details up-to-date so your interview experience is personalised.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="full-name"
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>

            {/* Target Role */}
            <div className="space-y-2">
              <Label htmlFor="target-role" className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                Target Role
              </Label>
              <Input
                id="target-role"
                placeholder="Frontend Developer"
                value={form.target_role}
                onChange={(e) => handleChange("target_role", e.target.value)}
              />
            </div>

            {/* Years of Experience */}
            <div className="space-y-2">
              <Label htmlFor="years-exp" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Years of Experience
              </Label>
              <Input
                id="years-exp"
                type="number"
                min={0}
                step={1}
                placeholder="2"
                value={form.years_experience}
                onChange={(e) => handleChange("years_experience", e.target.value)}
              />
            </div>

            {/* LinkedIn */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="linkedin" className="flex items-center gap-1.5">
                <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                LinkedIn URL
              </Label>
              <Input
                id="linkedin"
                type="url"
                placeholder="https://linkedin.com/in/your-name"
                value={form.linkedin_url}
                onChange={(e) => handleChange("linkedin_url", e.target.value)}
              />
            </div>

            {/* Bio */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bio" className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                Short Bio
              </Label>
              <Textarea
                id="bio"
                placeholder="Share your background, strengths, and interview goals"
                value={form.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                className="min-h-28 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="min-w-32">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
