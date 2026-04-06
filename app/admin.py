from django.contrib import admin

from .models import EmotionSnapshot, InterviewQuestion, InterviewSession, Profile, Resume, UserRole

admin.site.register(Profile)
admin.site.register(UserRole)
admin.site.register(Resume)
admin.site.register(InterviewSession)
admin.site.register(InterviewQuestion)
admin.site.register(EmotionSnapshot)
