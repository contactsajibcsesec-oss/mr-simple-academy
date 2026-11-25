import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./style.css";

const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY 
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) 
  : null;

const ACCEPT = "image/jpeg,image/png,application/pdf";
const BUCKET_Q = "academy-question-files";
const validFile = f => f && ["image/jpeg", "image/png", "application/pdf"].includes(f.type) && f.size <= 8 * 1024 * 1024;

const MathText = ({ text = "" }) => {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let h = esc(text)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => `<span class="math-block">${katex.renderToString(m, { throwOnError: false, displayMode: true })}</span>`)
    .replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, m) => katex.renderToString(m, { throwOnError: false }));
  return <div className="math-text" dangerouslySetInnerHTML={{ __html: h }} />;
};

const Icon = ({ children }) => <span className="nav-icon">{children}</span>;

/* ── Live Examination Timer Component ───────────────────────────── */
function ExamCountdownTimer({ startsAt, durationMinutes, onTimeUp }) {
  const durationMs = Number(durationMinutes || 30) * 60 * 1000;
  const startMs = startsAt ? new Date(startsAt).getTime() : Date.now();
  const endsAt = startMs + durationMs;
  
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        onTimeUp && onTimeUp();
      }
    };
    timerRef.current = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timerRef.current);
  }, [endsAt, onTimeUp]);

  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const isWarning = remaining <= 300 && remaining > 0;
  const isDanger = remaining <= 60 && remaining > 0;
  const cls = `countdown-timer${isWarning ? " warning" : ""}${isDanger ? " danger" : ""}`;

  if (remaining <= 0) return <span className="countdown-timer ended">⏰ পরীক্ষার সময় শেষ!</span>;
  return <span className={cls}>⏱ বাকি সময়: {hrs > 0 ? `${hrs}:` : ""}{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>;
}

/* ── 12-Hour Assignment Window Countdown ───────────────────────── */
function DeadlineCountdown({ assignedAt, startsAt, durationHours = 12 }) {
  const baseTime = assignedAt || startsAt || new Date().toISOString();
  const deadline = new Date(baseTime).getTime() + (durationHours * 60 * 60 * 1000);
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.floor((deadline - Date.now()) / 1000)));

  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (remaining <= 0) return <span className="exam-deadline-badge urgent">⏰ সময় শেষ (Expired)</span>;
  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const isUrgent = hrs < 2;

  return (
    <span className={`exam-deadline-badge ${isUrgent ? "urgent" : ""}`}>
      ⏳ পরীক্ষায় বসার বাকি: {hrs > 0 ? `${hrs}h ` : ""}{mins}m {secs}s
    </span>
  );
}

/* ── Unified Academy Footer Component ───────────────────────────── */
function AcademyFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-top">
          {/* Academy Info */}
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <span className="footer-logo-icon">🎓</span>
              <div>
                <b>MR. SIMPLE ACADEMY</b>
                <small>Online Examination & Assessment Portal</small>
              </div>
            </div>
            <p className="footer-bio">
              সহজ, নির্ভরযোগ্য ও আধুনিক পরীক্ষা পদ্ধতি। এখানে শিক্ষার্থীরা তাদের প্রস্তুতি যাচাই এবং শিক্ষকের সরাসরি পয়েন্টভিত্তিক মতামত পেতে পারে।
            </p>
          </div>

          {/* Teacher Info */}
          <div className="footer-col teacher-col">
            <div className="teacher-card-inner">
              <div className="teacher-header">
                <div className="teacher-avatar">HS</div>
                <div className="teacher-meta">
                  <span className="teacher-tag">👨‍🏫 Instructor</span>
                  <h3 className="teacher-title">Hasnat Sajib</h3>
                  <p className="teacher-degree">Computer Science & Engineering</p>
                  <p className="teacher-institute">Sylhet Engineering College (SUST)</p>
                </div>
              </div>
              <div className="teacher-contact-row">
                <a href="tel:01897410417" className="contact-btn phone">
                  📞 <span>01897410417</span>
                </a>
                <a 
                  href="https://wa.me/8801897410417" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="contact-btn whatsapp"
                >
                  💬 <span>WhatsApp Message</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} <b>Mr. Simple Academy</b> · Hasnat Sajib</p>
        </div>
      </div>
    </footer>
  );
}

function App() {
  // Auth & General States
  const [studentCode, setStudentCode] = useState("");
  const [code, setCode] = useState(() => localStorage.getItem("msa_saved_code") || "");
  const [rememberCode, setRememberCode] = useState(true);
  const [student, setStudent] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Student Portal Navigation & Data
  const [studentTab, setStudentTab] = useState("assigned"); // 'assigned' | 'submitting' | 'results' | 'tuition'
  const [submittingExams, setSubmittingExams] = useState([]);
  const [results, setResults] = useState([]);
  const [tuitionSessions, setTuitionSessions] = useState([]);
  const [tuitionMonth, setTuitionMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [activeExam, setActiveExam] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [questionUrls, setQuestionUrls] = useState({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState(null);
  const [uploadedAnswerNames, setUploadedAnswerNames] = useState({});

  // Admin Navigation & Main Collections
  const [page, setPage] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [adminTuitionSessions, setAdminTuitionSessions] = useState([]);
  const [tuitionForm, setTuitionForm] = useState({ student_id: "", session_date: new Date().toISOString().slice(0, 10), topic: "" });
  const [tuitionMonthFilter, setTuitionMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [tuitionStudentFilter, setTuitionStudentFilter] = useState("");

  // Question Bank States
  const [template, setTemplate] = useState({ title: "", subject: "", chapter_name: "", description: "", total_marks: 10 });
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [templateQuestions, setTemplateQuestions] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [question, setQuestion] = useState({ text: "", type: "mcq", marks: 1, options: ["", "", "", ""], correct: "", file: null, explanation: "" });
  const [templateSearch, setTemplateSearch] = useState("");
  // Answer Review & Explanation States
  const [reviewingAttempt, setReviewingAttempt] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [templateSubjectFilter, setTemplateSubjectFilter] = useState("");
  const [templateChapterFilter, setTemplateChapterFilter] = useState("");
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);
  const [templateFileUrls, setTemplateFileUrls] = useState({});

  // Exam Scheduling States
  const [schedule, setSchedule] = useState({ template_id: "", starts_at: "", duration: 30, student_ids: [] });
  const [scheduleStudentSearch, setScheduleStudentSearch] = useState("");
  const [scheduleClassFilter, setScheduleClassFilter] = useState("");

  // Scheduled Exams States
  const [scheduledSearch, setScheduledSearch] = useState("");
  const [scheduledStatusFilter, setScheduledStatusFilter] = useState("all"); // 'all' | 'upcoming' | 'past'

  // Student Management States
  const [newStudent, setNewStudent] = useState({ name: "", class_name: "", roll_no: "", access_code: "" });
  const [studentSearch, setStudentSearch] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("");
  const [editingStudent, setEditingStudent] = useState(null);
  const [resetCodeModal, setResetCodeModal] = useState(null); // { id, name, newCode: "" }
  const [lastCreatedCode, setLastCreatedCode] = useState(null); // { name, code }

  // Submissions & Grading States
  const [submissionTab, setSubmissionTab] = useState("pending"); // 'pending' | 'graded' | 'all'
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionExamFilter, setSubmissionExamFilter] = useState("");
  const [grading, setGrading] = useState(null);
  const [gradingMarks, setGradingMarks] = useState({});
  const [feedback, setFeedback] = useState("");
  const [answerUrls, setAnswerUrls] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  // Helper RPC
  const rpc = async (name, args = {}) => {
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      if (error.message && error.message.includes("does not exist")) {
        throw new Error(`এই ফিচারটি কার্যকর করতে Supabase SQL Editor-এ v1.6 migration ফাইলটি রান করতে হবে (${name})।`);
      }
      throw error;
    }
    return data;
  };

  const fileAction = async body => {
    const { data, error } = await supabase.functions.invoke("academy-file-access", { body });
    if (error) throw error;
    if (data?.error) throw Error(data.error);
    return data;
  };

  const notify = s => {
    setNotice(s);
    setTimeout(() => setNotice(""), 4500);
  };

  const copyToClipboard = async (text, label = "Code") => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} কপি করা হয়েছে: ${text}`);
    } catch {
      notify(`কপি করুন: ${text}`);
    }
  };

  const generateAccessCode = (prefix = "MSA") => {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${rand}`;
  };

  // ── Authentication Handlers ──
  async function studentLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const cleanCode = code.trim();
      const d = await rpc("student_portal_login", { p_code: cleanCode });
      if (!d?.success) throw Error("প্রবেশ কোড সঠিক নয় বা নিষ্ক্রিয়");
      if (rememberCode) {
        localStorage.setItem("msa_saved_code", cleanCode);
      } else {
        localStorage.removeItem("msa_saved_code");
      }
      setStudent({ ...d.student, exams: d.exams || [] });
      setSubmittingExams(d.submitting_exams || []);
      setStudentCode(cleanCode);
      const [resList, tsList] = await Promise.all([
        rpc("student_my_results", { p_code: cleanCode }),
        rpc("student_my_tuition_sessions", { p_code: cleanCode }).catch(() => [])
      ]);
      setResults(resList || []);
      setTuitionSessions(tsList || []);
      if (!rememberCode) setCode("");
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }

  async function adminLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!(await rpc("is_academy_admin"))) throw Error("Admin অনুমতি নেই");
      setAdmin(true);
      await loadAdmin();
    } catch (x) {
      setError(x.message);
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  async function loadAdmin() {
    try {
      const [s, t, e, a, ts] = await Promise.all([
        rpc("admin_list_students"),
        rpc("admin_list_templates"),
        rpc("admin_list_exams"),
        rpc("admin_list_attempts"),
        rpc("admin_list_tuition_sessions").catch(() => [])
      ]);
      setStudents(s || []);
      setTemplates(t || []);
      setScheduled(e || []);
      setAttempts(a || []);
      setAdminTuitionSessions(ts || []);
    } catch (x) {
      setError(x.message);
    }
  }

  async function logout() {
    if (admin) await supabase.auth.signOut();
    setAdmin(false);
    setStudent(null);
    setActiveExam(null);
    setPage("overview");
    setError("");
    setCode(localStorage.getItem("msa_saved_code") || "");
  }

  // ── Student Portal Actions ──
  async function refreshStudentDashboard() {
    try {
      const d = await rpc("student_portal_login", { p_code: studentCode });
      if (d?.success) {
        setStudent({ ...d.student, exams: d.exams || [] });
        setSubmittingExams(d.submitting_exams || []);
      }
      const [resList, tsList] = await Promise.all([
        rpc("student_my_results", { p_code: studentCode }),
        rpc("student_my_tuition_sessions", { p_code: studentCode }).catch(() => [])
      ]);
      setResults(resList || []);
      setTuitionSessions(tsList || []);
    } catch {}
  }

  // ── Admin: Tuition Tracker Handlers ──
  async function addTuitionSession(e) {
    e.preventDefault();
    try {
      if (!tuitionForm.student_id || !tuitionForm.session_date) throw Error("শিক্ষার্থী ও তারিখ নির্বাচন করুন।");
      await rpc("admin_add_tuition_session", {
        p_student_id: tuitionForm.student_id,
        p_session_date: tuitionForm.session_date,
        p_topic: tuitionForm.topic
      });
      setTuitionForm({ ...tuitionForm, topic: "" });
      await loadAdmin();
      notify("টিউশন ক্লাস সফলভাবে রেকর্ড হয়েছে!");
    } catch (x) {
      setError(x.message);
    }
  }

  async function quickMarkToday(studentId, studentName) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await rpc("admin_add_tuition_session", {
        p_student_id: studentId,
        p_session_date: today,
        p_topic: ""
      });
      await loadAdmin();
      notify(`${studentName}-এর আজকের (${today}) ক্লাস রেকর্ড হয়েছে!`);
    } catch (x) {
      setError(x.message);
    }
  }

  async function deleteTuitionSession(sessionId) {
    if (!confirm("এই ক্লাসের তারিখটি মুছে ফেলতে চান?")) return;
    try {
      await rpc("admin_delete_tuition_session", { p_session_id: sessionId });
      await loadAdmin();
      notify("ক্লাস রেকর্ড মুছে ফেলা হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function startExam(exam) {
    try {
      const d = await rpc("student_start_exam", { p_code: studentCode, p_exam_id: exam.id });
      setActiveExam(d.exam);
      setExamQuestions(d.questions || []);
      setAnswers(d.answers || {});
      const urls = {};
      for (const q of d.questions || []) {
        for (const f of q.files || []) {
          try {
            urls[f.id] = (await fileAction({ action: "question-url", exam_id: exam.id, question_id: q.id, file_id: f.id })).signed_url;
          } catch {}
        }
      }
      setQuestionUrls(urls);
      setUploadedAnswerNames({});
    } catch (x) {
      setError(x.message);
    }
  }

  async function uploadAnswer(qid, file) {
    if (!validFile(file)) throw Error("JPG, PNG অথবা PDF; সর্বোচ্চ ৮ MB।");
    setUploadingQuestionId(qid);
    try {
      const plan = await fileAction({ action: "create-answer-upload", exam_id: activeExam.id, question_id: qid, file_name: file.name, mime_type: file.type, student_code: studentCode });
      const up = await fetch(plan.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!up.ok) throw Error("Upload failed");
      await fileAction({ action: "confirm-answer-upload", exam_id: activeExam.id, question_id: qid, storage_path: plan.storage_path, file_name: file.name, mime_type: file.type, student_code: studentCode });
      setUploadedAnswerNames(prev => ({ ...prev, [qid]: [...(prev[qid] || []), file.name] }));
    } finally {
      setUploadingQuestionId(null);
    }
  }

  async function submitExam() {
    if (!confirm("পরীক্ষা জমা দিতে চাও? নিশ্চিত করো সব উত্তর দেওয়া হয়েছে।")) return;
    try {
      const res = await rpc("student_submit_exam", { p_code: studentCode, p_exam_id: activeExam.id, p_answers: answers });
      setActiveExam(null);
      await refreshStudentDashboard();
      if (res?.is_auto_graded) {
        setStudentTab("results");
        notify(`পরীক্ষা জমা হয়েছে! MCQ স্কোর: ${res.mcq_score}/${res.mcq_total}। অটোমেটিক ফলাফল ও উত্তরমালা প্রকাশিত হয়েছে।`);
      } else {
        setStudentTab("submitting");
        notify("পরীক্ষা সফলভাবে জমা হয়েছে! শিক্ষক লিখিত খাতা মূল্যায়ন করার পর ফলাফল দেখতে পাবে।");
      }
    } catch (x) {
      setError(x.message);
    }
  }

  async function openReview(attemptId) {
    setReviewLoading(true);
    setReviewingAttempt(attemptId);
    try {
      const data = await rpc("student_review_answers", { p_code: studentCode, p_attempt_id: attemptId });
      setReviewData(data);
    } catch (x) {
      setError(x.message || "উত্তরমালার তথ্য লোড করা যায়নি।");
      setReviewingAttempt(null);
    } finally {
      setReviewLoading(false);
    }
  }

  async function retakeExam(result) {
    if (!confirm(`"${result.exam_title}" পরীক্ষাটি আবার দিতে চাও?`)) return;
    try {
      await rpc("student_retake_exam", { p_code: studentCode, p_attempt_id: result.attempt_id });
      await refreshStudentDashboard();
      setStudentTab("assigned");
      notify("নতুন Retake Exam বরাদ্দ হয়েছে। Assigned Exams থেকে পরীক্ষা শুরু করো।");
    } catch (x) {
      setError(x.message);
    }
  }

  // ── Admin: Question Bank Handlers ──
  async function createTemplate(e) {
    e.preventDefault();
    try {
      const d = await rpc("admin_create_chapter_template", {
        p_title: template.title,
        p_subject: template.subject,
        p_chapter_name: template.chapter_name,
        p_description: template.description,
        p_total_marks: Number(template.total_marks)
      });
      setTemplate({ title: "", subject: "", chapter_name: "", description: "", total_marks: 10 });
      await loadAdmin();
      await openTemplate(d.id, {
        id: d.id,
        title: template.title,
        subject: template.subject,
        chapter_name: template.chapter_name,
        description: template.description,
        total_marks: Number(template.total_marks)
      });
      setPage("question-bank");
      notify("Chapter-wise Question Set তৈরি হয়েছে। এখন প্রশ্ন যোগ করো।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function openTemplate(id, templateData = null) {
    setActiveTemplate(id);
    const t = templateData || templates.find(x => x.id === id);
    if (t) {
      setEditingTemplate({
        id: t.id,
        title: t.title,
        subject: t.subject,
        chapter_name: t.chapter_name || "অন্যান্য",
        description: t.description || "",
        total_marks: t.total_marks
      });
    }
    setEditingQuestion(null);
    setQuestion({ text: "", type: "mcq", marks: 1, options: ["", "", "", ""], correct: "", file: null, explanation: "" });
    try {
      const qs = await rpc("admin_list_template_questions", { p_template_id: id });
      setTemplateQuestions(qs || []);
      const urls = {};
      for (const q of qs || []) {
        for (const f of q.files || []) {
          try {
            urls[f.id] = (await fileAction({ action: "admin-template-question-url", file_id: f.id })).signed_url;
          } catch {}
        }
      }
      setTemplateFileUrls(urls);
    } catch (x) {
      setError(x.message);
    }
  }

  async function updateTemplate(e) {
    e.preventDefault();
    if (!editingTemplate) return;
    try {
      await rpc("admin_update_template", {
        p_template_id: editingTemplate.id,
        p_title: editingTemplate.title,
        p_subject: editingTemplate.subject,
        p_chapter_name: editingTemplate.chapter_name,
        p_description: editingTemplate.description,
        p_total_marks: Number(editingTemplate.total_marks)
      });
      await loadAdmin();
      notify("Question Set-এর তথ্য আপডেট হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function setTemplateArchived(t) {
    const next = !t.is_archived;
    if (!confirm(next ? "এই Question Set Archive করতে চাও?" : "এই Question Set আবার Active করতে চাও?")) return;
    try {
      await rpc("admin_set_template_archived", { p_template_id: t.id, p_is_archived: next });
      await loadAdmin();
      if (activeTemplate === t.id && next) {
        setActiveTemplate(null);
        setEditingTemplate(null);
        setTemplateQuestions([]);
      }
      notify(next ? "Question Set Archive হয়েছে।" : "Question Set আবার Active হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function deleteTemplate(t) {
    if (!confirm(`"${t.title}" প্রশ্ন সেটটি স্থায়ীভাবে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।`)) return;
    try {
      await rpc("admin_delete_template", { p_template_id: t.id });
      if (activeTemplate === t.id) {
        setActiveTemplate(null);
        setEditingTemplate(null);
        setTemplateQuestions([]);
      }
      await loadAdmin();
      notify("Question Set মুছে ফেলা হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function saveTemplateQuestion(e) {
    e.preventDefault();
    try {
      const options = question.type === "mcq" ? question.options.map(x => x.trim()).filter(Boolean) : [];
      if (question.type === "mcq" && (options.length < 2 || !options.includes(question.correct))) {
        throw Error("কমপক্ষে ২টি Option এবং সঠিক উত্তর নির্বাচন করো।");
      }
      let d;
      if (editingQuestion) {
        try {
          await rpc("admin_update_template_question", {
            p_question_id: editingQuestion,
            p_question_text: question.text,
            p_question_type: question.type,
            p_options: options,
            p_correct_answer: question.type === "mcq" ? question.correct : null,
            p_marks: Number(question.marks),
            p_explanation: question.explanation || ""
          });
        } catch {
          await rpc("admin_update_template_question", {
            p_question_id: editingQuestion,
            p_question_text: question.text,
            p_question_type: question.type,
            p_options: options,
            p_correct_answer: question.type === "mcq" ? question.correct : null,
            p_marks: Number(question.marks)
          });
        }
        d = { id: editingQuestion };
      } else {
        try {
          d = await rpc("admin_add_template_question", {
            p_template_id: activeTemplate,
            p_question_text: question.text,
            p_question_type: question.type,
            p_options: options,
            p_correct_answer: question.type === "mcq" ? question.correct : null,
            p_marks: Number(question.marks),
            p_explanation: question.explanation || ""
          });
        } catch {
          d = await rpc("admin_add_template_question", {
            p_template_id: activeTemplate,
            p_question_text: question.text,
            p_question_type: question.type,
            p_options: options,
            p_correct_answer: question.type === "mcq" ? question.correct : null,
            p_marks: Number(question.marks)
          });
        }
      }
      if (question.file) {
        if (!validFile(question.file)) throw Error("JPG, PNG অথবা PDF; সর্বোচ্চ ৮ MB।");
        const path = `templates/${activeTemplate}/${d.id}/${crypto.randomUUID()}-${question.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from(BUCKET_Q).upload(path, question.file, { contentType: question.file.type });
        if (up.error) throw up.error;
        await rpc("admin_attach_template_question_file", {
          p_question_id: d.id,
          p_storage_path: path,
          p_file_name: question.file.name,
          p_mime_type: question.file.type
        });
      }
      setEditingQuestion(null);
      setQuestion({ text: "", type: "mcq", marks: 1, options: ["", "", "", ""], correct: "", file: null, explanation: "" });
      await openTemplate(activeTemplate);
      await loadAdmin();
      notify(editingQuestion ? "প্রশ্ন আপডেট হয়েছে।" : "নতুন প্রশ্ন সংরক্ষণ হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  function beginEditQuestion(q) {
    setEditingQuestion(q.id);
    setQuestion({
      text: q.question_text,
      type: q.question_type,
      marks: q.marks,
      options: q.options || ["", "", "", ""],
      correct: q.correct_answer || "",
      file: null,
      explanation: q.explanation || ""
    });
  }

  async function deleteTemplateQuestion(q) {
    if (!confirm("এই প্রশ্নটি স্থায়ীভাবে Delete করতে চাও?")) return;
    try {
      const paths = (q.files || []).map(f => f.storage_path).filter(Boolean);
      if (paths.length) {
        const rm = await supabase.storage.from(BUCKET_Q).remove(paths);
        if (rm.error) throw rm.error;
      }
      await rpc("admin_delete_template_question", { p_question_id: q.id });
      await openTemplate(activeTemplate);
      await loadAdmin();
      notify("প্রশ্ন Delete হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  // ── Admin: Schedule Exam Handlers ──
  async function scheduleTemplate(e) {
    e.preventDefault();
    try {
      if (!schedule.student_ids.length) throw Error("কমপক্ষে একজন শিক্ষার্থী নির্বাচন করো।");
      const d = await rpc("admin_schedule_template", {
        p_template_id: schedule.template_id,
        p_starts_at: new Date(schedule.starts_at).toISOString(),
        p_duration_minutes: Number(schedule.duration),
        p_student_ids: schedule.student_ids
      });
      await loadAdmin();
      setSchedule({ template_id: "", starts_at: "", duration: 30, student_ids: [] });
      notify(`পরীক্ষা Schedule হয়েছে। ${d.assigned_count} জন শিক্ষার্থী বরাদ্দ পেয়েছে।`);
      setPage("scheduled");
    } catch (x) {
      setError(x.message);
    }
  }

  async function deleteScheduledExam(e) {
    if (!confirm(`"${e.title}" পরীক্ষাটি ডিলিট করতে চান? শিক্ষার্থীদের কাছে এই পরীক্ষা আর থাকবে না।`)) return;
    try {
      await rpc("admin_delete_exam", { p_exam_id: e.id });
      await loadAdmin();
      notify("Scheduled Exam ডিলিট হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  // ── Admin: Student Management Handlers ──
  async function addStudent(e) {
    e.preventDefault();
    try {
      const accessCode = newStudent.access_code.trim();
      await rpc("admin_create_student", {
        p_name: newStudent.name.trim(),
        p_class_name: newStudent.class_name.trim(),
        p_roll_no: newStudent.roll_no.trim(),
        p_access_code: accessCode
      });
      setLastCreatedCode({ name: newStudent.name.trim(), code: accessCode });
      setNewStudent({ name: "", class_name: "", roll_no: "", access_code: "" });
      await loadAdmin();
      notify("নতুন শিক্ষার্থী সফলভাবে যোগ হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function updateStudent(e) {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await rpc("admin_update_student", {
        p_student_id: editingStudent.id,
        p_name: editingStudent.name.trim(),
        p_class_name: editingStudent.class_name.trim(),
        p_roll_no: editingStudent.roll_no.trim()
      });
      setEditingStudent(null);
      await loadAdmin();
      notify("শিক্ষার্থীর তথ্য আপডেট হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function deleteStudent(s) {
    if (!confirm(`"${s.name}" শিক্ষার্থীকে মুছে ফেলতে চান? শিক্ষার্থীর সব ইতিহাস মুছে যাবে।`)) return;
    try {
      await rpc("admin_delete_student", { p_student_id: s.id });
      await loadAdmin();
      notify("শিক্ষার্থী মুছে ফেলা হয়েছে।");
    } catch (x) {
      setError(x.message);
    }
  }

  async function saveResetCode(e) {
    e.preventDefault();
    if (!resetCodeModal || !resetCodeModal.newCode) return;
    try {
      await rpc("admin_reset_student_code", {
        p_student_id: resetCodeModal.id,
        p_new_code: resetCodeModal.newCode.trim()
      });
      notify(`${resetCodeModal.name}-এর নতুন Access Code সংরক্ষিত: ${resetCodeModal.newCode.trim()}`);
      setResetCodeModal(null);
      await loadAdmin();
    } catch (x) {
      setError(x.message);
    }
  }

  // ── Admin: Grading Handlers ──
  async function openGrade(a) {
    setGrading(a);
    setFeedback(a.teacher_feedback || "");
    setGradingMarks(a.written_marks || {});
    const urls = {};
    for (const f of a.answer_files || []) {
      try {
        urls[f.id] = (await fileAction({ action: "admin-answer-url", file_id: f.id })).signed_url;
      } catch {}
    }
    setAnswerUrls(urls);
  }

  async function saveGrade() {
    try {
      await rpc("admin_grade_attempt", {
        p_attempt_id: grading.id,
        p_written_marks: gradingMarks,
        p_feedback: feedback
      });
      setGrading(null);
      await loadAdmin();
      notify("ফলাফল ও মার্কস সফলভাবে প্রকাশ করা হয়েছে!");
    } catch (x) {
      setError(x.message);
    }
  }

  // Navigation Items
  const pendingAttemptsCount = attempts.filter(a => a.status === "submitted" && a.graded_at == null).length;
  const adminNav = [
    { id: "overview", icon: "📊", label: "Dashboard", bangla: "ওভারভিউ" },
    { id: "students", icon: "👨‍🎓", label: "Students", bangla: "শিক্ষার্থী তালিকা", badge: students.length },
    { id: "tuition", icon: "📅", label: "Tuition Tracker", bangla: "টিউশন হাজিরা" },
    { id: "question-bank", icon: "📚", label: "Question Bank", bangla: "প্রশ্ন ব্যাংক", badge: templates.filter(t => !t.is_archived).length },
    { id: "schedule", icon: "⏰", label: "Schedule Exam", bangla: "পরীক্ষা শিডিউল" },
    { id: "scheduled", icon: "📋", label: "Scheduled Exams", bangla: "নির্ধারিত পরীক্ষা", badge: scheduled.length },
    { id: "submissions", icon: "📝", label: "Submissions & Grading", bangla: "খাতা মূল্যায়ন", badge: pendingAttemptsCount, badgeUrgent: pendingAttemptsCount > 0 }
  ];

  if (!supabase) {
    return (
      <div className="setup">
        <h1>Mr. Simple Academy</h1>
        <p>.env ফাইলে Supabase URL ও Key বসাও।</p>
      </div>
    );
  }

  // ── Modern Public Homepage & Student Portal ──
  if (!student && !admin) {
    return (
      <div className="home-wrapper">
        {/* Navigation Bar */}
        <header className="home-nav">
          <div className="nav-container">
            <div className="home-logo">
              <span className="logo-icon">🎓</span>
              <div>
                <b>MR. SIMPLE ACADEMY</b>
                <small>Online Examination & Assessment Portal</small>
              </div>
            </div>
            <div className="nav-actions">
              <button 
                className={adminMode ? "btn primary small" : "btn ghost small"} 
                onClick={() => { setAdminMode(!adminMode); setError(""); }}
              >
                {adminMode ? "👨‍🎓 শিক্ষার্থী পোর্টাল" : "👨‍🏫 শিক্ষক লগইন (Admin)"}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="home-hero">
          <div className="hero-container">
            {/* Left Column: Academy Presentation */}
            <div className="hero-content">
              <div className="hero-badge">✨ সহজ ও আধুনিক একাডেমি পোর্টাল</div>
              <h1>সহজ ও সুন্দর অনলাইন পরীক্ষা প্ল্যাটফর্ম</h1>
              <p className="hero-subtext">
                Mr. Simple Academy-তে তোমার পড়াশোনার প্রস্তুতি নিয়মিত যাচাই করো। শিক্ষক কর্তৃক নির্ধারিত পরীক্ষায় অংশ নাও, তাৎক্ষণিক MCQ ফলাফল এবং সরাসরি সৃজনশীল খাতা মূল্যায়ন পাও।
              </p>

              {/* 3 Quick Features */}
              <div className="hero-features">
                <div className="feature-item">
                  <div className="feature-icon">⚡</div>
                  <div>
                    <b>সহজ অ্যাক্সেস</b>
                    <small>কোনো জটিল পাসওয়ার্ডের ঝামেলা নেই, শিক্ষকের দেওয়া Access Code দিয়ে এক ক্লিকে প্রবেশ।</small>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">⏱️</div>
                  <div>
                    <b>লাইভ কাউন্টডাউন ও সময়সীমা</b>
                    <small>১২ ঘণ্টার সুবিধাজনক উইন্ডো এবং পরীক্ষার জন্য লাইভ টাইমার।</small>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">✍️</div>
                  <div>
                    <b>সরাসরি খাতা মূল্যায়ন</b>
                    <small>মোবাইল দিয়ে উত্তরের ছবি বা PDF আপলোড এবং শিক্ষকের পয়েন্টভিত্তিক ফিডব্যাক।</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Portal Login Card */}
            <div className="hero-card-col">
              <div className="portal-card">
                <div className="portal-card-header">
                  <div className="portal-icon">{adminMode ? "🔐" : "👨‍🎓"}</div>
                  <div>
                    <h2>{adminMode ? "Admin Portal (শিক্ষক)" : "Student Login (শিক্ষার্থী)"}</h2>
                    <p>{adminMode ? "শিক্ষক অ্যাকাউন্টে প্রবেশ করতে তথ্য দিন" : "তোমার অ্যাক্সেস কোড দিয়ে পরীক্ষায় বসো"}</p>
                  </div>
                </div>

                <form onSubmit={adminMode ? adminLogin : studentLogin} className="portal-form">
                  {adminMode ? (
                    <>
                      <label>Admin Email</label>
                      <input 
                        type="email" 
                        placeholder="admin@mrsimple.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                      />
                      <label>Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                      />
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ margin: 0 }}>Student Access Code (শিক্ষার্থীর কোড)</label>
                        {code && (
                          <button 
                            type="button" 
                            className="text-btn" 
                            style={{ padding: "2px 4px", fontSize: "11px", color: "#8b97a9" }}
                            onClick={() => { setCode(""); localStorage.removeItem("msa_saved_code"); }}
                          >
                            ✕ কোড মুছুন
                          </button>
                        )}
                      </div>
                      <input 
                        value={code} 
                        onChange={e => setCode(e.target.value)} 
                        placeholder="যেমন: MSA-123456" 
                        required 
                      />
                      <label className="remember-code-label">
                        <input 
                          type="checkbox" 
                          checked={rememberCode} 
                          onChange={e => {
                            setRememberCode(e.target.checked);
                            if (!e.target.checked) localStorage.removeItem("msa_saved_code");
                          }} 
                        />
                        <span>আমার Access Code মনে রাখো (Remember my code)</span>
                      </label>
                    </>
                  )}

                  <button className="btn primary full portal-submit-btn" disabled={busy}>
                    {busy ? "যাচাই করা হচ্ছে..." : (adminMode ? "Sign In to Admin Portal" : "পরীক্ষায় প্রবেশ করো (Enter Portal) →")}
                  </button>
                </form>

                {error && <div className="error" style={{ marginTop: "14px" }}>{error}</div>}

                <div className="portal-footer">
                  <button 
                    type="button" 
                    className="text-btn" 
                    onClick={() => { setAdminMode(!adminMode); setError(""); }}
                  >
                    {adminMode ? "← শিক্ষার্থী প্রবেশদ্বার (Student Login)" : "শিক্ষক হিসেবে প্রবেশ করতে চাও? Admin Login →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Steps Guide Section */}
        <section className="steps-section">
          <div className="steps-container">
            <div className="section-title-center">
              <small>HOW IT WORKS</small>
              <h2>কীভাবে পরীক্ষায় অংশ নেবে?</h2>
              <p>মাত্র ৩টি সহজ ধাপে পরীক্ষা দেওয়া ও ফলাফল পাওয়া</p>
            </div>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-num">১</div>
                <h3>কোড দিয়ে প্রবেশ</h3>
                <p>শিক্ষকের কাছ থেকে পাওয়া ইউনিক অ্যাক্সেস কোড দিয়ে তোমার অ্যাকাউন্টে লগইন করো।</p>
              </div>
              <div className="step-card">
                <div className="step-num">২</div>
                <h3>পরীক্ষা সম্পন্ন করো</h3>
                <p>নির্ধারিত সময়ের মধ্যে পরীক্ষা শুরু করে MCQ দাগাও এবং লিখিত উত্তরের ছবি বা PDF জমা দাও।</p>
              </div>
              <div className="step-card">
                <div className="step-num">৩</div>
                <h3>ফলাফল ও পরামর্শ</h3>
                <p>শিক্ষক খাতা মূল্যায়ন করলে তোমার ড্যাশবোর্ডে প্রাপ্ত নম্বর ও বিস্তারিত ফিডব্যাক দেখো।</p>
              </div>
            </div>
          </div>
        </section>

        {/* Home Footer with Teacher & Contact Details */}
        <AcademyFooter />
      </div>
    );
  }

  // ── Active Exam Screen (With Live Countdown) ──
  if (student && activeExam) {
    return (
      <div className="student-shell">
        <header className="topbar">
          <b>🎓 MR. SIMPLE ACADEMY</b>
          <button className="btn ghost" onClick={() => setActiveExam(null)}>ড্যাশবোর্ডে ফিরুন</button>
        </header>
        <main className="content narrow">
          <div className="exam-top-bar">
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: "20px", color: "#1b3256" }}>{activeExam.title}</h1>
              <p style={{ margin: 0, fontSize: "13px", color: "#697a92" }}>
                {activeExam.subject} · মোট {activeExam.total_marks} নম্বর · {activeExam.duration_minutes} মিনিট
              </p>
            </div>
            <ExamCountdownTimer 
              startsAt={activeExam.started_at || new Date().toISOString()} 
              durationMinutes={activeExam.duration_minutes} 
              onTimeUp={submitExam} 
            />
          </div>

          {examQuestions.map((q, i) => (
            <section className="card question-card" key={q.id}>
              <small>QUESTION {i + 1} · {q.marks} MARKS</small>
              <MathText text={q.question_text} />
              {(q.files || []).map(f => (
                <p key={f.id}><a href={questionUrls[f.id]} target="_blank" rel="noreferrer">{f.file_name} দেখো ↗</a></p>
              ))}
              {q.question_type === "mcq" ? (
                <div className="answer-options">
                  {(q.options || []).map((o, j) => (
                    <label key={j}>
                      <input 
                        type="radio" 
                        name={q.id} 
                        checked={answers[q.id] === o} 
                        onChange={() => setAnswers({ ...answers, [q.id]: o })} 
                      />
                      <MathText text={o} />
                    </label>
                  ))}
                </div>
              ) : (
                <>
                  <textarea 
                    rows="5" 
                    placeholder="এখানে লিখিত উত্তর টাইপ করতে পারো..." 
                    value={answers[q.id] || ""} 
                    onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} 
                  />
                  <label className="file-pick">
                    উত্তরের ছবি/PDF আপলোড করো
                    <input 
                      type="file" 
                      accept={ACCEPT} 
                      disabled={uploadingQuestionId === q.id} 
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        try {
                          if (f) {
                            await uploadAnswer(q.id, f);
                            notify("উত্তরপত্র সফলভাবে আপলোড হয়েছে।");
                          }
                        } catch (x) {
                          setError(x.message || "উত্তরপত্র Upload করা যায়নি।");
                        }
                        e.target.value = "";
                      }} 
                    />
                    {uploadingQuestionId === q.id && <small className="uploading-status">ফাইল Upload হচ্ছে, অপেক্ষা করো...</small>}
                    {(uploadedAnswerNames[q.id] || []).map((name, index) => (
                      <small className="uploaded-status" key={index}>✓ {name} — আপলোড হয়েছে</small>
                    ))}
                  </label>
                </>
              )}
            </section>
          ))}

          {error && <p className="error">{error}</p>}
          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn primary" style={{ padding: "12px 28px", fontSize: "15px" }} onClick={submitExam}>
              Submit Exam
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Student Dashboard (4 Sections: Assigned, Submitting, Results, Tuition) ──
  if (student) {
    const monthTuitionSessions = tuitionSessions.filter(ts => ts.session_date && ts.session_date.startsWith(tuitionMonth));
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const thisMonthCount = tuitionSessions.filter(ts => ts.session_date && ts.session_date.startsWith(currentMonthPrefix)).length;

    const [tYear, tMonth] = tuitionMonth.split("-").map(Number);
    const daysInMonth = new Date(tYear, tMonth, 0).getDate();
    const firstDayWeekday = new Date(tYear, tMonth - 1, 1).getDay();
    const tuitionSessionMap = {};
    monthTuitionSessions.forEach(ts => { tuitionSessionMap[ts.session_date] = ts; });

    return (
      <div className="student-shell">
        <header className="topbar">
          <b>🎓 MR. SIMPLE ACADEMY</b>
          <button className="btn ghost" onClick={logout}>Logout</button>
        </header>
        <main className="content">
          <div className="student-profile-bar">
            <div className="student-info-left">
              <div className="student-big-avatar">{(student.name || "S")[0]}</div>
              <div>
                <span className="badge-pill-success" style={{ fontSize: "11px" }}>● স্টুডেন্ট পোর্টাল সক্রিয়</span>
                <h1 style={{ margin: "4px 0", fontSize: "24px", color: "#19365f" }}>স্বাগতম, {student.name}!</h1>
                <p style={{ margin: 0, color: "#687a93", fontSize: "13px" }}>
                  {student.class_name ? `শ্রেণি / ব্যাচ: ${student.class_name}` : "সাধারণ শিক্ষার্থী"} {student.roll_no ? `· রোল: ${student.roll_no}` : ""}
                </p>
              </div>
            </div>

            <div className="student-quick-stats">
              <div className={`quick-stat-box ${studentTab === "assigned" ? "active" : ""}`} onClick={() => setStudentTab("assigned")}>
                <small>বরাদ্দকৃত পরীক্ষা</small>
                <b>{(student.exams || []).length} টি</b>
              </div>
              <div className={`quick-stat-box ${studentTab === "submitting" ? "active" : ""}`} onClick={() => setStudentTab("submitting")}>
                <small>মূল্যায়নাধীন খাতা</small>
                <b>{submittingExams.length} টি</b>
              </div>
              <div className={`quick-stat-box ${studentTab === "results" ? "active" : ""}`} onClick={() => setStudentTab("results")}>
                <small>ফলাফল প্রকাশিত</small>
                <b>{results.length} টি</b>
              </div>
              <div className={`quick-stat-box ${studentTab === "tuition" ? "active" : ""}`} onClick={() => setStudentTab("tuition")}>
                <small>এই মাসে ক্লাস</small>
                <b>{thisMonthCount} / ১২ দিন</b>
              </div>
            </div>
          </div>

          <div className="student-tabs">
            <button className={`tab-btn ${studentTab === "assigned" ? "active" : ""}`} onClick={() => setStudentTab("assigned")}>
              📅 Assigned Exams (বরাদ্দকৃত) <span className="tab-badge">{(student.exams || []).length}</span>
            </button>
            <button className={`tab-btn ${studentTab === "submitting" ? "active" : ""}`} onClick={() => setStudentTab("submitting")}>
              ⏳ Submitting (মূল্যায়নাধীন) <span className="tab-badge">{submittingExams.length}</span>
            </button>
            <button className={`tab-btn ${studentTab === "results" ? "active" : ""}`} onClick={() => setStudentTab("results")}>
              🏆 Results (ফলাফল ও ইতিহাস) <span className="tab-badge">{results.length}</span>
            </button>
            <button className={`tab-btn ${studentTab === "tuition" ? "active" : ""}`} onClick={() => setStudentTab("tuition")}>
              📖 Tuition Classes (ক্লাস হাজিরা) <span className="tab-badge">{thisMonthCount}/12</span>
            </button>
          </div>

          {studentTab === "assigned" && (
            <div>
              <div className="student-section-heading">
                <div>
                  <h2>বরাদ্দকৃত পরীক্ষা (Assigned Exams)</h2>
                  <p>শিক্ষক কর্তৃক নির্ধারিত পরীক্ষাগুলো নির্দিষ্ট সময়ের মধ্যে সম্পন্ন করো।</p>
                </div>
              </div>

              {(student.exams || []).length === 0 ? (
                <div className="empty-state">বর্তমানে তোমার জন্য কোনো পরীক্ষা নির্ধারিত নেই।</div>
              ) : (
                <div className="card-grid">
                  {(student.exams || []).map(e => (
                    <article className="modern-exam-card" key={e.id}>
                      <div>
                        <div className="exam-card-header">
                          <span className="exam-tag assigned">Assigned Exam</span>
                          <span style={{ fontSize: "11px", color: "#8998ab" }}>
                            {new Date(e.starts_at).toLocaleDateString("bn-BD")}
                          </span>
                        </div>
                        <h3 style={{ margin: "0 0 6px", fontSize: "18px", color: "#1b3256" }}>{e.title}</h3>
                        <p style={{ margin: "0 0 10px", color: "#687a93", fontSize: "13px" }}>{e.subject}</p>
                        
                        <DeadlineCountdown assignedAt={e.assigned_at} startsAt={e.starts_at} />

                        <div className="exam-meta-pills">
                          <span className="meta-pill">⏱ {e.duration_minutes} মিনিট</span>
                          <span className="meta-pill">🎯 {e.total_marks} নম্বর</span>
                        </div>
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        <button className="btn primary full" onClick={() => startExam(e)}>
                          Start Exam →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {studentTab === "submitting" && (
            <div>
              <div className="student-section-heading">
                <div>
                  <h2>জমা দেওয়া পরীক্ষা (Submitting Exams)</h2>
                  <p>যেসব পরীক্ষা তুমি সাবমিট করেছো এবং শিক্ষক কর্তৃক মূল্যায়নের অপেক্ষায় রয়েছে।</p>
                </div>
              </div>

              {submittingExams.length === 0 ? (
                <div className="empty-state">বর্তমানে মূল্যায়নাধীন কোনো পরীক্ষা জমা নেই।</div>
              ) : (
                <div className="card-grid">
                  {submittingExams.map(s => (
                    <article className="modern-exam-card" key={s.attempt_id}>
                      <div>
                        <div className="exam-card-header">
                          <span className="exam-tag submitting">Under Review</span>
                          <span style={{ fontSize: "11px", color: "#8998ab" }}>{new Date(s.submitted_at).toLocaleDateString("bn-BD")}</span>
                        </div>
                        <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "#1b3256" }}>{s.title}</h3>
                        <p style={{ margin: "0 0 12px", color: "#687a93", fontSize: "13px" }}>{s.subject}</p>

                        <div className="exam-meta-pills">
                          <span className="meta-pill">মোট নম্বর: {s.total_marks}</span>
                          {s.mcq_total > 0 && <span className="meta-pill">MCQ স্কোর: {s.mcq_score}/{s.mcq_total}</span>}
                        </div>

                        <div className="eval-status-box">
                          <div className="eval-spinner" />
                          <span style={{ fontSize: "12px", color: "#956e18", fontWeight: 600 }}>শিক্ষক তোমার উত্তরপত্র মূল্যায়ন করছেন...</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {studentTab === "results" && (
            <div>
              <div className="student-section-heading results-heading">
                <div>
                  <h2>পরীক্ষার ফলাফল ও মূল্যায়ন (Results & Performance)</h2>
                  <p>শিক্ষক কর্তৃক মূল্যায়িত সকল পরীক্ষার ফলাফল, অর্জিত নম্বর ও শিক্ষকের পরামর্শ।</p>
                </div>
                <span className="count-pill">{results.length}টি পরীক্ষা</span>
              </div>

              {results.length === 0 ? (
                <div className="empty-state">এখনো কোনো পরীক্ষার ফলাফল প্রকাশিত হয়নি।</div>
              ) : (
                <div className="results-modern-grid">
                  {results.map(r => {
                    const pct = r.total_marks > 0 ? Math.round((r.final_score / r.total_marks) * 100) : 0;
                    const isHigh = pct >= 80;
                    const isMedium = pct >= 50 && pct < 80;
                    const scoreTheme = isHigh ? "score-high" : (isMedium ? "score-medium" : "score-low");

                    return (
                      <article className="result-card-item" key={r.attempt_id}>
                        <div className="result-card-main">
                          <div className="result-info-header">
                            <span className="subject-tag">{r.subject || "সাধারণ বিষয়"}</span>
                            <span className="result-date-chip">
                              🗓️ {r.submitted_at ? new Date(r.submitted_at).toLocaleString("bn-BD") : "—"}
                            </span>
                          </div>

                          <h3 className="result-card-title">{r.exam_title}</h3>

                          {/* Teacher's Feedback Quote Bubble */}
                          <div className="result-feedback-box">
                            <span className="feedback-icon">💬</span>
                            <div className="feedback-content">
                              <b>শিক্ষকের মন্তব্য:</b>
                              <p>
                                {r.teacher_feedback 
                                  ? `"${r.teacher_feedback}"` 
                                  : (r.is_graded ? "কোনো মন্তব্য নেই। চমৎকার প্রচেষ্টা!" : "শিক্ষক খাতা মূল্যায়ন করছেন, শীঘ্রই মন্তব্য প্রকাশিত হবে।")}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="result-card-side">
                          <div className={`score-display-box ${scoreTheme}`}>
                            {r.is_graded ? (
                              <>
                                <small>অর্জিত নম্বর</small>
                                <div className="score-val">
                                  <strong>{r.final_score}</strong>
                                  <span>/{r.total_marks}</span>
                                </div>
                                <span className="score-pct-chip">{pct}% স্কোর</span>
                              </>
                            ) : (
                              <span className="eval-wait-chip">⏳ মূল্যায়ন চলছে</span>
                            )}
                          </div>

                          <div className="result-action-col">
                            <button 
                              className="btn primary small review-action-btn" 
                              disabled={!r.is_graded} 
                              onClick={() => openReview(r.attempt_id)}
                            >
                              📖 উত্তরমালা ও ব্যাখ্যা
                            </button>
                            <button 
                              className="btn outline small retake-action-btn" 
                              disabled={!r.is_graded} 
                              onClick={() => retakeExam(r)}
                            >
                              🔄 {r.is_graded ? "আবার পরীক্ষা দাও" : "ফলাফলের অপেক্ষায়"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Section 4: Tuition Class Attendance Tracker ── */}
          {studentTab === "tuition" && (
            <div>
              <div className="student-section-heading">
                <div>
                  <h2>টিউশন ক্লাস হাজিরা (Tuition Attendance)</h2>
                  <p>সপ্তাহে ৩ দিন / মাসে ১২ দিনের পড়ানোর হিসাব ও তারিখসমূহ।</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ margin: 0, fontSize: "12px" }}>মাস নির্বাচন:</label>
                  <input 
                    type="month" 
                    value={tuitionMonth} 
                    onChange={e => setTuitionMonth(e.target.value)} 
                    style={{ width: "auto", padding: "7px 12px", fontSize: "13px" }}
                  />
                </div>
              </div>

              {/* Monthly Progress Summary */}
              <section className="card tuition-progress-card">
                <div className="tuition-progress-head">
                  <div>
                    <small style={{ color: "#718096", fontWeight: 700 }}>মাসিক টিউশন অগ্রগতি ({tuitionMonth})</small>
                    <h3 style={{ margin: "4px 0 0", fontSize: "22px", color: "#19365f" }}>
                      {monthTuitionSessions.length} / ১২ দিন সম্পন্ন
                    </h3>
                  </div>
                  {monthTuitionSessions.length >= 12 ? (
                    <span className="badge-pill-success" style={{ fontSize: "12px", padding: "6px 12px" }}>
                      ✅ এই মাসের ১২ দিন পূর্ণ হয়েছে!
                    </span>
                  ) : (
                    <span className="badge-pill-warning" style={{ fontSize: "12px", padding: "6px 12px" }}>
                      ⏳ আরও {12 - monthTuitionSessions.length} দিন বাকি
                    </span>
                  )}
                </div>
                <div className="tuition-progress-track">
                  <div 
                    className="tuition-progress-fill" 
                    style={{ width: `${Math.min(100, Math.round((monthTuitionSessions.length / 12) * 100))}%` }}
                  />
                </div>
              </section>

              <div className="tuition-grid-layout">
                {/* Interactive Monthly Calendar */}
                <section className="card">
                  <h3 style={{ margin: "0 0 14px", fontSize: "16px", color: "#19365f" }}>📅 মাসিক ক্যালেন্ডার ভিউ</h3>
                  <div className="calendar-weekdays">
                    {["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"].map(d => (
                      <div key={d} className="calendar-weekday">{d}</div>
                    ))}
                  </div>
                  <div className="calendar-days-grid">
                    {Array.from({ length: firstDayWeekday }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="calendar-day empty" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const dateStr = `${tuitionMonth}-${String(day).padStart(2, "0")}`;
                      const session = tuitionSessionMap[dateStr];
                      const isToday = dateStr === new Date().toISOString().slice(0, 10);
                      return (
                        <div 
                          key={day} 
                          className={`calendar-day ${session ? "taught" : ""} ${isToday ? "today" : ""}`}
                          title={session ? `ক্লাস হয়েছে${session.topic ? `: ${session.topic}` : ""}` : ""}
                        >
                          <span>{day}</span>
                          {session && <small className="day-check">✓</small>}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Date-by-date list */}
                <section className="card">
                  <h3 style={{ margin: "0 0 14px", fontSize: "16px", color: "#19365f" }}>
                    📝 যে যে দিন ক্লাস হয়েছে ({monthTuitionSessions.length} দিন)
                  </h3>
                  {monthTuitionSessions.length === 0 ? (
                    <div className="empty-state">এই মাসে এখনো কোনো ক্লাস রেকর্ড করা হয়নি।</div>
                  ) : (
                    <div className="tuition-date-list">
                      {monthTuitionSessions.map((ts, idx) => (
                        <div className="tuition-date-item" key={ts.id}>
                          <div className="tuition-day-badge">#{monthTuitionSessions.length - idx}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <b>
                              {new Date(ts.session_date + "T00:00:00").toLocaleDateString("bn-BD", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                              })}
                            </b>
                            {ts.topic && <small style={{ display: "block", color: "#4a5568", marginTop: "3px" }}>টপিক: {ts.topic}</small>}
                          </div>
                          <span className="badge-pill-success">✓ সম্পন্ন</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" style={{ marginTop: "20px" }}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError("")}>✕</button>
            </div>
          )}
          {notice && <div className="toast success-toast">{notice}</div>}
        </main>

        {/* ── Student Answer Review & Explanation Modal ── */}
        {reviewingAttempt && (
          <div className="modal-overlay">
            <div className="review-modal-card">
              <div className="section-head">
                <div>
                  <span className="exam-tag assigned">উত্তরমালার পর্যালোচনা ও ব্যাখ্যা</span>
                  <h2 style={{ marginTop: "6px" }}>{reviewData?.exam?.title || "পরীক্ষার ফলাফল"}</h2>
                  <p>{reviewData?.exam?.subject} · মোট পূর্ণমান: {reviewData?.exam?.total_marks} নম্বর</p>
                </div>
                <button className="text-btn" onClick={() => { setReviewingAttempt(null); setReviewData(null); }}>
                  ✕ বন্ধ করুন
                </button>
              </div>

              {reviewLoading ? (
                <div className="eval-status-box" style={{ margin: "30px 0" }}>
                  <div className="eval-spinner" />
                  <span>উত্তরমালার তথ্য লোড হচ্ছে, অপেক্ষা করো...</span>
                </div>
              ) : reviewData ? (
                <div>
                  {/* Score Top Banner */}
                  <div className="review-score-banner">
                    <div>
                      <small>সর্বমোট অর্জিত স্কোর</small>
                      <h3>{reviewData.attempt?.final_score} / {reviewData.exam?.total_marks}</h3>
                    </div>
                    {reviewData.attempt?.mcq_total > 0 && (
                      <div>
                        <small>MCQ স্কোর</small>
                        <h3 style={{ color: "#2b6cb0" }}>{reviewData.attempt?.mcq_score} / {reviewData.attempt?.mcq_total}</h3>
                      </div>
                    )}
                    {reviewData.attempt?.written_score > 0 && (
                      <div>
                        <small>লিখিত স্কোর</small>
                        <h3 style={{ color: "#2b6cb0" }}>{reviewData.attempt?.written_score} নম্বর</h3>
                      </div>
                    )}
                  </div>

                  {/* Questions & Explanations List */}
                  <div className="review-questions-list">
                    {(reviewData.questions || []).map((q, i) => {
                      const isMcq = q.question_type === "mcq";
                      const isCorrect = q.is_correct === true;
                      const isWrong = isMcq && q.student_answer && !isCorrect;

                      return (
                        <div className={`review-question-card ${isCorrect ? "q-correct" : (isWrong ? "q-wrong" : "")}`} key={q.id}>
                          <div className="review-q-header">
                            <span className="review-q-num">প্রশ্ন {i + 1}</span>
                            <div className="review-q-status">
                              {isMcq ? (
                                isCorrect ? (
                                  <span className="badge-pill-success">✓ সঠিক উত্তর (+{q.marks})</span>
                                ) : isWrong ? (
                                  <span className="badge-pill-danger">✗ ভুল উত্তর (০/{q.marks})</span>
                                ) : (
                                  <span className="badge-pill-warning">⚪ উত্তর দেওয়া হয়নি (০/{q.marks})</span>
                                )
                              ) : (
                                <span className="meta-pill">লিখিত প্রশ্ন ({q.marks} নম্বর)</span>
                              )}
                            </div>
                          </div>

                          <div className="review-q-text">
                            <MathText text={q.question_text} />
                          </div>

                          {/* Image files if any */}
                          {(q.files || []).map(f => (
                            <p className="template-file-link" key={f.id}>
                              📎 <span>{f.file_name}</span>
                            </p>
                          ))}

                          {/* MCQ Options Display */}
                          {isMcq && (
                            <div className="review-options-grid">
                              {(q.options || []).map((opt, j) => {
                                const isThisCorrect = (q.correct_answer === opt);
                                const isThisStudentChoice = (q.student_answer === opt);

                                let optClass = "review-opt-neutral";
                                if (isThisCorrect) optClass = "review-opt-correct";
                                else if (isThisStudentChoice && !isThisCorrect) optClass = "review-opt-wrong";

                                return (
                                  <div className={`review-opt-item ${optClass}`} key={j}>
                                    <div className="review-opt-radio">
                                      {String.fromCharCode(65 + j)}
                                    </div>
                                    <div className="review-opt-text">
                                      <MathText text={opt} />
                                    </div>
                                    {isThisCorrect && (
                                      <span className="opt-tag-correct">✓ সঠিক উত্তর</span>
                                    )}
                                    {isThisStudentChoice && !isThisCorrect && (
                                      <span className="opt-tag-wrong">✗ তোমার ভুল উত্তর</span>
                                    )}
                                    {isThisStudentChoice && isThisCorrect && (
                                      <span className="opt-tag-chosen">✓ তোমার উত্তর</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Written Question Answer */}
                          {!isMcq && (
                            <div className="student-written-answer-box" style={{ marginTop: "12px" }}>
                              <small style={{ color: "#718096", fontWeight: 700 }}>তোমার লিখিত উত্তর:</small>
                              <p style={{ margin: "4px 0 0" }}>{q.student_answer || "কোনো লিখিত উত্তর দেওয়া হয়নি।"}</p>
                            </div>
                          )}

                          {/* Explanation Box */}
                          <div className="explanation-box">
                            <div className="explanation-title">
                              <span>💡 সঠিক উত্তরের ব্যাখ্যা (Explanation):</span>
                            </div>
                            <div className="explanation-body">
                              {q.explanation ? (
                                <MathText text={q.explanation} />
                              ) : (
                                <p style={{ margin: 0, color: "#718096", fontSize: "13px" }}>
                                  সঠিক উত্তর: <b>{q.correct_answer || "—"}</b> (এই প্রশ্নের কোনো অতিরিক্ত ব্যাখ্যা দেওয়া হয়নি)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn primary" onClick={() => { setReviewingAttempt(null); setReviewData(null); }}>
                      ✕ বন্ধ করুন (Close)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">উত্তরমালার কোনো তথ্য পাওয়া যায়নি।</div>
              )}
            </div>
          </div>
        )}

        {/* Global Footer in Student Portal */}
        <AcademyFooter />
      </div>
    );
  }

  // ── Calculate Derived Data for Admin UX ──
  const uniqueClasses = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort();
  const pendingAttempts = attempts.filter(a => a.status === "submitted" && a.graded_at == null);
  const gradedAttempts = attempts.filter(a => a.graded_at != null);

  // Filtered Students
  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.name} ${s.class_name || ""} ${s.roll_no || ""}`.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesClass = !studentClassFilter || s.class_name === studentClassFilter;
    return matchesSearch && matchesClass;
  });

  // Filtered Scheduled Exams
  const filteredScheduled = scheduled.filter(e => {
    const matchesSearch = `${e.title} ${e.subject}`.toLowerCase().includes(scheduledSearch.toLowerCase());
    const isPast = new Date(e.starts_at).getTime() + (e.duration_minutes * 60 * 1000) < Date.now();
    if (scheduledStatusFilter === "upcoming") return matchesSearch && !isPast;
    if (scheduledStatusFilter === "past") return matchesSearch && isPast;
    return matchesSearch;
  });

  // Filtered Submissions
  const filteredAttempts = attempts.filter(a => {
    const matchesTab = submissionTab === "all" 
      ? true 
      : (submissionTab === "pending" ? (a.status === "submitted" && a.graded_at == null) : a.graded_at != null);
    const matchesSearch = `${a.student_name || ""} ${a.exam_title || ""}`.toLowerCase().includes(submissionSearch.toLowerCase());
    const matchesExam = !submissionExamFilter || a.exam_id === submissionExamFilter;
    return matchesTab && matchesSearch && matchesExam;
  });

  // Questions Marks Sum for active template
  const activeTemplateQuestionMarks = templateQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
  const targetTotalMarks = editingTemplate ? Number(editingTemplate.total_marks || 0) : 0;

  // ── ADMIN PANEL INTERFACE ────────────────────────────────────────
  return (
    <div className={mobileMenuOpen ? "admin-layout menu-open" : "admin-layout"}>
      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      
      {/* ── Modern Admin Sidebar ── */}
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-logo">MS</div>
          <div>
            <b>Mr. Simple</b>
            <small>ACADEMY ADMIN</small>
          </div>
        </div>

        <div className="side-label">ACADEMY MANAGEMENT</div>
        <nav>
          {adminNav.map(item => (
            <button
              key={item.id}
              className={page === item.id ? "nav-link active" : "nav-link"}
              onClick={() => { setPage(item.id); setError(""); setMobileMenuOpen(false); }}
            >
              <Icon>{item.icon}</Icon>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span>{item.label}</span>
                <span className="nav-sublabel">{item.bangla}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`nav-count ${item.badgeUrgent ? "urgent-count" : ""}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="admin-profile">
            <div className="avatar">A</div>
            <div>
              <b>Academy Teacher</b>
              <small>Administrator</small>
            </div>
          </div>
          <button className="nav-link logout-nav" onClick={logout}>
            <Icon>🚪</Icon>
            <span>Logout (প্রস্থান)</span>
          </button>
        </div>
      </aside>

      {/* ── Admin Main Area ── */}
      <section className="admin-main">
        <header className="admin-top">
          <div className="admin-top-left">
            <button className="mobile-menu-toggle" aria-label="Open menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
            <span className="mobile-brand">MSA</span>
            <small>MR. SIMPLE ACADEMY / CONTROL PANEL</small>
          </div>
          <div className="top-actions">
            <span className="online-dot" /> 
            <span style={{ fontWeight: 600 }}>Active Online</span>
            <button className="btn ghost small" onClick={loadAdmin} title="রিলোড করুন">
              🔄 Refresh
            </button>
          </div>
        </header>

        <main className="admin-content">

          {/* ── OVERVIEW PAGE ── */}
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Dashboard Overview (এক নজরে ড্যাশবোর্ড)</h1>
                  <p>স্বাগতম! আপনার একাডেমির শিক্ষার্থী, প্রশ্নব্যাংক ও পরীক্ষার সার্বিক চিত্র।</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn outline" onClick={() => setPage("students")}>＋ শিক্ষার্থী যোগ</button>
                  <button className="btn primary" onClick={() => setPage("schedule")}>🗓️ পরীক্ষা শিডিউল</button>
                </div>
              </div>

              {/* Pending Grading Alert Banner */}
              {pendingAttemptsCount > 0 && (
                <div className="pending-alert-banner">
                  <div className="alert-icon">⚠️</div>
                  <div style={{ flex: 1 }}>
                    <b>{pendingAttemptsCount}টি পরীক্ষার খাতা মূল্যায়নের অপেক্ষায় রয়েছে!</b>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#85580a" }}>
                      শিক্ষার্থীরা উত্তরপত্র জমা দিয়েছে। নম্বর প্রদান ও ফলাফল প্রকাশ করতে এখনই খাতা দেখুন।
                    </p>
                  </div>
                  <button className="btn primary small" onClick={() => { setSubmissionTab("pending"); setPage("submissions"); }}>
                    এখনই খাতা মূল্যায়ন করুন →
                  </button>
                </div>
              )}

              {/* Actionable Stat Cards */}
              <div className="stats-grid">
                <div className="stat-card stat-clickable" onClick={() => setPage("students")}>
                  <div className="stat-top">
                    <span>👨‍🎓</span>
                    <span className="stat-jump-link">দেখুন →</span>
                  </div>
                  <small>মোট শিক্ষার্থী (Students)</small>
                  <strong>{students.length} জন</strong>
                </div>

                <div className="stat-card stat-clickable" onClick={() => setPage("question-bank")}>
                  <div className="stat-top">
                    <span>📚</span>
                    <span className="stat-jump-link">দেখুন →</span>
                  </div>
                  <small>সংরক্ষিত প্রশ্ন সেট (Question Sets)</small>
                  <strong>{templates.filter(t => !t.is_archived).length} টি</strong>
                </div>

                <div className="stat-card stat-clickable" onClick={() => setPage("scheduled")}>
                  <div className="stat-top">
                    <span>🗓️</span>
                    <span className="stat-jump-link">দেখুন →</span>
                  </div>
                  <small>নির্ধারিত পরীক্ষা (Scheduled)</small>
                  <strong>{scheduled.length} টি</strong>
                </div>

                <div className={`stat-card stat-clickable ${pendingAttemptsCount > 0 ? "stat-highlight" : ""}`} onClick={() => setPage("submissions")}>
                  <div className="stat-top">
                    <span>📝</span>
                    {pendingAttemptsCount > 0 ? <span className="badge-pill-danger">মূল্যায়ন বাকি!</span> : <span className="stat-jump-link">দেখুন →</span>}
                  </div>
                  <small>খাতা জমা (Pending / Total)</small>
                  <strong>{pendingAttemptsCount} / {attempts.length}</strong>
                </div>
              </div>

              <div className="dashboard-columns">
                {/* Recent Exams */}
                <section className="card">
                  <div className="section-head">
                    <div>
                      <h2>Recent Scheduled Exams (সাম্প্রতিক পরীক্ষা)</h2>
                      <p>শিক্ষার্থীদের জন্য নির্ধারিত সাম্প্রতিক ৫টি পরীক্ষা</p>
                    </div>
                    <button className="text-btn" onClick={() => setPage("scheduled")}>সবগুলো দেখুন →</button>
                  </div>
                  {scheduled.slice(0, 5).map(e => (
                    <div className="row-item" key={e.id}>
                      <div className="row-icon">📘</div>
                      <div className="row-main">
                        <b>{e.title}</b>
                        <small>{e.subject} · {new Date(e.starts_at).toLocaleString("bn-BD")}</small>
                      </div>
                      <span className="status-chip">{e.duration_minutes} মিনিট</span>
                    </div>
                  ))}
                  {scheduled.length === 0 && <p className="muted" style={{ padding: "15px 0" }}>এখনো কোনো পরীক্ষা নির্ধারিত হয়নি।</p>}
                </section>

                {/* Submissions Waiting for Review */}
                <section className="card">
                  <div className="section-head">
                    <div>
                      <h2>Recent Submissions (সাম্প্রতিক জমা হওয়া খাতা)</h2>
                      <p>পরীক্ষার্থীদের জমা দেওয়া সর্বশেষ উত্তরপত্র</p>
                    </div>
                    <button className="text-btn" onClick={() => setPage("submissions")}>সব মূল্যায়ন →</button>
                  </div>
                  {attempts.slice(0, 5).map(a => (
                    <div className="row-item" key={a.id}>
                      <div className="row-icon">✍️</div>
                      <div className="row-main">
                        <b>{a.student_name || "Student"}</b>
                        <small>{a.exam_title} · MCQ: {a.mcq_score}/{a.mcq_total}</small>
                      </div>
                      {a.graded_at ? (
                        <span className="status-chip" style={{ background: "#eaf7ee", color: "#18734c" }}>মূল্যায়িত</span>
                      ) : (
                        <button className="btn outline small" onClick={() => { openGrade(a); setPage("submissions"); }}>
                          খাতা দেখুন
                        </button>
                      )}
                    </div>
                  ))}
                  {attempts.length === 0 && <p className="muted" style={{ padding: "15px 0" }}>এখনো কোনো শিক্ষার্থী পরীক্ষা জমা দেয়নি।</p>}
                </section>
              </div>
            </>
          )}

          {/* ── STUDENTS MANAGEMENT PAGE ── */}
          {page === "students" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Student Management (শিক্ষার্থী ব্যবস্থাপনা)</h1>
                  <p>সকল শিক্ষার্থীর তালিকা, অ্যাক্সেস কোড তৈরি, পরিবর্তন ও মুছে ফেলার সহজ কন্ট্রোল।</p>
                </div>
                <div className="stat-counter-badge">
                  মোট শিক্ষার্থী: <b>{students.length} জন</b>
                </div>
              </div>

              {/* Just Created Access Code Banner */}
              {lastCreatedCode && (
                <div className="access-code-created-banner">
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#18734c", fontWeight: 700 }}>
                      🎉 শিক্ষার্থী সফলভাবে যুক্ত হয়েছে!
                    </span>
                    <h3 style={{ margin: "4px 0 2px", color: "#11472e" }}>{lastCreatedCode.name}</h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#256345" }}>
                      শিক্ষার্থীর Access Code: <strong style={{ letterSpacing: "1px", background: "#fff", padding: "2px 8px", borderRadius: "6px" }}>{lastCreatedCode.code}</strong>
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn primary small" onClick={() => copyToClipboard(lastCreatedCode.code, "Access Code")}>
                      📋 কোড কপি করুন
                    </button>
                    <button className="btn ghost small" onClick={() => setLastCreatedCode(null)}>
                      ✕ বন্ধ করুন
                    </button>
                  </div>
                </div>
              )}

              <div className="dashboard-columns">
                {/* Add Student Form */}
                <section className="card">
                  <div className="card-title-row">
                    <div className="section-icon">＋</div>
                    <div>
                      <h2>Add New Student (নতুন শিক্ষার্থী যোগ)</h2>
                      <p>শিক্ষার্থীর নাম, শ্রেণি ও লগইন Access Code দিয়ে যুক্ত করুন।</p>
                    </div>
                  </div>
                  <form className="form-stack" onSubmit={addStudent}>
                    <label>শিক্ষার্থীর পূর্ণ নাম *</label>
                    <input 
                      required 
                      value={newStudent.name} 
                      onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} 
                      placeholder="যেমন: Fahmid Hossen Rahat" 
                    />
                    
                    <div className="two-cols">
                      <div>
                        <label>শ্রেণি / ব্যাচ (Class / Batch)</label>
                        <input 
                          value={newStudent.class_name} 
                          onChange={e => setNewStudent({ ...newStudent, class_name: e.target.value })} 
                          placeholder="যেমন: Class 9 / HSC-25" 
                        />
                      </div>
                      <div>
                        <label>রোল নম্বর (Roll No)</label>
                        <input 
                          value={newStudent.roll_no} 
                          onChange={e => setNewStudent({ ...newStudent, roll_no: e.target.value })} 
                          placeholder="যেমন: 101" 
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ margin: 0 }}>Access Code (কমপক্ষে ৬ অক্ষর) *</label>
                        <button 
                          type="button" 
                          className="text-btn" 
                          style={{ padding: "2px 6px", fontSize: "11px" }}
                          onClick={() => setNewStudent({ ...newStudent, access_code: generateAccessCode() })}
                        >
                          ⚡ Auto Generate
                        </button>
                      </div>
                      <input 
                        required 
                        minLength={6} 
                        value={newStudent.access_code} 
                        onChange={e => setNewStudent({ ...newStudent, access_code: e.target.value })} 
                        placeholder="যেমন: MSA-839201" 
                        style={{ marginTop: "5px" }}
                      />
                      <small style={{ color: "#78879e", fontSize: "11px" }}>
                        এই কোডটি শিক্ষার্থী লগইন করার সময় ব্যবহার করবে।
                      </small>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <button className="btn primary full">
                        ＋ শিক্ষার্থী যোগ করুন (Add Student)
                      </button>
                    </div>
                  </form>
                </section>

                {/* Student List with Search & Filter */}
                <section className="card">
                  <div className="section-head">
                    <div>
                      <h2>Student List (শিক্ষার্থী তালিকা)</h2>
                      <p>ফিল্টার বা সার্চ করে শিক্ষার্থীদের তথ্য দেখুন ও ম্যানেজ করুন</p>
                    </div>
                    <span className="count-pill">{filteredStudents.length} জন</span>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="admin-filter-bar">
                    <input 
                      type="text" 
                      placeholder="🔍 নাম, শ্রেণি বা রোল দিয়ে খুঁজুন..." 
                      value={studentSearch} 
                      onChange={e => setStudentSearch(e.target.value)} 
                    />
                    <select value={studentClassFilter} onChange={e => setStudentClassFilter(e.target.value)}>
                      <option value="">সকল শ্রেণি (All Classes)</option>
                      {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="student-scroll-list">
                    {filteredStudents.map(s => (
                      <div className="student-item-card" key={s.id}>
                        <div className="avatar">{(s.name || "S")[0]}</div>
                        <div className="student-card-details">
                          <b>{s.name}</b>
                          <small>
                            {s.class_name ? `Class: ${s.class_name}` : "সাধারণ শিক্ষার্থী"} · Roll: {s.roll_no || "—"}
                          </small>
                        </div>
                        <div className="student-card-actions">
                          <button 
                            className="btn outline small" 
                            title="তথ্য এডিট করুন"
                            onClick={() => setEditingStudent({ id: s.id, name: s.name, class_name: s.class_name || "", roll_no: s.roll_no || "" })}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="btn ghost small" 
                            title="নতুন Access Code সেট করুন"
                            onClick={() => setResetCodeModal({ id: s.id, name: s.name, newCode: generateAccessCode() })}
                          >
                            🔑 Reset Code
                          </button>
                          <button 
                            className="btn danger-outline small" 
                            title="মুছে ফেলুন"
                            onClick={() => deleteStudent(s)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredStudents.length === 0 && (
                      <div className="empty-state">কোনো শিক্ষার্থী পাওয়া যায়নি।</div>
                    )}
                  </div>
                </section>
              </div>

              {/* Edit Student Modal */}
              {editingStudent && (
                <div className="modal-overlay">
                  <div className="modal-card">
                    <div className="section-head">
                      <div>
                        <h2>Edit Student Information</h2>
                        <p>{editingStudent.name}-এর তথ্য পরিবর্তন করুন</p>
                      </div>
                      <button className="text-btn" onClick={() => setEditingStudent(null)}>✕</button>
                    </div>
                    <form className="form-stack" onSubmit={updateStudent}>
                      <label>নাম *</label>
                      <input 
                        required 
                        value={editingStudent.name} 
                        onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })} 
                      />
                      <div className="two-cols">
                        <div>
                          <label>শ্রেণি (Class)</label>
                          <input 
                            value={editingStudent.class_name} 
                            onChange={e => setEditingStudent({ ...editingStudent, class_name: e.target.value })} 
                          />
                        </div>
                        <div>
                          <label>রোল (Roll)</label>
                          <input 
                            value={editingStudent.roll_no} 
                            onChange={e => setEditingStudent({ ...editingStudent, roll_no: e.target.value })} 
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                        <button className="btn primary full">সংরক্ষণ করুন (Save Changes)</button>
                        <button type="button" className="btn ghost" onClick={() => setEditingStudent(null)}>বাতিল</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Reset Code Modal */}
              {resetCodeModal && (
                <div className="modal-overlay">
                  <div className="modal-card">
                    <div className="section-head">
                      <div>
                        <h2>Reset Access Code</h2>
                        <p>{resetCodeModal.name}-এর জন্য নতুন পাসকোড সেট করুন</p>
                      </div>
                      <button className="text-btn" onClick={() => setResetCodeModal(null)}>✕</button>
                    </div>
                    <form className="form-stack" onSubmit={saveResetCode}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ margin: 0 }}>নতুন Access Code *</label>
                        <button 
                          type="button" 
                          className="text-btn" 
                          style={{ padding: "2px", fontSize: "11px" }}
                          onClick={() => setResetCodeModal({ ...resetCodeModal, newCode: generateAccessCode() })}
                        >
                          ⚡ Random Generate
                        </button>
                      </div>
                      <input 
                        required 
                        minLength={6} 
                        value={resetCodeModal.newCode} 
                        onChange={e => setResetCodeModal({ ...resetCodeModal, newCode: e.target.value })} 
                      />
                      <small style={{ color: "#78879e" }}>সেভ করার পর এই কোডটি শিক্ষার্থীকে পাঠিয়ে দিন।</small>
                      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                        <button className="btn primary full">নতুন কোড সেভ করুন</button>
                        <button type="button" className="btn ghost" onClick={() => setResetCodeModal(null)}>বাতিল</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── TUITION TRACKER PAGE ── */}
          {page === "tuition" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Tuition Attendance Tracker (টিউশন হাজিরা)</h1>
                  <p>বাসায় গিয়ে পড়ানোর দিনগুলো (সপ্তাহে ৩ দিন / মাসে ১২ দিন) রেকর্ড করুন—শিক্ষার্থী তার ড্যাশবোর্ডে দেখতে পাবে।</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ margin: 0, fontSize: "12px" }}>মাস:</label>
                  <input 
                    type="month" 
                    value={tuitionMonthFilter} 
                    onChange={e => setTuitionMonthFilter(e.target.value)} 
                    style={{ width: "auto", padding: "8px 12px" }}
                  />
                </div>
              </div>

              <div className="dashboard-columns">
                {/* Add Tuition Session Form */}
                <section className="card">
                  <div className="card-title-row">
                    <div className="section-icon">📅</div>
                    <div>
                      <h2>ক্লাস রেকর্ড করুন (Mark Class)</h2>
                      <p>যেকোনো তারিখ ও পড়ানোর টপিক লিখে সংরক্ষণ করুন।</p>
                    </div>
                  </div>
                  <form className="form-stack" onSubmit={addTuitionSession}>
                    <label>শিক্ষার্থী নির্বাচন করুন *</label>
                    <select 
                      required 
                      value={tuitionForm.student_id} 
                      onChange={e => setTuitionForm({ ...tuitionForm, student_id: e.target.value })}
                    >
                      <option value="">শিক্ষার্থী বাছাই করুন...</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.class_name ? `(${s.class_name})` : ""}
                        </option>
                      ))}
                    </select>

                    <label>ক্লাসের তারিখ *</label>
                    <input 
                      type="date" 
                      required 
                      value={tuitionForm.session_date} 
                      onChange={e => setTuitionForm({ ...tuitionForm, session_date: e.target.value })} 
                    />

                    <label>কী পড়ানো হয়েছে / টপিক (ঐচ্ছিক)</label>
                    <input 
                      type="text" 
                      value={tuitionForm.topic} 
                      onChange={e => setTuitionForm({ ...tuitionForm, topic: e.target.value })} 
                      placeholder="যেমন: Physics Chapter 2 - Vector" 
                    />

                    <div style={{ marginTop: "10px" }}>
                      <button className="btn primary full">✓ ক্লাস সেভ করুন (Save Class)</button>
                    </div>
                  </form>
                </section>

                {/* Monthly Student Summary */}
                <section className="card">
                  <div className="section-head">
                    <div>
                      <h2>মাসিক হিসাব ({tuitionMonthFilter})</h2>
                      <p>১ ক্লিকেই আজকের হাজিরা মার্ক করুন</p>
                    </div>
                    <span className="count-pill">{students.length} জন</span>
                  </div>

                  <div className="student-scroll-list" style={{ marginTop: "14px" }}>
                    {students.map(s => {
                      const sMonthSessions = adminTuitionSessions.filter(
                        ts => ts.student_id === s.id && ts.session_date && ts.session_date.startsWith(tuitionMonthFilter)
                      );
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const markedToday = adminTuitionSessions.some(
                        ts => ts.student_id === s.id && ts.session_date === todayStr
                      );
                      const pct = Math.min(100, Math.round((sMonthSessions.length / 12) * 100));

                      return (
                        <div className="tuition-admin-student-card" key={s.id}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <b>{s.name}</b>
                              <span className={sMonthSessions.length >= 12 ? "badge-pill-success" : "meta-pill"}>
                                {sMonthSessions.length} / ১২ দিন
                              </span>
                            </div>
                            <div className="tuition-progress-track" style={{ height: "6px", margin: "8px 0 4px" }}>
                              <div className="tuition-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <small style={{ color: "#718096", fontSize: "11px" }}>
                              {s.class_name || "শিক্ষার্থী"} {s.roll_no ? `· Roll ${s.roll_no}` : ""}
                            </small>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button 
                              className={`btn small ${markedToday ? "ghost" : "primary"}`}
                              disabled={markedToday}
                              onClick={() => quickMarkToday(s.id, s.name)}
                            >
                              {markedToday ? "✓ আজ সম্পন্ন" : "⚡ + আজকের ক্লাস"}
                            </button>
                            <button 
                              className="btn outline small"
                              onClick={() => setTuitionStudentFilter(tuitionStudentFilter === s.id ? "" : s.id)}
                            >
                              {tuitionStudentFilter === s.id ? "সব দেখুন" : "তারিখ দেখুন"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {students.length === 0 && <div className="empty-state">কোনো শিক্ষার্থী নেই।</div>}
                  </div>
                </section>
              </div>

              {/* Tuition History Table */}
              <section className="card" style={{ marginTop: "18px" }}>
                <div className="section-head">
                  <div>
                    <h2>পড়ানোর তারিখসমূহ ({tuitionMonthFilter})</h2>
                    <p>মাসের সব ক্লাসের বিস্তারিত তালিকা</p>
                  </div>
                  <select 
                    value={tuitionStudentFilter} 
                    onChange={e => setTuitionStudentFilter(e.target.value)}
                    style={{ width: "auto", minWidth: "200px", padding: "8px 12px" }}
                  >
                    <option value="">সকল শিক্ষার্থী</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="table-scroll" style={{ marginTop: "12px" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>DATE & DAY</th>
                        <th>STUDENT</th>
                        <th>TOPIC / NOTE</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminTuitionSessions
                        .filter(ts => ts.session_date && ts.session_date.startsWith(tuitionMonthFilter))
                        .filter(ts => !tuitionStudentFilter || ts.student_id === tuitionStudentFilter)
                        .map(ts => (
                          <tr key={ts.id}>
                            <td>
                              <b>
                                {new Date(ts.session_date + "T00:00:00").toLocaleDateString("bn-BD", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                })}
                              </b>
                            </td>
                            <td>
                              <b>{ts.student_name}</b>
                              <small>{ts.class_name || ""}</small>
                            </td>
                            <td>{ts.topic || <span className="muted">—</span>}</td>
                            <td>
                              <button className="btn danger-outline small" onClick={() => deleteTuitionSession(ts.id)}>
                                🗑️ মুছুন
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {adminTuitionSessions
                  .filter(ts => ts.session_date && ts.session_date.startsWith(tuitionMonthFilter))
                  .filter(ts => !tuitionStudentFilter || ts.student_id === tuitionStudentFilter).length === 0 && (
                  <div className="empty-state" style={{ marginTop: "12px" }}>এই মাসে কোনো ক্লাস রেকর্ড করা নেই।</div>
                )}
              </section>
            </>
          )}

          {/* ── QUESTION BANK PAGE ── */}
          {page === "question-bank" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Chapter-wise Question Bank (প্রশ্ন ব্যাংক)</h1>
                  <p>বিষয় ও অধ্যায় অনুযায়ী প্রশ্নের সেট তৈরি, এডিট ও ভবিষ্যতে বারবার শিডিউলের সুবিধা।</p>
                </div>
              </div>

              <div className="question-bank-layout">
                {/* Create Question Set Card */}
                <section className="card create-set-card">
                  <div className="card-title-row">
                    <div className="section-icon">＋</div>
                    <div>
                      <h2>Create Question Set (নতুন সেট)</h2>
                      <p>একটি সেট একটি নির্দিষ্ট Chapter ও পরীক্ষার জন্য রাখুন।</p>
                    </div>
                  </div>
                  <form className="form-stack" onSubmit={createTemplate}>
                    <label>সেটের নাম (Exam Title) *</label>
                    <input 
                      required 
                      value={template.title} 
                      onChange={e => setTemplate({ ...template, title: e.target.value })} 
                      placeholder="যেমন: Higher Math 1st Paper - Vector CQ & MCQ" 
                    />
                    
                    <div className="two-cols">
                      <div>
                        <label>বিষয় (Subject) *</label>
                        <input 
                          required 
                          value={template.subject} 
                          onChange={e => setTemplate({ ...template, subject: e.target.value })} 
                          placeholder="Physics / Mathematics" 
                        />
                      </div>
                      <div>
                        <label>অধ্যায় (Chapter) *</label>
                        <input 
                          required 
                          value={template.chapter_name} 
                          onChange={e => setTemplate({ ...template, chapter_name: e.target.value })} 
                          placeholder="যেমন: Vector" 
                        />
                      </div>
                    </div>

                    <label>মোট পূর্ণমান (Total Marks) *</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={template.total_marks} 
                      onChange={e => setTemplate({ ...template, total_marks: e.target.value })} 
                    />

                    <label>বিবরণ / নির্দেশনা (ঐচ্ছিক)</label>
                    <textarea 
                      rows="2" 
                      value={template.description} 
                      onChange={e => setTemplate({ ...template, description: e.target.value })} 
                      placeholder="পরীক্ষার নিয়মাবলী বা বিষয়বস্তু..." 
                    />

                    <div style={{ marginTop: "10px" }}>
                      <button className="btn primary full">
                        ＋ Question Bank-এ সেট সংরক্ষণ করুন
                      </button>
                    </div>
                  </form>
                </section>

                {/* Saved Sets List */}
                <section className="card saved-sets-card">
                  <div className="section-head">
                    <div>
                      <h2>Saved Question Sets (সংরক্ষিত সেট)</h2>
                      <p>{templates.filter(t => !t.is_archived).length}টি সক্রিয় সেট প্রস্তুত রয়েছে</p>
                    </div>
                    <button className="btn ghost small" onClick={loadAdmin}>↻ Refresh</button>
                  </div>

                  <input 
                    className="template-search" 
                    value={templateSearch} 
                    onChange={e => setTemplateSearch(e.target.value)} 
                    placeholder="🔍 সেট, বিষয় বা অধ্যায় দিয়ে খুঁজুন..." 
                  />
                  
                  <div className="template-filters">
                    <select value={templateSubjectFilter} onChange={e => setTemplateSubjectFilter(e.target.value)}>
                      <option value="">সকল Subject</option>
                      {[...new Set(templates.map(t => t.subject).filter(Boolean))].sort().map(v => <option key={v}>{v}</option>)}
                    </select>
                    <select value={templateChapterFilter} onChange={e => setTemplateChapterFilter(e.target.value)}>
                      <option value="">সকল Chapter</option>
                      {[...new Set(templates.map(t => t.chapter_name || "অন্যান্য").filter(Boolean))].sort().map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>

                  <label className="archived-toggle">
                    <input type="checkbox" checked={showArchivedTemplates} onChange={e => setShowArchivedTemplates(e.target.checked)} /> 
                    Archived সেটসমূহও দেখান
                  </label>

                  <div className="saved-set-list">
                    {templates
                      .filter(t => (showArchivedTemplates || !t.is_archived) && 
                                   (!templateSubjectFilter || t.subject === templateSubjectFilter) && 
                                   (!templateChapterFilter || (t.chapter_name || "অন্যান্য") === templateChapterFilter) && 
                                   (`${t.title} ${t.subject} ${t.chapter_name || ""}`.toLowerCase().includes(templateSearch.toLowerCase())))
                      .map(t => (
                        <article className={activeTemplate === t.id ? "saved-set selected" : "saved-set"} key={t.id}>
                          <div className="set-main">
                            <div className="set-badges">
                              <span className="subject-tag">{t.subject}</span>
                              <span className="chapter-tag">{t.chapter_name || "অন্যান্য"}</span>
                              {t.is_archived && <span className="archived-tag">Archived</span>}
                            </div>
                            <b>{t.title}</b>
                            <small>
                              {t.question_count || 0}টি প্রশ্ন · যোগফল {t.question_marks || 0} নম্বর · পূর্ণমান {t.total_marks}
                            </small>
                          </div>
                          <div className="set-actions">
                            <button className="btn outline small" onClick={() => openTemplate(t.id)}>
                              ✏️ প্রশ্ন যোগ/এডিট
                            </button>
                            <button 
                              className="btn primary small" 
                              disabled={t.is_archived} 
                              onClick={() => { setSchedule({ ...schedule, template_id: t.id }); setPage("schedule"); }}
                            >
                              🗓️ Schedule
                            </button>
                            <button 
                              className="btn ghost small" 
                              title="Delete Question Set" 
                              onClick={() => deleteTemplate(t)}
                            >
                              🗑️
                            </button>
                          </div>
                        </article>
                      ))}
                    {templates.length === 0 && <div className="empty-state">কোনো Question Set তৈরি করা হয়নি।</div>}
                  </div>
                </section>
              </div>

              {/* Active Question Set Management (Questions & Form) */}
              {activeTemplate && editingTemplate && (
                <section className="card question-manager" style={{ marginTop: "25px" }}>
                  <div className="section-head">
                    <div>
                      <span className="exam-tag assigned">Active Question Editor</span>
                      <h2 style={{ marginTop: "6px" }}>{editingTemplate.title} — প্রশ্ন ও বিবরণ ম্যানেজমেন্ট</h2>
                      <p>নিচ থেকে প্রশ্ন এডিট করুন, নতুন প্রশ্ন যোগ করুন এবং মোট নম্বর মেলান।</p>
                    </div>
                    <button className="btn ghost small" onClick={() => { setActiveTemplate(null); setEditingTemplate(null); setTemplateQuestions([]); setEditingQuestion(null); }}>
                      ✕ বন্ধ করুন (Close Editor)
                    </button>
                  </div>

                  {/* Marks Consistency Indicator */}
                  <div className="marks-status-indicator">
                    <span>
                      🎯 সেটের মোট পূর্ণমান: <b>{targetTotalMarks}</b>
                    </span>
                    <span>
                      📝 যুক্ত করা প্রশ্নের মোট নম্বর: <b>{activeTemplateQuestionMarks}</b>
                    </span>
                    {activeTemplateQuestionMarks === targetTotalMarks ? (
                      <span className="badge-pill-success">✓ নম্বর পূর্ণাঙ্গভাবে মিলেছে</span>
                    ) : (
                      <span className="badge-pill-warning">
                        ⚠️ পার্থক্য: {Math.abs(targetTotalMarks - activeTemplateQuestionMarks)} নম্বর বাকি
                      </span>
                    )}
                  </div>

                  {/* Template Meta Edit Grid */}
                  <form className="template-edit-grid" onSubmit={updateTemplate} style={{ marginTop: "14px" }}>
                    <div>
                      <label>সেটের নাম</label>
                      <input required value={editingTemplate.title} onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })} />
                    </div>
                    <div>
                      <label>Subject</label>
                      <input required value={editingTemplate.subject} onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} />
                    </div>
                    <div>
                      <label>Chapter</label>
                      <input required value={editingTemplate.chapter_name} onChange={e => setEditingTemplate({ ...editingTemplate, chapter_name: e.target.value })} />
                    </div>
                    <div>
                      <label>পূর্ণমান (Total Marks)</label>
                      <input type="number" min="1" value={editingTemplate.total_marks} onChange={e => setEditingTemplate({ ...editingTemplate, total_marks: e.target.value })} />
                    </div>
                    <div className="span-all">
                      <label>বিবরণ</label>
                      <textarea rows="2" value={editingTemplate.description} onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })} />
                    </div>
                    <div className="template-edit-actions span-all">
                      <button className="btn primary">তথ্য আপডেট করুন (Update Set Info)</button>
                      <button 
                        type="button" 
                        className="btn ghost" 
                        onClick={() => setTemplateArchived({ id: editingTemplate.id, is_archived: templates.find(t => t.id === editingTemplate.id)?.is_archived || false })}
                      >
                        {templates.find(t => t.id === editingTemplate.id)?.is_archived ? "Unarchive Set" : "Archive Set"}
                      </button>
                    </div>
                  </form>

                  {/* Questions List */}
                  <div className="question-manager-heading">
                    <div>
                      <h3>এই সেটের প্রশ্নসমূহ ({templateQuestions.length}টি প্রশ্ন)</h3>
                      <small>শিক্ষার্থী পরীক্ষায় এই প্রশ্নগুলো ঠিক এই ক্রমেই পাবে।</small>
                    </div>
                  </div>

                  <div className="saved-question-list">
                    {templateQuestions.map((q, i) => (
                      <article className="saved-question" key={q.id}>
                        <div className="question-number">{i + 1}</div>
                        <div className="question-detail">
                          <div className="question-meta">
                            <span>{q.question_type === "mcq" ? "MCQ প্রশ্ন" : "লিখিত / CQ প্রশ্ন"}</span>
                            <span>{q.marks} নম্বর</span>
                          </div>
                          <MathText text={q.question_text} />
                          {q.question_type === "mcq" && (q.options || []).length > 0 && (
                            <div className="question-options-preview">
                              {q.options.map((o, j) => (
                                <div key={j}>
                                  <b>{String.fromCharCode(65 + j)}.</b> <MathText text={o} />
                                </div>
                              ))}
                            </div>
                          )}
                          {q.correct_answer && (
                            <div className="correct-answer-preview">
                              ✓ সঠিক উত্তর: <MathText text={q.correct_answer} />
                            </div>
                          )}
                          {q.explanation && (
                            <div className="correct-answer-preview" style={{ color: "#b7791f", marginTop: "4px" }}>
                              💡 ব্যাখ্যা: <MathText text={q.explanation} />
                            </div>
                          )}
                          {(q.files || []).map(f => (
                            <p className="template-file-link" key={f.id}>
                              📎 <a href={templateFileUrls[f.id] || "#"} target="_blank" rel="noreferrer">{f.file_name} ↗</a>
                            </p>
                          ))}
                        </div>
                        <div className="question-actions">
                          <button className="btn outline small" onClick={() => beginEditQuestion(q)}>
                            ✏️ Edit
                          </button>
                          <button className="btn danger-outline small" onClick={() => deleteTemplateQuestion(q)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </article>
                    ))}
                    {templateQuestions.length === 0 && (
                      <div className="empty-state">এই সেটে এখনো কোনো প্রশ্ন যোগ করা হয়নি। নিচে থেকে প্রশ্ন যোগ করুন।</div>
                    )}
                  </div>

                  {/* Add / Edit Question Form */}
                  <div className="question-form-panel">
                    <div className="section-head">
                      <div>
                        <h3>{editingQuestion ? "প্রশ্ন এডিট করুন (Edit Question)" : "নতুন প্রশ্ন যোগ করুন (Add Question)"}</h3>
                        <p>গণিত বা সমীকরণের জন্য $formula$ অথবা $$formula$$ ব্যবহার করুন।</p>
                      </div>
                      {editingQuestion && (
                        <button className="text-btn" onClick={() => { setEditingQuestion(null); setQuestion({ text: "", type: "mcq", marks: 1, options: ["", "", "", ""], correct: "", file: null }); }}>
                          ✕ এডিট বাতিল
                        </button>
                      )}
                    </div>

                    {/* Quick Formula Helper Buttons */}
                    <div className="formula-chips">
                      <span style={{ fontSize: "11px", color: "#697b95", fontWeight: 600 }}>গণিত প্রতীক:</span>
                      {[
                        { label: "ভগ্নাংশ \\frac{a}{b}", text: "\\frac{a}{b}" },
                        { label: "বর্গমূল \\sqrt{x}", text: "\\sqrt{x}" },
                        { label: "পাওয়ার x^2", text: "x^{2}" },
                        { label: "কোণ \\theta", text: "\\theta" },
                        { label: "পাই \\pi", text: "\\pi" },
                        { label: "প্লাস-মাইনাস \\pm", text: "\\pm" }
                      ].map(item => (
                        <button 
                          key={item.label} 
                          type="button" 
                          className="formula-chip" 
                          onClick={() => setQuestion({ ...question, text: `${question.text} $${item.text}$` })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <form className="form-stack" onSubmit={saveTemplateQuestion} style={{ marginTop: "12px" }}>
                      <label>প্রশ্নের বিবরণ (Question Text) *</label>
                      <textarea 
                        rows="4" 
                        required 
                        value={question.text} 
                        onChange={e => setQuestion({ ...question, text: e.target.value })} 
                        placeholder="প্রশ্নের বর্ণনা লিখুন... সমীকরণের জন্য $x^2 + y^2 = r^2$ ব্যবহার করুন।" 
                      />

                      <div className="two-cols">
                        <div>
                          <label>প্রশ্নের ধরন (Question Type) *</label>
                          <select value={question.type} onChange={e => setQuestion({ ...question, type: e.target.value, correct: "" })}>
                            <option value="mcq">MCQ (বহুনির্বাচনী)</option>
                            <option value="written">Written / CQ (সৃজনশীল / লিখিত)</option>
                          </select>
                        </div>
                        <div>
                          <label>নম্বর (Marks) *</label>
                          <input 
                            type="number" 
                            min="0.5" 
                            step="0.5" 
                            value={question.marks} 
                            onChange={e => setQuestion({ ...question, marks: e.target.value })} 
                          />
                        </div>
                      </div>

                      {question.type === "mcq" && (
                        <>
                          <div className="options-builder">
                            {question.options.map((o, i) => (
                              <div key={i}>
                                <label>Option {String.fromCharCode(65 + i)}</label>
                                <input 
                                  value={o} 
                                  onChange={e => setQuestion({ ...question, options: question.options.map((v, j) => i === j ? e.target.value : v) })} 
                                  placeholder={`অপশন ${String.fromCharCode(65 + i)}`}
                                />
                              </div>
                            ))}
                          </div>
                          
                          <label>সঠিক উত্তর কোনটি? (Correct Option) *</label>
                          <select value={question.correct} onChange={e => setQuestion({ ...question, correct: e.target.value })}>
                            <option value="">সঠিক উত্তর নির্বাচন করুন</option>
                            {question.options.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </>
                      )}

                      <label>প্রশ্নের ব্যাখ্যা / Explanation (ঐচ্ছিক)</label>
                      <textarea 
                        rows="3" 
                        value={question.explanation || ""} 
                        onChange={e => setQuestion({ ...question, explanation: e.target.value })} 
                        placeholder="পরীক্ষা শেষে শিক্ষার্থী উত্তরমালার সাথে এই ব্যাখ্যা দেখতে পাবে... যেমন: F = ma সূত্রানুসারে ত্বরণ দ্বিগুণ হবে..." 
                      />

                      <label>প্রশ্নের ছবি বা PDF সংযুক্ত করুন (ঐচ্ছিক)</label>
                      <input type="file" accept={ACCEPT} onChange={e => setQuestion({ ...question, file: e.target.files?.[0] || null })} />

                      <div style={{ marginTop: "10px" }}>
                        <button className="btn primary">
                          {editingQuestion ? "💾 পরিবর্তন সংরক্ষণ করুন (Save Edit)" : "＋ প্রশ্ন সেটে যোগ করুন (Add Question)"}
                        </button>
                      </div>
                    </form>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── SCHEDULE EXAM WIZARD PAGE ── */}
          {page === "schedule" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Schedule an Exam (পরীক্ষা নির্ধারণ)</h1>
                  <p>প্রশ্নব্যাংক থেকে সেট বেছে সময় ও শিক্ষার্থী নির্বাচন করে পরীক্ষা এসাইন করুন।</p>
                </div>
              </div>

              <section className="card schedule-card">
                <form className="form-stack" onSubmit={scheduleTemplate}>
                  
                  {/* Step 1: Select Question Set */}
                  <div className="step-title">
                    <span>01</span>
                    <div>
                      <b>Select Question Set (প্রশ্ন সেট নির্বাচন)</b>
                      <small>প্রশ্নব্যাংক থেকে কোন পরীক্ষার সেটটি শিক্ষার্থীদের দেবেন তা বেছে নিন</small>
                    </div>
                  </div>

                  <select required value={schedule.template_id} onChange={e => setSchedule({ ...schedule, template_id: e.target.value })}>
                    <option value="">পরীক্ষা নির্বাচন করুন...</option>
                    {templates.filter(t => !t.is_archived).map(t => (
                      <option value={t.id} key={t.id}>
                        {t.subject} · {t.chapter_name || "অন্যান্য"} · {t.title} ({t.question_count || 0}টি প্রশ্ন, {t.total_marks} নম্বর)
                      </option>
                    ))}
                  </select>

                  {schedule.template_id && templates.find(t => t.id === schedule.template_id) && (
                    <div className="selected-template-summary">
                      <b>{templates.find(t => t.id === schedule.template_id).title}</b>
                      <span>
                        বিষয়: {templates.find(t => t.id === schedule.template_id).subject} · অধ্যায়: {templates.find(t => t.id === schedule.template_id).chapter_name || "অন্যান্য"} · {templates.find(t => t.id === schedule.template_id).question_count || 0}টি প্রশ্ন · পূর্ণমান {templates.find(t => t.id === schedule.template_id).total_marks}
                      </span>
                    </div>
                  )}

                  {/* Step 2: Date & Duration */}
                  <div className="step-title">
                    <span>02</span>
                    <div>
                      <b>Date, Time & Duration (সময় ও স্থায়িত্ব)</b>
                      <small>পরীক্ষা শুরুর সময় এবং কত মিনিট সময় পাবে তা ঠিক করুন</small>
                    </div>
                  </div>

                  <div className="two-cols">
                    <div>
                      <label>পরীক্ষা শুরু ও সক্রিয় হওয়ার সময় *</label>
                      <input 
                        type="datetime-local" 
                        required 
                        value={schedule.starts_at} 
                        onChange={e => setSchedule({ ...schedule, starts_at: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label>পরীক্ষার সময়সীমা (মিনিট) *</label>
                      <input 
                        type="number" 
                        min="1" 
                        required 
                        value={schedule.duration} 
                        onChange={e => setSchedule({ ...schedule, duration: e.target.value })} 
                      />
                    </div>
                  </div>

                  {/* Duration Quick Helpers */}
                  <div className="quick-duration-chips">
                    {[15, 20, 30, 45, 60, 90, 120].map(mins => (
                      <button 
                        key={mins} 
                        type="button" 
                        className={`chip-btn ${Number(schedule.duration) === mins ? "active" : ""}`}
                        onClick={() => setSchedule({ ...schedule, duration: mins })}
                      >
                        {mins} মিনিট
                      </button>
                    ))}
                  </div>

                  {/* Step 3: Assign Students */}
                  <div className="step-title">
                    <span>03</span>
                    <div>
                      <b>Assign Students (শিক্ষার্থী নির্বাচন)</b>
                      <small>যারা এই পরীক্ষায় অংশ নেবে তাদের নির্বাচন করুন</small>
                    </div>
                  </div>

                  {/* Student Search & Quick Select in Schedule Wizard */}
                  <div className="admin-filter-bar" style={{ margin: "10px 0" }}>
                    <input 
                      type="text" 
                      placeholder="🔍 শিক্ষার্থী খুঁজুন..." 
                      value={scheduleStudentSearch} 
                      onChange={e => setScheduleStudentSearch(e.target.value)} 
                    />
                    <select value={scheduleClassFilter} onChange={e => setScheduleClassFilter(e.target.value)}>
                      <option value="">সকল শ্রেণি (All Classes)</option>
                      {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="student-select-head">
                    <b>শিক্ষার্থী তালিকা ({students.length} জনের মধ্যে {schedule.student_ids.length} জন নির্বাচিত)</b>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button 
                        type="button" 
                        className="btn outline small" 
                        onClick={() => setSchedule({ ...schedule, student_ids: students.map(s => s.id) })}
                      >
                        সবাইকে সিলেক্ট করুন (Select All)
                      </button>
                      <button 
                        type="button" 
                        className="btn ghost small" 
                        onClick={() => setSchedule({ ...schedule, student_ids: [] })}
                      >
                        মুছে দিন (Clear)
                      </button>
                    </div>
                  </div>

                  <div className="student-check-grid">
                    {students
                      .filter(s => {
                        const matchesSearch = `${s.name} ${s.class_name || ""} ${s.roll_no || ""}`.toLowerCase().includes(scheduleStudentSearch.toLowerCase());
                        const matchesClass = !scheduleClassFilter || s.class_name === scheduleClassFilter;
                        return matchesSearch && matchesClass;
                      })
                      .map(s => (
                        <label key={s.id} className="student-check">
                          <input 
                            type="checkbox" 
                            checked={schedule.student_ids.includes(s.id)} 
                            onChange={e => setSchedule({
                              ...schedule,
                              student_ids: e.target.checked 
                                ? [...schedule.student_ids, s.id] 
                                : schedule.student_ids.filter(id => id !== s.id)
                            })} 
                          />
                          <span className="avatar small-avatar">{(s.name || "S")[0]}</span>
                          <span>
                            <b>{s.name}</b>
                            <small>{s.class_name || "Student"} · Roll {s.roll_no || "—"}</small>
                          </span>
                        </label>
                      ))}
                  </div>

                  <div className="schedule-summary">
                    <div>
                      <b style={{ fontSize: "14px", color: "#19375f" }}>
                        মোট {schedule.student_ids.length} জন শিক্ষার্থী নির্বাচন করা হয়েছে
                      </b>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#7a8a9e" }}>
                        Publish করলে শিক্ষার্থীদের ড্যাশবোর্ডে ১২ ঘণ্টার কাউন্টডাউনসহ পরীক্ষা দৃশ্যমান হবে।
                      </p>
                    </div>
                    <button className="btn primary" style={{ padding: "12px 24px" }}>
                      🚀 Publish Exam Schedule
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {/* ── SCHEDULED EXAMS PAGE ── */}
          {page === "scheduled" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Scheduled Exams (নির্ধারিত পরীক্ষাসমূহ)</h1>
                  <p>পূর্বে ও বর্তমানে শিডিউল করা সকল পরীক্ষার তালিকা এবং ফলাফল মনিটরিং।</p>
                </div>
                <button className="btn primary" onClick={() => setPage("schedule")}>
                  ＋ নতুন পরীক্ষা শিডিউল করুন
                </button>
              </div>

              <section className="card">
                {/* Filter Toolbar */}
                <div className="admin-filter-bar" style={{ marginBottom: "16px" }}>
                  <input 
                    type="text" 
                    placeholder="🔍 পরীক্ষার নাম বা বিষয় দিয়ে খুঁজুন..." 
                    value={scheduledSearch} 
                    onChange={e => setScheduledSearch(e.target.value)} 
                  />
                  <select value={scheduledStatusFilter} onChange={e => setScheduledStatusFilter(e.target.value)}>
                    <option value="all">সকল পরীক্ষা (All Exams)</option>
                    <option value="upcoming">চলমান ও আসন্ন (Upcoming)</option>
                    <option value="past">পূর্বের পরীক্ষা (Past Exams)</option>
                  </select>
                </div>

                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>EXAM TITLE</th>
                        <th>SUBJECT</th>
                        <th>SCHEDULED TIME</th>
                        <th>DURATION</th>
                        <th>TOTAL MARKS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredScheduled.map(e => (
                        <tr key={e.id}>
                          <td>
                            <b>{e.title}</b>
                            <small>{e.description || "কোনো বিবরণ নেই"}</small>
                          </td>
                          <td>
                            <span className="subject-tag">{e.subject}</span>
                          </td>
                          <td>{new Date(e.starts_at).toLocaleString("bn-BD")}</td>
                          <td>{e.duration_minutes} মিনিট</td>
                          <td><b>{e.total_marks}</b> নম্বর</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button 
                                className="btn outline small"
                                onClick={() => { setSubmissionExamFilter(e.id); setPage("submissions"); }}
                              >
                                খাতা দেখুন ↗
                              </button>
                              <button 
                                className="btn danger-outline small"
                                title="Delete Exam"
                                onClick={() => deleteScheduledExam(e)}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredScheduled.length === 0 && <div className="empty-state">কোনো পরীক্ষা শিডিউল করা নেই।</div>}
              </section>
            </>
          )}

          {/* ── SUBMISSIONS & GRADING PAGE ── */}
          {page === "submissions" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Submissions & Grading (খাতা মূল্যায়ন ও ফলাফল)</h1>
                  <p>শিক্ষার্থীদের জমা দেওয়া লিখিত ও বহুনির্বাচনী খাতা যাচাই, মার্কস প্রদান ও ফিডব্যাক।</p>
                </div>
              </div>

              {/* Submissions Filter Tabs */}
              <div className="student-tabs" style={{ marginTop: 0 }}>
                <button 
                  className={`tab-btn ${submissionTab === "pending" ? "active" : ""}`}
                  onClick={() => setSubmissionTab("pending")}
                >
                  ⏳ মূল্যায়ন বাকি (Pending) <span className="tab-badge">{pendingAttempts.length}</span>
                </button>
                <button 
                  className={`tab-btn ${submissionTab === "graded" ? "active" : ""}`}
                  onClick={() => setSubmissionTab("graded")}
                >
                  ✅ মূল্যায়িত (Graded) <span className="tab-badge">{gradedAttempts.length}</span>
                </button>
                <button 
                  className={`tab-btn ${submissionTab === "all" ? "active" : ""}`}
                  onClick={() => setSubmissionTab("all")}
                >
                  সব খাতা (All) <span className="tab-badge">{attempts.length}</span>
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="admin-filter-bar" style={{ marginBottom: "16px" }}>
                <input 
                  type="text" 
                  placeholder="🔍 শিক্ষার্থীর নাম বা পরীক্ষার নাম..." 
                  value={submissionSearch} 
                  onChange={e => setSubmissionSearch(e.target.value)} 
                />
                <select value={submissionExamFilter} onChange={e => setSubmissionExamFilter(e.target.value)}>
                  <option value="">সকল পরীক্ষা (All Exams)</option>
                  {scheduled.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>

              {/* Submissions Table */}
              <section className="card">
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>STUDENT</th>
                        <th>EXAM</th>
                        <th>MCQ SCORE</th>
                        <th>WRITTEN SCORE</th>
                        <th>SUBMITTED TIME</th>
                        <th>STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttempts.map(a => {
                        const isGraded = a.graded_at != null;
                        return (
                          <tr key={a.id}>
                            <td>
                              <b>{a.student_name || "Student"}</b>
                            </td>
                            <td>{a.exam_title}</td>
                            <td>
                              <span className="meta-pill">{a.mcq_score}/{a.mcq_total}</span>
                            </td>
                            <td>
                              {isGraded ? <b>{a.written_score} নম্বর</b> : <span className="muted">—</span>}
                            </td>
                            <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString("bn-BD") : "In progress"}</td>
                            <td>
                              {isGraded ? (
                                <span className="status-chip" style={{ background: "#eaf7ee", color: "#18734c" }}>✓ মূল্যায়িত</span>
                              ) : (
                                <span className="pending-chip">⏳ মূল্যায়নের অপেক্ষায়</span>
                              )}
                            </td>
                            <td>
                              <button 
                                className={`btn small ${isGraded ? "outline" : "primary"}`} 
                                disabled={a.status !== "submitted"} 
                                onClick={() => openGrade(a)}
                              >
                                {isGraded ? "খাতা দেখুন / পুনঃনিরীক্ষা" : "✍️ খাতা মূল্যায়ন করুন"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredAttempts.length === 0 && (
                  <div className="empty-state">এই ক্যাটাগরিতে কোনো খাতা পাওয়া যায়নি।</div>
                )}
              </section>

              {/* Dedicated Grading Modal / Drawer */}
              {grading && (
                <div className="modal-overlay">
                  <div className="grading-modal-card">
                    <div className="section-head">
                      <div>
                        <span className="exam-tag assigned">খাতা মূল্যায়ন ইন্টারফেস</span>
                        <h2 style={{ marginTop: "6px" }}>{grading.student_name} — {grading.exam_title}</h2>
                        <p>MCQ অটোমেটিক স্কোরের সাথে লিখিত উত্তরের নম্বর যুক্ত করে ফলাফল প্রকাশ করুন।</p>
                      </div>
                      <button className="text-btn" onClick={() => setGrading(null)}>✕ বন্ধ করুন</button>
                    </div>

                    <div className="grading-layout">
                      {/* Left: Questions & Student Answers */}
                      <div className="grading-questions-pane">
                        <div className="score-summary-card">
                          <div>
                            <small>MCQ স্কোর</small>
                            <h3>{grading.mcq_score} / {grading.mcq_total}</h3>
                          </div>
                          <div>
                            <small>লিখিত নম্বর (মোট)</small>
                            <h3>
                              {Object.values(gradingMarks).reduce((a, b) => a + Number(b || 0), 0)} নম্বর
                            </h3>
                          </div>
                          <div>
                            <small>সর্বমোট অর্জিত স্কোর</small>
                            <h3 style={{ color: "#18734c" }}>
                              {grading.mcq_score + Object.values(gradingMarks).reduce((a, b) => a + Number(b || 0), 0)}
                            </h3>
                          </div>
                        </div>

                        {/* Written Questions Answers */}
                        {(grading.written_questions || []).map((q, i) => (
                          <div className="grading-question-item" key={q.id}>
                            <div className="question-head">
                              <b>প্রশ্ন {i + 1} (পূর্ণমান: {q.marks} নম্বর)</b>
                            </div>
                            <div className="question-body">
                              <MathText text={q.question_text} />
                            </div>

                            <div className="student-written-answer-box">
                              <small style={{ color: "#78879e", fontWeight: 700 }}>শিক্ষার্থীর টাইপ করা উত্তর:</small>
                              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                                {grading.answers?.[q.id] || "শিক্ষার্থী টাইপ করে কোনো উত্তর লেখেনি।"}
                              </p>
                            </div>

                            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                              <label style={{ margin: 0, fontWeight: 700 }}>এই প্রশ্নে প্রাপ্ত নম্বর (Max {q.marks}):</label>
                              <input 
                                type="number" 
                                min="0" 
                                max={q.marks} 
                                step="0.5" 
                                value={gradingMarks[q.id] ?? ""} 
                                onChange={e => setGradingMarks({ ...gradingMarks, [q.id]: e.target.value })} 
                                style={{ width: "90px", fontWeight: 700 }}
                              />
                            </div>
                          </div>
                        ))}

                        {/* Uploaded Answer Files */}
                        <div style={{ marginTop: "20px" }}>
                          <h3>সংযুক্ত উত্তরের ছবি / PDF</h3>
                          {(grading.answer_files || []).length === 0 ? (
                            <p className="muted">কোনো ছবি বা PDF ফাইল সংযুক্ত করা হয়নি।</p>
                          ) : (
                            <div className="answer-files-grid">
                              {(grading.answer_files || []).map(f => (
                                <div className="answer-file-card" key={f.id}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span>📎</span>
                                    <b>{f.file_name}</b>
                                  </div>
                                  <a 
                                    className="btn outline small" 
                                    href={answerUrls[f.id]} 
                                    target="_blank" 
                                    rel="noreferrer"
                                  >
                                    বড় করে দেখুন ↗
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Feedback & Publish Action */}
                      <div className="grading-feedback-pane">
                        <h3>শিক্ষকের মূল্যায়ন ও মন্তব্য</h3>
                        <p style={{ fontSize: "12px", color: "#78879e" }}>
                          এই মন্তব্যটি শিক্ষার্থী তার রেজাল্ট শিটে দেখতে পাবে।
                        </p>

                        <div className="quick-feedback-tags">
                          {[
                            "অনেক সুন্দর ও নিখুঁত হয়েছে! 👍",
                            "হিসাবে সামান্য ভুল ছিল, তবে পদ্ধতি সঠিক।",
                            "পরের বার আরও মনোযোগ দিয়ে সময় ম্যানেজ করবে।",
                            "দারুণ প্রস্তুতি! চালিয়ে যাও।"
                          ].map(text => (
                            <button 
                              key={text} 
                              type="button" 
                              className="quick-feedback-tag" 
                              onClick={() => setFeedback(prev => prev ? `${prev} ${text}` : text)}
                            >
                              ＋ {text}
                            </button>
                          ))}
                        </div>

                        <textarea 
                          rows="6" 
                          value={feedback} 
                          onChange={e => setFeedback(e.target.value)} 
                          placeholder="শিক্ষার্থীর জন্য উৎসাহমূলক পরামর্শ বা ভুলত্রুটি তুলে ধরুন..." 
                          style={{ marginTop: "12px" }}
                        />

                        <div style={{ marginTop: "20px" }}>
                          <button className="btn primary full" style={{ padding: "14px", fontSize: "15px" }} onClick={saveGrade}>
                            🚀 ফলাফল প্রকাশ করুন (Publish Result)
                          </button>
                          <button type="button" className="btn ghost full" style={{ marginTop: "8px" }} onClick={() => setGrading(null)}>
                            বাতিল
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {error && <div className="toast error-toast">{error} <button onClick={() => setError("")}>✕</button></div>}
          {notice && <div className="toast success-toast">{notice}</div>}
        </main>
      </section>
    </div>
  );
}

export default App;
