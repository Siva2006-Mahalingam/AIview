from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InterviewSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("interview_type", models.CharField(max_length=50)),
                ("role", models.CharField(max_length=255)),
                ("status", models.CharField(choices=[("in_progress", "in_progress"), ("completed", "completed")], default="in_progress", max_length=20)),
                ("ats_score", models.IntegerField(blank=True, null=True)),
                ("performance_percentage", models.IntegerField(blank=True, null=True)),
                ("overall_feedback", models.TextField(blank=True, null=True)),
                ("improvements", models.TextField(blank=True, null=True)),
                ("tab_switches", models.IntegerField(default=0)),
                ("window_resizes", models.IntegerField(default=0)),
                ("fullscreen_exits", models.IntegerField(default=0)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="interview_sessions", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(blank=True, max_length=255, null=True)),
                ("email", models.EmailField(blank=True, max_length=254, null=True)),
                ("phone", models.CharField(blank=True, max_length=30, null=True)),
                ("target_role", models.CharField(blank=True, max_length=255, null=True)),
                ("years_experience", models.PositiveIntegerField(blank=True, null=True)),
                ("linkedin_url", models.URLField(blank=True, null=True)),
                ("bio", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Resume",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="resumes/")),
                ("original_filename", models.CharField(max_length=255)),
                ("ocr_text", models.TextField(blank=True, null=True)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="resumes", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name="interviewsession",
            name="resume",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sessions", to="app.resume"),
        ),
        migrations.CreateModel(
            name="EmotionSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("emotions", models.JSONField(default=dict)),
                ("is_nervous", models.BooleanField(default=False)),
                ("confidence_level", models.IntegerField(blank=True, null=True)),
                ("snapshot_url", models.CharField(blank=True, max_length=500, null=True)),
                ("captured_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="emotion_snapshots", to="app.interviewsession")),
            ],
        ),
        migrations.CreateModel(
            name="InterviewQuestion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("question_number", models.IntegerField()),
                ("question", models.TextField()),
                ("answer", models.TextField(blank=True, null=True)),
                ("score", models.IntegerField(blank=True, null=True)),
                ("feedback", models.TextField(blank=True, null=True)),
                ("video_url", models.CharField(blank=True, max_length=500, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="app.interviewsession")),
            ],
        ),
        migrations.CreateModel(
            name="UserRole",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("admin", "admin"), ("user", "user")], default="user", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="roles", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
