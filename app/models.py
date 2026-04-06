from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=30, null=True, blank=True)
    target_role = models.CharField(max_length=255, null=True, blank=True)
    years_experience = models.PositiveIntegerField(null=True, blank=True)
    linkedin_url = models.URLField(null=True, blank=True)
    bio = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.full_name or self.user.username


class UserRole(models.Model):
    ROLE_CHOICES = (("admin", "admin"), ("user", "user"))
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    created_at = models.DateTimeField(auto_now_add=True)


class Resume(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="resumes")
    file = models.FileField(upload_to="resumes/")
    original_filename = models.CharField(max_length=255)
    ocr_text = models.TextField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class InterviewSession(models.Model):
    STATUS_CHOICES = (("in_progress", "in_progress"), ("completed", "completed"))
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="interview_sessions")
    resume = models.ForeignKey(Resume, on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions")
    interview_type = models.CharField(max_length=50)
    role = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="in_progress")
    ats_score = models.IntegerField(null=True, blank=True)
    performance_percentage = models.IntegerField(null=True, blank=True)
    overall_feedback = models.TextField(null=True, blank=True)
    improvements = models.TextField(null=True, blank=True)
    tab_switches = models.IntegerField(default=0)
    window_resizes = models.IntegerField(default=0)
    fullscreen_exits = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)


class InterviewQuestion(models.Model):
    session = models.ForeignKey(InterviewSession, on_delete=models.CASCADE, related_name="questions")
    question_number = models.IntegerField()
    question = models.TextField()
    answer = models.TextField(null=True, blank=True)
    score = models.IntegerField(null=True, blank=True)
    feedback = models.TextField(null=True, blank=True)
    video_url = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class EmotionSnapshot(models.Model):
    session = models.ForeignKey(InterviewSession, on_delete=models.CASCADE, related_name="emotion_snapshots")
    emotions = models.JSONField(default=dict)
    is_nervous = models.BooleanField(default=False)
    confidence_level = models.IntegerField(null=True, blank=True)
    snapshot_url = models.CharField(max_length=500, null=True, blank=True)
    captured_at = models.DateTimeField(auto_now_add=True)
