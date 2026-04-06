import json
import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.db.models import Avg, Count
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import EmotionSnapshot, InterviewQuestion, InterviewSession, Profile, Resume
from .services import generate_coach_tip, generate_feedback, generate_interview_reply


def _json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def _profile_to_dict(profile: Profile) -> dict:
    return {
        "id": profile.id,
        "full_name": profile.full_name,
        "email": profile.email,
        "phone": profile.phone,
        "target_role": profile.target_role,
        "years_experience": profile.years_experience,
        "linkedin_url": profile.linkedin_url,
        "bio": profile.bio,
        "created_at": profile.created_at.isoformat(),
    }


def _session_to_dict(session: InterviewSession) -> dict:
    latest_video = (
        InterviewQuestion.objects.filter(session=session, video_url__isnull=False)
        .exclude(video_url="")
        .order_by("-created_at")
        .values_list("video_url", flat=True)
        .first()
    )
    return {
        "id": session.id,
        "interview_type": session.interview_type,
        "role": session.role,
        "status": session.status,
        "ats_score": session.ats_score,
        "performance_percentage": session.performance_percentage,
        "overall_feedback": session.overall_feedback,
        "improvements": session.improvements,
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "resume_id": session.resume_id,
        "tab_switches": session.tab_switches,
        "window_resizes": session.window_resizes,
        "fullscreen_exits": session.fullscreen_exits,
        "latest_video_url": latest_video,
        "question_count": InterviewQuestion.objects.filter(session=session).count(),
    }


def home_page(request: HttpRequest):
    return render(request, "pages/index.html")


def auth_page(request: HttpRequest):
    return render(request, "pages/auth.html")


@login_required
def dashboard_page(request: HttpRequest):
    return render(request, "pages/dashboard.html")


@login_required
def interview_setup_page(request: HttpRequest):
    return render(request, "pages/interview_setup.html")


@login_required
def interview_page(request: HttpRequest, session_id: int):
    return render(request, "pages/interview.html", {"session_id": session_id})


@login_required
def results_page(request: HttpRequest, session_id: int):
    return render(request, "pages/results.html", {"session_id": session_id})


@login_required
def history_page(request: HttpRequest):
    return render(request, "pages/history.html")


@login_required
def profile_page(request: HttpRequest):
    return render(request, "pages/profile.html")


@login_required
def analytics_page(request: HttpRequest):
    return render(request, "pages/analytics.html")


@login_required
def leaderboard_page(request: HttpRequest):
    return render(request, "pages/leaderboard.html")


@login_required
def practice_page(request: HttpRequest):
    return render(request, "pages/practice.html")


@login_required
def admin_panel_page(request: HttpRequest):
    return render(request, "pages/admin_panel.html")


@csrf_exempt
@require_http_methods(["POST"])
def api_signup(request: HttpRequest):
    payload = _json_body(request)
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        return JsonResponse({"error": "Email and password are required"}, status=400)
    if User.objects.filter(username=email).exists():
        return JsonResponse({"error": "Account already exists"}, status=400)
    user = User.objects.create_user(username=email, email=email, password=password)
    profile = Profile.objects.create(
        user=user,
        email=email,
        full_name=(payload.get("full_name") or "").strip() or None,
        phone=(payload.get("phone") or "").strip() or None,
        target_role=(payload.get("target_role") or "").strip() or None,
        years_experience=payload.get("years_experience"),
        linkedin_url=(payload.get("linkedin_url") or "").strip() or None,
        bio=(payload.get("bio") or "").strip() or None,
    )
    login(request, user)
    return JsonResponse({"ok": True, "user": {"id": user.id, "email": user.email}, "profile": _profile_to_dict(profile)})


@csrf_exempt
@require_http_methods(["POST"])
def api_login(request: HttpRequest):
    payload = _json_body(request)
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    user = authenticate(request, username=email, password=password)
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    login(request, user)
    return JsonResponse({"ok": True, "user": {"id": user.id, "email": user.email}})


@csrf_exempt
@require_http_methods(["POST"])
def api_logout(request: HttpRequest):
    logout(request)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def api_session(request: HttpRequest):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False})
    return JsonResponse({"authenticated": True, "user": {"id": request.user.id, "email": request.user.email}})


@csrf_exempt
@login_required
@require_http_methods(["GET", "PUT"])
def api_profile(request: HttpRequest):
    profile, _ = Profile.objects.get_or_create(user=request.user, defaults={"email": request.user.email})
    if request.method == "GET":
        return JsonResponse({"profile": _profile_to_dict(profile)})
    payload = _json_body(request)
    for field in ["full_name", "phone", "target_role", "linkedin_url", "bio"]:
        if field in payload:
            value = payload.get(field)
            setattr(profile, field, value.strip() if isinstance(value, str) and value.strip() else None)
    if "years_experience" in payload:
        value = payload.get("years_experience")
        profile.years_experience = int(value) if isinstance(value, int) or (isinstance(value, str) and value.isdigit()) else None
    profile.email = request.user.email
    profile.save()
    return JsonResponse({"profile": _profile_to_dict(profile)})


@csrf_exempt
@login_required
@require_http_methods(["GET", "POST"])
def api_resumes(request: HttpRequest):
    if request.method == "GET":
        resumes = Resume.objects.filter(user=request.user).order_by("-uploaded_at")
        data = [
            {
                "id": r.id,
                "original_filename": r.original_filename,
                "ocr_text": r.ocr_text,
                "uploaded_at": r.uploaded_at.isoformat(),
                "file_url": r.file.url if r.file else None,
            }
            for r in resumes
        ]
        return JsonResponse({"resumes": data})
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "Missing file"}, status=400)
    resume = Resume.objects.create(
        user=request.user,
        file=uploaded_file,
        original_filename=uploaded_file.name,
        ocr_text=f"Resume uploaded: {uploaded_file.name}",
    )
    return JsonResponse({"resume": {"id": resume.id, "original_filename": resume.original_filename, "ocr_text": resume.ocr_text}})


@csrf_exempt
@login_required
@require_http_methods(["GET", "POST"])
def api_sessions(request: HttpRequest):
    if request.method == "GET":
        sessions = InterviewSession.objects.filter(user=request.user).order_by("-started_at")
        return JsonResponse({"sessions": [_session_to_dict(s) for s in sessions]})
    payload = _json_body(request)
    session = InterviewSession.objects.create(
        user=request.user,
        resume_id=payload.get("resume_id"),
        interview_type=payload.get("interview_type") or "general",
        role=(payload.get("role") or "").strip(),
        status="in_progress",
    )
    return JsonResponse({"session": _session_to_dict(session)})


@csrf_exempt
@login_required
@require_http_methods(["GET", "PUT"])
def api_session_detail(request: HttpRequest, session_id: int):
    session = get_object_or_404(InterviewSession, id=session_id, user=request.user)
    if request.method == "GET":
        questions = list(
            InterviewQuestion.objects.filter(session=session).order_by("question_number").values(
                "id", "question_number", "question", "answer", "score", "feedback", "video_url"
            )
        )
        emotions = list(
            EmotionSnapshot.objects.filter(session=session).values("id", "emotions", "is_nervous", "confidence_level", "captured_at")
        )
        return JsonResponse({"session": _session_to_dict(session), "questions": questions, "emotions": emotions})
    payload = _json_body(request)
    for field in ["status", "ats_score", "performance_percentage", "overall_feedback", "improvements", "tab_switches", "window_resizes", "fullscreen_exits"]:
        if field in payload:
            setattr(session, field, payload[field])
    if payload.get("end_now"):
        session.ended_at = timezone.now()
    session.save()
    return JsonResponse({"session": _session_to_dict(session)})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_questions(request: HttpRequest):
    payload = _json_body(request)
    session = get_object_or_404(InterviewSession, id=payload.get("session_id"), user=request.user)
    question = InterviewQuestion.objects.create(
        session=session,
        question_number=payload.get("question_number") or 1,
        question=payload.get("question") or "",
        answer=payload.get("answer"),
        score=payload.get("score"),
        feedback=payload.get("feedback"),
        video_url=payload.get("video_url"),
    )
    return JsonResponse({"question": {"id": question.id}})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_emotions(request: HttpRequest):
    payload = _json_body(request)
    session = get_object_or_404(InterviewSession, id=payload.get("session_id"), user=request.user)
    snap = EmotionSnapshot.objects.create(
        session=session,
        emotions=payload.get("emotions") or {},
        is_nervous=bool(payload.get("is_nervous")),
        confidence_level=payload.get("confidence_level"),
    )
    return JsonResponse({"snapshot": {"id": snap.id}})


@login_required
@require_http_methods(["GET"])
def api_analytics(request: HttpRequest):
    sessions = InterviewSession.objects.filter(user=request.user, status="completed")
    avg_perf = sessions.aggregate(avg=Avg("performance_percentage")).get("avg") or 0
    avg_ats = sessions.aggregate(avg=Avg("ats_score")).get("avg") or 0
    return JsonResponse({"summary": {"avg_performance": round(avg_perf), "avg_ats": round(avg_ats), "total": sessions.count()}})


@login_required
@require_http_methods(["GET"])
def api_leaderboard(request: HttpRequest):
    timeframe = request.GET.get("timeframe", "month")
    since = timezone.now() - (timedelta(days=7) if timeframe == "week" else timedelta(days=30))
    if timeframe == "all":
        since = timezone.make_aware(timezone.datetime(1970, 1, 1))
    rows = (
        InterviewSession.objects.filter(status="completed", started_at__gte=since, performance_percentage__isnull=False)
        .values("user_id")
        .annotate(avg_score=Avg("performance_percentage"), total=Count("id"))
        .order_by("-avg_score")[:20]
    )
    data = []
    rank = 1
    for row in rows:
        user = User.objects.filter(id=row["user_id"]).first()
        profile = Profile.objects.filter(user_id=row["user_id"]).first()
        data.append(
            {
                "rank": rank,
                "displayName": (profile.full_name if profile and profile.full_name else (user.email if user else f"User {row['user_id']}")),
                "avgScore": round(row["avg_score"] or 0),
                "totalInterviews": row["total"],
                "isCurrentUser": row["user_id"] == request.user.id,
            }
        )
        rank += 1
    return JsonResponse({"leaderboard": data})


@login_required
@require_http_methods(["GET"])
def api_admin_overview(request: HttpRequest):
    if not request.user.is_staff:
        return JsonResponse({"error": "Forbidden"}, status=403)
    users = Profile.objects.all().count()
    sessions = InterviewSession.objects.all().count()
    avg_score = InterviewSession.objects.filter(status="completed").aggregate(avg=Avg("performance_percentage")).get("avg") or 0
    return JsonResponse({"stats": {"totalUsers": users, "totalSessions": sessions, "avgScore": round(avg_score)}})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_ai_interview_chat(request: HttpRequest):
    payload = _json_body(request)
    session = get_object_or_404(InterviewSession, id=payload.get("session_id"), user=request.user)
    resume_text = ""
    if session.resume and session.resume.ocr_text:
        resume_text = session.resume.ocr_text
    reply = generate_interview_reply(session.interview_type, session.role, resume_text, payload.get("messages") or [])
    return JsonResponse({"reply": reply})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_ai_generate_feedback(request: HttpRequest):
    payload = _json_body(request)
    session = get_object_or_404(InterviewSession, id=payload.get("session_id"), user=request.user)
    questions = list(
        InterviewQuestion.objects.filter(session=session).order_by("question_number").values("question_number", "question", "answer")
    )
    emotions = list(EmotionSnapshot.objects.filter(session=session).values("is_nervous", "confidence_level"))
    data = generate_feedback(
        {
            "questions": questions,
            "interviewType": session.interview_type,
            "role": session.role,
            "resumeText": session.resume.ocr_text if session.resume else "",
            "emotionData": emotions,
        }
    )
    session.status = "completed"
    session.ats_score = data.get("atsScore")
    session.performance_percentage = data.get("performancePercentage")
    session.overall_feedback = data.get("overallFeedback")
    session.improvements = data.get("improvements")
    session.ended_at = timezone.now()
    session.save()
    for qf in data.get("questionFeedback", []):
        InterviewQuestion.objects.filter(session=session, question_number=qf.get("questionNumber")).update(
            score=qf.get("score"), feedback=qf.get("feedback")
        )
    return JsonResponse({"feedback": data})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_ai_interview_coach(request: HttpRequest):
    payload = _json_body(request)
    return JsonResponse({"tip": generate_coach_tip(payload.get("question", ""), payload.get("answer", ""))})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_ai_analyze_emotion(request: HttpRequest):
    confidence = random.randint(50, 80)
    nervous = random.random() > 0.6
    emotions = {
        "happy": random.randint(20, 50),
        "sad": random.randint(5, 20),
        "angry": random.randint(0, 10),
        "surprised": random.randint(5, 20),
        "fearful": random.randint(5, 25),
        "disgusted": random.randint(0, 5),
        "neutral": random.randint(30, 60),
    }
    return JsonResponse({"emotions": emotions, "is_nervous": nervous, "confidence_level": confidence})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_ai_extract_resume(request: HttpRequest):
    return JsonResponse({"text": "Resume uploaded successfully. OCR text extraction is currently simplified in Django migration."})


@require_http_methods(["GET"])
def chrome_devtools_probe(request: HttpRequest):
    return JsonResponse({}, status=204)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_upload_answer_video(request: HttpRequest):
    session = get_object_or_404(InterviewSession, id=request.POST.get("session_id"), user=request.user)
    question_number_raw = request.POST.get("question_number")
    question_number = int(question_number_raw) if question_number_raw and question_number_raw.isdigit() else 1
    uploaded_file = request.FILES.get("video")
    if not uploaded_file:
        return JsonResponse({"error": "Missing video file"}, status=400)
    timestamp = int(timezone.now().timestamp() * 1000)
    file_name = f"q{question_number}-{timestamp}.webm"
    relative_path = f"answer-videos/{request.user.id}/{session.id}/{file_name}"
    stored_path = default_storage.save(relative_path, uploaded_file)
    normalized_path = str(stored_path).replace("\\", "/")
    video_url = f"{settings.MEDIA_URL}{normalized_path}"
    InterviewQuestion.objects.filter(session=session, question_number=question_number).order_by("-id").update(
        video_url=video_url
    )
    return JsonResponse({"video_url": video_url})
