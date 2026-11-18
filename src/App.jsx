import React,{useState,useEffect,useRef} from "react";
import {createRoot} from "react-dom/client";
import {createClient} from "@supabase/supabase-js";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./style.css";

const supabase=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
const ACCEPT="image/jpeg,image/png,application/pdf",BUCKET_Q="academy-question-files";
const validFile=f=>f&&[ "image/jpeg","image/png","application/pdf"].includes(f.type)&&f.size<=8*1024*1024;
const MathText=({text=""})=>{const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");let h=esc(text).replace(/\$\$([\s\S]+?)\$\$/g,(_,m)=>`<span class="math-block">${katex.renderToString(m,{throwOnError:false,displayMode:true})}</span>`).replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g,(_,m)=>katex.renderToString(m,{throwOnError:false}));return <div className="math-text" dangerouslySetInnerHTML={{__html:h}}/>};
const Icon=({children})=><span className="nav-icon">{children}</span>;

/* ── Live Examination Timer Component ───────────────────────────── */
function ExamCountdownTimer({startsAt,durationMinutes,onTimeUp}){
  const durationMs = Number(durationMinutes||30) * 60 * 1000;
  const startMs = startsAt ? new Date(startsAt).getTime() : Date.now();
  const endsAt = startMs + durationMs;
  
  const [remaining,setRemaining]=useState(()=>Math.max(0,Math.floor((endsAt-Date.now())/1000)));
  const timerRef=useRef(null);

  useEffect(()=>{
    const tick=()=>{
      const left=Math.max(0,Math.floor((endsAt-Date.now())/1000));
      setRemaining(left);
      if(left<=0){
        clearInterval(timerRef.current);
        onTimeUp&&onTimeUp();
      }
    };
    timerRef.current=setInterval(tick,1000);
    tick();
    return()=>clearInterval(timerRef.current);
  },[endsAt,onTimeUp]);

  const hrs=Math.floor(remaining/3600);
  const mins=Math.floor((remaining%3600)/60);
  const secs=remaining%60;
  const isWarning=remaining<=300&&remaining>0;
  const isDanger=remaining<=60&&remaining>0;
  const cls=`countdown-timer${isWarning?" warning":""}${isDanger?" danger":""}`;

  if(remaining<=0) return <span className="countdown-timer ended">⏰ পরীক্ষার সময় শেষ!</span>;
  return <span className={cls}>⏱ বাকি সময়: {hrs>0?`${hrs}:`:""}{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</span>;
}

/* ── 12-Hour Assignment Window Countdown ───────────────────────── */
function DeadlineCountdown({assignedAt,startsAt,durationHours=12}){
  const baseTime = assignedAt || startsAt || new Date().toISOString();
  const deadline = new Date(baseTime).getTime() + (durationHours * 60 * 60 * 1000);
  const [remaining,setRemaining]=useState(()=>Math.max(0,Math.floor((deadline-Date.now())/1000)));

  useEffect(()=>{
    const t=setInterval(()=>{
      const left=Math.max(0,Math.floor((deadline-Date.now())/1000));
      setRemaining(left);
      if(left<=0) clearInterval(t);
    },1000);
    return()=>clearInterval(t);
  },[deadline]);

  if(remaining<=0) return <span className="exam-deadline-badge urgent">⏰ সময় শেষ (Expired)</span>;
  const hrs=Math.floor(remaining/3600);
  const mins=Math.floor((remaining%3600)/60);
  const secs=remaining%60;
  const isUrgent=hrs<2;

  return (
    <span className={`exam-deadline-badge ${isUrgent?"urgent":""}`}>
      ⏳ পরীক্ষায় বসার বাকি: {hrs>0?`${hrs}h `:""}{mins}m {secs}s
    </span>
  );
}

function App(){
  const [studentCode,setStudentCode]=useState(""),[code,setCode]=useState(""),[student,setStudent]=useState(null),[admin,setAdmin]=useState(false),[adminMode,setAdminMode]=useState(false);
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [page,setPage]=useState("overview"),[students,setStudents]=useState([]),[templates,setTemplates]=useState([]),[scheduled,setScheduled]=useState([]),[attempts,setAttempts]=useState([]),[results,setResults]=useState([]);
  const [submittingExams,setSubmittingExams]=useState([]);
  const [studentTab,setStudentTab]=useState("assigned"); // 'assigned' | 'submitting' | 'results'
  const [template,setTemplate]=useState({title:"",subject:"",chapter_name:"",description:"",total_marks:10}),[activeTemplate,setActiveTemplate]=useState(null);
  const [question,setQuestion]=useState({text:"",type:"mcq",marks:1,options:["","","",""],correct:"",file:null});
  const [templateQuestions,setTemplateQuestions]=useState([]),[editingTemplate,setEditingTemplate]=useState(null),[editingQuestion,setEditingQuestion]=useState(null);
  const [templateSearch,setTemplateSearch]=useState(""),[templateSubjectFilter,setTemplateSubjectFilter]=useState(""),[templateChapterFilter,setTemplateChapterFilter]=useState(""),[showArchivedTemplates,setShowArchivedTemplates]=useState(false);
  const [templateFileUrls,setTemplateFileUrls]=useState({}),[mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [schedule,setSchedule]=useState({template_id:"",starts_at:"",duration:30,student_ids:[]});
  const [activeExam,setActiveExam]=useState(null),[examQuestions,setExamQuestions]=useState([]),[answers,setAnswers]=useState({}),[questionUrls,setQuestionUrls]=useState({});
  const [uploadingQuestionId,setUploadingQuestionId]=useState(null),[uploadedAnswerNames,setUploadedAnswerNames]=useState({});
  const [grading,setGrading]=useState(null),[gradingMarks,setGradingMarks]=useState({}),[feedback,setFeedback]=useState(""),[answerUrls,setAnswerUrls]=useState({});
  const [newStudent,setNewStudent]=useState({name:"",class_name:"",roll_no:"",access_code:""});

  const rpc=async(name,args={})=>{const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data};
  const fileAction=async body=>{const {data,error}=await supabase.functions.invoke("academy-file-access",{body});if(error)throw error;if(data?.error)throw Error(data.error);return data};
  const notify=(s)=>{setNotice(s);setTimeout(()=>setNotice(""),4500)};

  async function studentLogin(e){
    e.preventDefault();setError("");setBusy(true);
    try{
      const d=await rpc("student_portal_login",{p_code:code.trim()});
      if(!d?.success)throw Error("প্রবেশ কোড সঠিক নয়");
      setStudent({...d.student,exams:d.exams||[]});
      setSubmittingExams(d.submitting_exams||[]);
      setStudentCode(code.trim());
      setResults(await rpc("student_my_results",{p_code:code.trim()}));
      setCode("");
    }catch(x){setError(x.message)}finally{setBusy(false)}
  }

  async function adminLogin(e){
    e.preventDefault();setError("");
    try{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!(await rpc("is_academy_admin")))throw Error("Admin অনুমতি নেই");
      setAdmin(true);
      await loadAdmin();
    }catch(x){setError(x.message);await supabase.auth.signOut()}
  }

  async function loadAdmin(){
    try{
      const [s,t,e,a]=await Promise.all([rpc("admin_list_students"),rpc("admin_list_templates"),rpc("admin_list_exams"),rpc("admin_list_attempts")]);
      setStudents(s||[]);setTemplates(t||[]);setScheduled(e||[]);setAttempts(a||[]);
    }catch(x){setError(x.message)}
  }

  async function logout(){
    if(admin)await supabase.auth.signOut();
    setAdmin(false);setStudent(null);setActiveExam(null);setPage("overview");setError("");
  }

  async function createTemplate(e){
    e.preventDefault();
    try{
      const d=await rpc("admin_create_chapter_template",{p_title:template.title,p_subject:template.subject,p_chapter_name:template.chapter_name,p_description:template.description,p_total_marks:Number(template.total_marks)});
      setTemplate({title:"",subject:"",chapter_name:"",description:"",total_marks:10});
      await loadAdmin();
      await openTemplate(d.id,{id:d.id,title:template.title,subject:template.subject,chapter_name:template.chapter_name,description:template.description,total_marks:Number(template.total_marks)});
      setPage("question-bank");
      notify("Chapter-wise Question Set তৈরি হয়েছে। এখন প্রশ্ন যোগ করো।");
    }catch(x){setError(x.message)}
  }

  async function openTemplate(id,templateData=null){
    setActiveTemplate(id);
    const t=templateData||templates.find(x=>x.id===id);
    if(t)setEditingTemplate({id:t.id,title:t.title,subject:t.subject,chapter_name:t.chapter_name||"অন্যান্য",description:t.description||"",total_marks:t.total_marks});
    setEditingQuestion(null);
    setQuestion({text:"",type:"mcq",marks:1,options:["","","",""],correct:"",file:null});
    try{
      const qs=await rpc("admin_list_template_questions",{p_template_id:id});
      setTemplateQuestions(qs||[]);
      const urls={};
      for(const q of qs||[])for(const f of q.files||[]){try{urls[f.id]=(await fileAction({action:"admin-template-question-url",file_id:f.id})).signed_url}catch{}}
      setTemplateFileUrls(urls);
    }catch(x){setError(x.message)}
  }

  async function updateTemplate(e){
    e.preventDefault();if(!editingTemplate)return;
    try{
      await rpc("admin_update_template",{p_template_id:editingTemplate.id,p_title:editingTemplate.title,p_subject:editingTemplate.subject,p_chapter_name:editingTemplate.chapter_name,p_description:editingTemplate.description,p_total_marks:Number(editingTemplate.total_marks)});
      await loadAdmin();notify("Question Set-এর তথ্য আপডেট হয়েছে।");
    }catch(x){setError(x.message)}
  }

  async function setTemplateArchived(t){
    const next=!t.is_archived;
    if(!confirm(next?"এই Question Set Archive করতে চাও?":"এই Question Set আবার Active করতে চাও?"))return;
    try{
      await rpc("admin_set_template_archived",{p_template_id:t.id,p_is_archived:next});
      await loadAdmin();
      if(activeTemplate===t.id&&next){setActiveTemplate(null);setEditingTemplate(null);setTemplateQuestions([])}
      notify(next?"Question Set Archive হয়েছে।":"Question Set আবার Active হয়েছে।");
    }catch(x){setError(x.message)}
  }

  async function saveTemplateQuestion(e){
    e.preventDefault();
    try{
      const options=question.type==="mcq"?question.options.map(x=>x.trim()).filter(Boolean):[];
      if(question.type==="mcq"&&(options.length<2||!options.includes(question.correct)))throw Error("কমপক্ষে ২টি Option এবং সঠিক উত্তর নির্বাচন করো।");
      let d;
      if(editingQuestion){
        await rpc("admin_update_template_question",{p_question_id:editingQuestion,p_question_text:question.text,p_question_type:question.type,p_options:options,p_correct_answer:question.type==="mcq"?question.correct:null,p_marks:Number(question.marks)});
        d={id:editingQuestion};
      }else{
        d=await rpc("admin_add_template_question",{p_template_id:activeTemplate,p_question_text:question.text,p_question_type:question.type,p_options:options,p_correct_answer:question.type==="mcq"?question.correct:null,p_marks:Number(question.marks)});
      }
      if(question.file){
        if(!validFile(question.file))throw Error("JPG, PNG অথবা PDF; সর্বোচ্চ ৮ MB।");
        const path=`templates/${activeTemplate}/${d.id}/${crypto.randomUUID()}-${question.file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const up=await supabase.storage.from(BUCKET_Q).upload(path,question.file,{contentType:question.file.type});
        if(up.error)throw up.error;
        await rpc("admin_attach_template_question_file",{p_question_id:d.id,p_storage_path:path,p_file_name:question.file.name,p_mime_type:question.file.type});
      }
      setEditingQuestion(null);
      setQuestion({text:"",type:"mcq",marks:1,options:["","","",""],correct:"",file:null});
      await openTemplate(activeTemplate);
      await loadAdmin();
      notify(editingQuestion?"প্রশ্ন আপডেট হয়েছে।":"নতুন প্রশ্ন সংরক্ষণ হয়েছে।");
    }catch(x){setError(x.message)}
  }

  function beginEditQuestion(q){
    setEditingQuestion(q.id);
    setQuestion({text:q.question_text,type:q.question_type,marks:q.marks,options:q.options||["","","",""],correct:q.correct_answer||"",file:null});
  }

  async function deleteTemplateQuestion(q){
    if(!confirm("এই প্রশ্নটি স্থায়ীভাবে Delete করতে চাও?"))return;
    try{
      const paths=(q.files||[]).map(f=>f.storage_path).filter(Boolean);
      if(paths.length){const rm=await supabase.storage.from(BUCKET_Q).remove(paths);if(rm.error)throw rm.error;}
      await rpc("admin_delete_template_question",{p_question_id:q.id});
      await openTemplate(activeTemplate);
      await loadAdmin();
      notify("প্রশ্ন Delete হয়েছে।");
    }catch(x){setError(x.message)}
  }

  async function scheduleTemplate(e){
    e.preventDefault();
    try{
      if(!schedule.student_ids.length)throw Error("কমপক্ষে একজন শিক্ষার্থী নির্বাচন করো।");
      const d=await rpc("admin_schedule_template",{p_template_id:schedule.template_id,p_starts_at:new Date(schedule.starts_at).toISOString(),p_duration_minutes:Number(schedule.duration),p_student_ids:schedule.student_ids});
      await loadAdmin();
      setSchedule({template_id:"",starts_at:"",duration:30,student_ids:[]});
      notify(`পরীক্ষা Schedule হয়েছে। ${d.assigned_count} জন শিক্ষার্থী বরাদ্দ পেয়েছে।`);
      setPage("scheduled");
    }catch(x){setError(x.message)}
  }

  async function addStudent(e){
    e.preventDefault();
    try{
      await rpc("admin_create_student",{p_name:newStudent.name,p_class_name:newStudent.class_name,p_roll_no:newStudent.roll_no,p_access_code:newStudent.access_code});
      setNewStudent({name:"",class_name:"",roll_no:"",access_code:""});
      await loadAdmin();
      notify("শিক্ষার্থী যোগ হয়েছে।");
    }catch(x){setError(x.message)}
  }

  async function startExam(exam){
    try{
      const d=await rpc("student_start_exam",{p_code:studentCode,p_exam_id:exam.id});
      setActiveExam(d.exam);
      setExamQuestions(d.questions||[]);
      setAnswers(d.answers||{});
      setUploadedAnswerNames({});
      const urls={};
      for(const q of d.questions||[])for(const f of q.files||[]){try{const u=await fileAction({action:"question-url",code:studentCode,file_id:f.id});urls[f.id]=u.signed_url}catch{}}
      setQuestionUrls(urls);
    }catch(x){setError(x.message)}
  }

  async function uploadAnswer(qid,file){
    if(!file) return;
    if(!validFile(file))throw Error("JPG, PNG অথবা PDF; সর্বোচ্চ ৮ MB।");
    setUploadingQuestionId(qid);
    try{
      const grant=await fileAction({action:"create-answer-upload",code:studentCode,exam_id:activeExam.id,question_id:qid,file_name:file.name,mime_type:file.type});
      if(!grant?.path||!grant?.token)throw Error("Upload token পাওয়া যায়নি। Edge Function redeploy করো।");
      const {error:uploadError}=await supabase.storage.from("academy-answer-files").uploadToSignedUrl(
        grant.path,grant.token,file,{contentType:file.type,cacheControl:"3600"}
      );
      if(uploadError)throw uploadError;
      const saved=await fileAction({action:"confirm-answer-upload",code:studentCode,exam_id:activeExam.id,question_id:qid,path:grant.path,file_name:grant.file_name,mime_type:file.type});
      setUploadedAnswerNames(prev=>({...prev,[qid]:[...(prev[qid]||[]),saved.file_name||file.name]}));
      return saved;
    } finally {
      setUploadingQuestionId(null);
    }
  }

  async function refreshStudentDashboard(){
    const d=await rpc("student_portal_login",{p_code:studentCode});
    if(!d?.success)throw Error("শিক্ষার্থী তথ্য পুনরায় লোড করা যায়নি।");
    setStudent({...d.student,exams:d.exams||[]});
    setSubmittingExams(d.submitting_exams||[]);
    setResults(await rpc("student_my_results",{p_code:studentCode}));
  }

  async function submitExam(){
    if(!confirm("পরীক্ষা জমা দিতে চাও?"))return;
    try{
      const d=await rpc("student_submit_exam",{p_code:studentCode,p_exam_id:activeExam.id,p_answers:answers});
      setActiveExam(null);
      await refreshStudentDashboard();
      setStudentTab("submitting"); // Switch tab to review submitting
      notify(`পরীক্ষা সফলভাবে জমা হয়েছে! MCQ: ${d.mcq_score}/${d.mcq_total}। এটি এখন মূল্যায়নের জন্য জমা আছে।`);
    }catch(x){setError(x.message)}
  }

  async function retakeExam(result){
    if(!result.is_graded){setError("শিক্ষক ফলাফল প্রকাশ করার পর আবার পরীক্ষা দিতে পারবে।");return;}
    if(!confirm(`"${result.exam_title}" আবার দিতে চাও? আগের ফলাফল History-তে থাকবে।`))return;
    try{
      await rpc("student_retake_exam",{p_code:studentCode,p_attempt_id:result.attempt_id});
      await refreshStudentDashboard();
      setStudentTab("assigned");
      notify("নতুন Retake Exam তৈরি হয়েছে। Assigned Exams থেকে পরীক্ষা শুরু করো।");
    }catch(x){setError(x.message)}
  }

  async function openGrade(a){
    setGrading(a);setFeedback(a.teacher_feedback||"");setGradingMarks(a.written_marks||{});
    const urls={};
    for(const f of a.answer_files||[]){try{urls[f.id]=(await fileAction({action:"admin-answer-url",file_id:f.id})).signed_url}catch{}}
    setAnswerUrls(urls);
  }

  async function saveGrade(){
    try{
      await rpc("admin_grade_attempt",{p_attempt_id:grading.id,p_written_marks:gradingMarks,p_feedback:feedback});
      setGrading(null);
      await loadAdmin();
      notify("ফলাফল প্রকাশ হয়েছে।");
    }catch(x){setError(x.message)}
  }

  const adminNav=[["overview","▦","Overview"],["question-bank","▤","Question Bank"],["schedule","◷","Schedule Exam"],["scheduled","▣","Scheduled Exams"],["students","♙","Students"],["submissions","☷","Submissions"]];

  if(!supabase)return <div className="setup"><h1>Mr. Simple Academy</h1><p>.env ফাইলে Supabase URL ও Key বসাও।</p></div>;

  // ── Authentication Shell ──
  if(!student&&!admin)return (
    <div className="auth-shell">
      <div className="auth-brand">🎓 <b>MR. SIMPLE ACADEMY</b></div>
      <div className="auth-card">
        <div className="auth-mark">MSA</div>
        <h1>{adminMode?"Admin Portal":"Welcome Back"}</h1>
        <p>{adminMode?"শিক্ষক হিসেবে প্রবেশ করো":"তোমার Access Code দিয়ে প্রবেশ করো"}</p>
        <form onSubmit={adminMode?adminLogin:studentLogin}>
          {adminMode?<>
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
          </>:<>
            <label>Student Access Code</label>
            <input value={code} onChange={e=>setCode(e.target.value)} placeholder="যেমন: STU-123456" required/>
          </>}
          <button className="btn primary full" disabled={busy}>{busy?"যাচাই করা হচ্ছে...":(adminMode?"Sign In":"Enter Academy")}</button>
        </form>
        {error&&<p className="error">{error}</p>}
        <button className="text-btn" onClick={()=>{setAdminMode(!adminMode);setError("")}}>
          {adminMode?"Student Login":"Admin Login"}
        </button>
      </div>
    </div>
  );

  // ── Active Exam Screen (With Live Countdown) ──
  if(student&&activeExam)return (
    <div className="student-shell">
      <header className="topbar">
        <b>🎓 MR. SIMPLE ACADEMY</b>
        <button className="btn ghost" onClick={()=>setActiveExam(null)}>ড্যাশবোর্ডে ফিরুন</button>
      </header>
      <main className="content narrow">
        <div className="exam-top-bar">
          <div>
            <h1 style={{margin:"0 0 4px",fontSize:"20px",color:"#1b3256"}}>{activeExam.title}</h1>
            <p style={{margin:0,fontSize:"13px",color:"#697a92"}}>{activeExam.subject} · মোট {activeExam.total_marks} নম্বর · {activeExam.duration_minutes} মিনিট</p>
          </div>
          <ExamCountdownTimer 
            startsAt={activeExam.started_at || new Date().toISOString()} 
            durationMinutes={activeExam.duration_minutes} 
            onTimeUp={submitExam} 
          />
        </div>

        {examQuestions.map((q,i)=>(
          <section className="card question-card" key={q.id}>
            <small>QUESTION {i+1} · {q.marks} MARKS</small>
            <MathText text={q.question_text}/>
            {(q.files||[]).map(f=><p key={f.id}><a href={questionUrls[f.id]} target="_blank" rel="noreferrer">{f.file_name} দেখো ↗</a></p>)}
            {q.question_type==="mcq"?(
              <div className="answer-options">
                {(q.options||[]).map((o,j)=>(
                  <label key={j}>
                    <input type="radio" name={q.id} checked={answers[q.id]===o} onChange={()=>setAnswers({...answers,[q.id]:o})}/>
                    <MathText text={o}/>
                  </label>
                ))}
              </div>
            ):(
              <>
                <textarea rows="5" placeholder="এখানে লিখিত উত্তর টাইপ করতে পারো..." value={answers[q.id]||""} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}/>
                <label className="file-pick">
                  উত্তরের ছবি/PDF আপলোড করো
                  <input type="file" accept={ACCEPT} disabled={uploadingQuestionId===q.id} onChange={async e=>{
                    const f=e.target.files?.[0];
                    try{if(f){await uploadAnswer(q.id,f);notify("উত্তরপত্র সফলভাবে আপলোড হয়েছে।")}}catch(x){setError(x.message||"উত্তরপত্র Upload করা যায়নি।")}
                    e.target.value="";
                  }}/>
                  {uploadingQuestionId===q.id&&<small className="uploading-status">ফাইল Upload হচ্ছে, অপেক্ষা করো...</small>}
                  {(uploadedAnswerNames[q.id]||[]).map((name,index)=><small className="uploaded-status" key={index}>✓ {name} — আপলোড হয়েছে</small>)}
                </label>
              </>
            )}
          </section>
        ))}

        {error&&<p className="error">{error}</p>}
        <div style={{marginTop:"20px",display:"flex",justifyContent:"flex-end"}}>
          <button className="btn primary" style={{padding:"12px 28px",fontSize:"15px"}} onClick={submitExam}>Submit Exam</button>
        </div>
      </main>
    </div>
  );

  // ── Student Dashboard (3 Sections: Assigned, Submitting, Results) ──
  if(student)return (
    <div className="student-shell">
      <header className="topbar">
        <b>🎓 MR. SIMPLE ACADEMY</b>
        <button className="btn ghost" onClick={logout}>Logout</button>
      </header>
      <main className="content">
        <div className="welcome">
          <div>
            <small>STUDENT DASHBOARD</small>
            <h1>স্বাগতম, {student.name}!</h1>
            <p>{student.class_name||""} {student.roll_no?`· Roll ${student.roll_no}`:""}</p>
          </div>
        </div>

        {/* ── 3 Section Navigation Tabs ── */}
        <div className="student-tabs">
          <button className={`tab-btn ${studentTab==="assigned"?"active":""}`} onClick={()=>setStudentTab("assigned")}>
            📅 Assigned Exams <span className="tab-badge">{(student.exams||[]).length}</span>
          </button>
          <button className={`tab-btn ${studentTab==="submitting"?"active":""}`} onClick={()=>setStudentTab("submitting")}>
            ⏳ Submitting Exams <span className="tab-badge">{submittingExams.length}</span>
          </button>
          <button className={`tab-btn ${studentTab==="results"?"active":""}`} onClick={()=>setStudentTab("results")}>
            🏆 Results & History <span className="tab-badge">{results.length}</span>
          </button>
        </div>

        {/* ── Section 1: Assigned Exams ── */}
        {studentTab==="assigned" && (
          <div>
            <div className="student-section-heading">
              <div>
                <h2>বরাদ্দকৃত পরীক্ষা (Assigned Exams)</h2>
                <p>শিক্ষক কর্তৃক নির্ধারিত পরীক্ষাগুলো ১২ ঘণ্টার মধ্যে সম্পন্ন করো।</p>
              </div>
            </div>

            {(student.exams||[]).length===0?(
              <div className="empty-state">বর্তমানে কোনো নতুন পরীক্ষা বরাদ্দ নেই। শিক্ষক নতুন পরীক্ষা শিডিউল করলে এখানে দেখতে পাবে।</div>
            ):(
              <div className="card-grid">
                {(student.exams||[]).map(e=>{
                  const now=Date.now();
                  const start=new Date(e.starts_at).getTime();
                  const deadline=new Date(e.assigned_at||e.starts_at).getTime() + (12*60*60*1000);
                  const isExpired = now > deadline;
                  const canStart = now >= start && !isExpired;

                  return (
                    <article className="modern-exam-card" key={e.id}>
                      <div>
                        <div className="exam-card-header">
                          <span className={`exam-tag ${isExpired?"expired":"assigned"}`}>
                            {isExpired?"Expired":"Assigned Exam"}
                          </span>
                          <span style={{fontSize:"11px",color:"#8998ab",fontWeight:600}}>{new Date(e.starts_at).toLocaleDateString("bn-BD")}</span>
                        </div>
                        <h3 style={{margin:"0 0 6px",fontSize:"17px",color:"#1b3256"}}>{e.title}</h3>
                        <p style={{margin:"0 0 10px",color:"#687a93",fontSize:"13px"}}>{e.subject}</p>
                        
                        <div className="exam-meta-pills">
                          <span className="meta-pill">🎯 {e.total_marks} Marks</span>
                          <span className="meta-pill">⏱ {e.duration_minutes} Minutes</span>
                        </div>

                        {/* 12-Hour Deadline Countdown */}
                        <DeadlineCountdown assignedAt={e.assigned_at} startsAt={e.starts_at} durationHours={12} />
                      </div>

                      <div style={{marginTop:"16px"}}>
                        <button className="btn primary full" disabled={!canStart} onClick={()=>startExam(e)}>
                          {isExpired ? "সময় শেষ (Expired)" : (now < start ? "পরীক্ষা এখনো শুরু হয়নি" : "Start Exam")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Section 2: Submitting Exams (Pending Teacher Grading) ── */}
        {studentTab==="submitting" && (
          <div>
            <div className="student-section-heading">
              <div>
                <h2>জমা দেওয়া পরীক্ষা (Submitting Exams)</h2>
                <p>যেসব পরীক্ষা তুমি সাবমিট করেছো এবং শিক্ষক কর্তৃক মূল্যায়নের অপেক্ষায় রয়েছে।</p>
              </div>
            </div>

            {submittingExams.length===0?(
              <div className="empty-state">বর্তমানে মূল্যায়নাধীন কোনো পরীক্ষা জমা নেই।</div>
            ):(
              <div className="card-grid">
                {submittingExams.map(s=>(
                  <article className="modern-exam-card" key={s.attempt_id}>
                    <div>
                      <div className="exam-card-header">
                        <span className="exam-tag submitting">Under Review</span>
                        <span style={{fontSize:"11px",color:"#8998ab"}}>{new Date(s.submitted_at).toLocaleDateString("bn-BD")}</span>
                      </div>
                      <h3 style={{margin:"0 0 6px",fontSize:"17px",color:"#1b3256"}}>{s.title}</h3>
                      <p style={{margin:"0 0 12px",color:"#687a93",fontSize:"13px"}}>{s.subject}</p>

                      <div className="exam-meta-pills">
                        <span className="meta-pill">মোট নম্বর: {s.total_marks}</span>
                        {s.mcq_total>0&&<span className="meta-pill">MCQ স্কোর: {s.mcq_score}/{s.mcq_total}</span>}
                      </div>

                      <div className="eval-status-box">
                        <div className="eval-spinner"/>
                        <span style={{fontSize:"12px",color:"#956e18",fontWeight:600}}>শিক্ষক তোমার উত্তরপত্র মূল্যায়ন করছেন...</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Section 3: Results & History ── */}
        {studentTab==="results" && (
          <div>
            <div className="student-section-heading results-heading">
              <div>
                <h2>পরীক্ষার ফলাফল ও ইতিহাস (Results)</h2>
                <p>প্রকাশিত ফলাফলের তালিকা ও শিক্ষকের মূল্যায়ন।</p>
              </div>
            </div>

            <section className="card results-card">
              <div className="table-scroll">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Exam Details</th>
                      <th>Time & Date</th>
                      <th>Marks</th>
                      <th>মন্তব্য</th>
                      <th>আবার পরীক্ষা দাও</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r=>(
                      <tr key={r.attempt_id}>
                        <td>
                          <b>{r.exam_title}</b>
                          <small>{r.subject||"—"}</small>
                        </td>
                        <td>{r.submitted_at?new Date(r.submitted_at).toLocaleString("bn-BD"):"—"}</td>
                        <td>
                          {r.is_graded?(
                            <strong className="result-marks">{r.final_score}/{r.total_marks}</strong>
                          ):(
                            <span className="pending-chip">মূল্যায়ন চলছে</span>
                          )}
                        </td>
                        <td className="feedback-cell">{r.teacher_feedback||(r.is_graded?"কোনো মন্তব্য নেই":"শিক্ষকের মূল্যায়নের অপেক্ষায়")}</td>
                        <td>
                          <button className="btn outline small" disabled={!r.is_graded} onClick={()=>retakeExam(r)}>
                            {r.is_graded?"আবার পরীক্ষা দাও":"ফলাফলের অপেক্ষায়"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {results.length===0&&<div className="empty-state inside">এখনো কোনো পরীক্ষার ফলাফল প্রকাশিত হয়নি।</div>}
            </section>
          </div>
        )}

        {error&&<p className="error">{error}</p>}
        {notice&&<div className="toast success-toast">{notice}</div>}
      </main>
    </div>
  );

  // ── Admin Panel ──
  return (
    <div className={mobileMenuOpen?"admin-layout menu-open":"admin-layout"}>
      {mobileMenuOpen&&<button className="sidebar-backdrop" aria-label="Close menu" onClick={()=>setMobileMenuOpen(false)}/>}
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-logo">MS</div>
          <div><b>Mr. Simple</b><small>ACADEMY ADMIN</small></div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav>
          {adminNav.map(([id,ic,label])=>(
            <button key={id} className={page===id?"nav-link active":"nav-link"} onClick={()=>{setPage(id);setError("");setMobileMenuOpen(false)}}>
              <Icon>{ic}</Icon>{label}
              {id==="submissions"&&attempts.length>0?<span className="nav-count">{attempts.length}</span>:null}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="admin-profile">
            <div className="avatar">A</div>
            <div><b>Administrator</b><small>Academy Admin</small></div>
          </div>
          <button className="nav-link" onClick={logout}><Icon>↪</Icon>Logout</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-top">
          <div className="admin-top-left">
            <button className="mobile-menu-toggle" aria-label="Open menu" onClick={()=>setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
            <span className="mobile-brand">MSA</span>
            <small>MR. SIMPLE ACADEMY / ADMIN</small>
          </div>
          <div className="top-actions">
            <span className="online-dot"/> Admin Panel 
            <button className="btn ghost small" onClick={loadAdmin}>↻ Refresh</button>
          </div>
        </header>

        <main className="admin-content">
          {page==="overview"&&<>
            <div className="page-heading">
              <div><h1>Dashboard Overview</h1><p>তোমার Academy-এর সার্বিক অবস্থা এক নজরে।</p></div>
              <button className="btn primary" onClick={()=>setPage("schedule")}>＋ Schedule an Exam</button>
            </div>
            <div className="stats-grid">
              <div className="stat-card"><span>👨‍🎓</span><small>Total Students</small><strong>{students.length}</strong></div>
              <div className="stat-card"><span>📚</span><small>Question Bank</small><strong>{templates.length}</strong></div>
              <div className="stat-card"><span>🗓️</span><small>Scheduled Exams</small><strong>{scheduled.length}</strong></div>
              <div className="stat-card"><span>📝</span><small>Submissions</small><strong>{attempts.filter(a=>a.status==="submitted").length}</strong></div>
            </div>
            <div className="dashboard-columns">
              <section className="card">
                <div className="section-head">
                  <div><h2>Recent Scheduled Exams</h2><p>সাম্প্রতিক পরীক্ষাগুলো</p></div>
                  <button className="text-btn" onClick={()=>setPage("scheduled")}>View all →</button>
                </div>
                {scheduled.slice(0,5).map(e=>(
                  <div className="row-item" key={e.id}>
                    <div className="row-icon">📘</div>
                    <div className="row-main">
                      <b>{e.title}</b>
                      <small>{e.subject} · {new Date(e.starts_at).toLocaleString("bn-BD")}</small>
                    </div>
                    <span className="status-chip">{e.is_published?"Published":"Draft"}</span>
                  </div>
                ))}
              </section>
              <section className="card">
                <div className="section-head">
                  <div><h2>Quick Actions</h2><p>দ্রুত প্রয়োজনীয় কাজ</p></div>
                </div>
                <button className="quick-action" onClick={()=>setPage("question-bank")}>
                  ＋ <span><b>Create Question Bank Exam</b><small>প্রশ্নসহ পরীক্ষা সংরক্ষণ করো</small></span> →
                </button>
                <button className="quick-action" onClick={()=>setPage("schedule")}>
                  ◷ <span><b>Schedule Existing Exam</b><small>শিক্ষার্থী ও সময় নির্ধারণ করো</small></span> →
                </button>
                <button className="quick-action" onClick={()=>setPage("students")}>
                  ♙ <span><b>Add New Student</b><small>নতুন শিক্ষার্থী যুক্ত করো</small></span> →
                </button>
              </section>
            </div>
          </>}

          {page==="question-bank"&&<>
            <div className="page-heading">
              <div><h1>Chapter-wise Question Bank</h1><p>বিষয় ও অধ্যায় অনুযায়ী প্রশ্নের Set তৈরি, সংরক্ষণ, Edit এবং ভবিষ্যতে বারবার ব্যবহার করো।</p></div>
            </div>
            <div className="question-bank-layout">
              <section className="card create-set-card">
                <div className="card-title-row">
                  <div className="section-icon">＋</div>
                  <div><h2>নতুন Question Set তৈরি</h2><p>একটি Set একটি নির্দিষ্ট Chapter-এর জন্য রাখো।</p></div>
                </div>
                <form className="form-stack" onSubmit={createTemplate}>
                  <label>Set-এর নাম</label>
                  <input required value={template.title} onChange={e=>setTemplate({...template,title:e.target.value})} placeholder="যেমন: Vector MCQ Set-01"/>
                  <div className="two-cols">
                    <div><label>বিষয়</label><input required value={template.subject} onChange={e=>setTemplate({...template,subject:e.target.value})} placeholder="Physics / Mathematics"/></div>
                    <div><label>Chapter</label><input required value={template.chapter_name} onChange={e=>setTemplate({...template,chapter_name:e.target.value})} placeholder="যেমন: Vector"/></div>
                  </div>
                  <label>বিবরণ (ঐচ্ছিক)</label>
                  <textarea rows="2" value={template.description} onChange={e=>setTemplate({...template,description:e.target.value})} placeholder="এই Set-এর বিষয়বস্তু..."/>
                  <label>মোট নম্বর</label>
                  <input type="number" min="1" value={template.total_marks} onChange={e=>setTemplate({...template,total_marks:e.target.value})}/>
                  <button className="btn primary">＋ Question Bank-এ সংরক্ষণ</button>
                </form>
              </section>

              <section className="card saved-sets-card">
                <div className="section-head">
                  <div><h2>সংরক্ষিত Question Sets</h2><p>{templates.filter(t=>!t.is_archived).length}টি Active Set</p></div>
                  <button className="btn ghost small" onClick={loadAdmin}>↻ Refresh</button>
                </div>
                <input className="template-search" value={templateSearch} onChange={e=>setTemplateSearch(e.target.value)} placeholder="Set, Subject অথবা Chapter দিয়ে খুঁজো..."/>
                <div className="template-filters">
                  <select value={templateSubjectFilter} onChange={e=>setTemplateSubjectFilter(e.target.value)}>
                    <option value="">সব Subject</option>
                    {[...new Set(templates.map(t=>t.subject).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}
                  </select>
                  <select value={templateChapterFilter} onChange={e=>setTemplateChapterFilter(e.target.value)}>
                    <option value="">সব Chapter</option>
                    {[...new Set(templates.map(t=>t.chapter_name||"অন্যান্য").filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
                <label className="archived-toggle">
                  <input type="checkbox" checked={showArchivedTemplates} onChange={e=>setShowArchivedTemplates(e.target.checked)}/> Archived Set-ও দেখাও
                </label>
                <div className="saved-set-list">
                  {templates.filter(t=>(showArchivedTemplates||!t.is_archived)&&(!templateSubjectFilter||t.subject===templateSubjectFilter)&&(!templateChapterFilter||(t.chapter_name||"অন্যান্য")===templateChapterFilter)&&(`${t.title} ${t.subject} ${t.chapter_name||""}`.toLowerCase().includes(templateSearch.toLowerCase()))).map(t=>(
                    <article className={activeTemplate===t.id?"saved-set selected":"saved-set"} key={t.id}>
                      <div className="set-main">
                        <div className="set-badges">
                          <span className="subject-tag">{t.subject}</span>
                          <span className="chapter-tag">{t.chapter_name||"অন্যান্য"}</span>
                          {t.is_archived&&<span className="archived-tag">Archived</span>}
                        </div>
                        <b>{t.title}</b>
                        <small>{t.question_count||0}টি প্রশ্ন · {t.question_marks||0} নম্বর · Set total {t.total_marks}</small>
                      </div>
                      <div className="set-actions">
                        <button className="btn outline small" onClick={()=>openTemplate(t.id)}>দেখো / Edit</button>
                        <button className="btn ghost small" disabled={t.is_archived} onClick={()=>{setSchedule({...schedule,template_id:t.id});setPage("schedule")}}>Schedule</button>
                      </div>
                    </article>
                  ))}
                  {templates.filter(t=>(showArchivedTemplates||!t.is_archived)&&(!templateSubjectFilter||t.subject===templateSubjectFilter)&&(!templateChapterFilter||(t.chapter_name||"অন্যান্য")===templateChapterFilter)&&(`${t.title} ${t.subject} ${t.chapter_name||""}`.toLowerCase().includes(templateSearch.toLowerCase()))).length===0&&<div className="empty-state">এই Filter-এ কোনো Question Set পাওয়া যায়নি।</div>}
                </div>
              </section>
            </div>

            {activeTemplate&&editingTemplate&&<section className="card question-manager">
              <div className="section-head">
                <div><h2>Question Set Management</h2><p>Set-এর তথ্য এবং সংরক্ষিত প্রশ্নগুলো এখান থেকে Edit করো।</p></div>
                <button className="text-btn" onClick={()=>{setActiveTemplate(null);setEditingTemplate(null);setTemplateQuestions([]);setEditingQuestion(null)}}>বন্ধ করো ×</button>
              </div>
              <form className="template-edit-grid" onSubmit={updateTemplate}>
                <div><label>Set-এর নাম</label><input required value={editingTemplate.title} onChange={e=>setEditingTemplate({...editingTemplate,title:e.target.value})}/></div>
                <div><label>Subject</label><input required value={editingTemplate.subject} onChange={e=>setEditingTemplate({...editingTemplate,subject:e.target.value})}/></div>
                <div><label>Chapter</label><input required value={editingTemplate.chapter_name} onChange={e=>setEditingTemplate({...editingTemplate,chapter_name:e.target.value})}/></div>
                <div><label>মোট নম্বর</label><input type="number" min="1" value={editingTemplate.total_marks} onChange={e=>setEditingTemplate({...editingTemplate,total_marks:e.target.value})}/></div>
                <div className="span-all"><label>বিবরণ</label><textarea rows="2" value={editingTemplate.description} onChange={e=>setEditingTemplate({...editingTemplate,description:e.target.value})}/></div>
                <div className="template-edit-actions span-all">
                  <button className="btn primary">Set-এর তথ্য Update করো</button>
                  <button type="button" className="btn ghost" onClick={()=>setTemplateArchived({id:editingTemplate.id,is_archived:templates.find(t=>t.id===editingTemplate.id)?.is_archived||false})}>
                    {templates.find(t=>t.id===editingTemplate.id)?.is_archived?"Unarchive":"Archive"} Set
                  </button>
                </div>
              </form>

              <div className="question-manager-heading">
                <div><h3>এই Set-এর প্রশ্নসমূহ</h3><small>{templateQuestions.length}টি প্রশ্ন পাওয়া গেছে</small></div>
              </div>
              <div className="saved-question-list">
                {templateQuestions.map((q,i)=>(
                  <article className="saved-question" key={q.id}>
                    <div className="question-number">{i+1}</div>
                    <div className="question-detail">
                      <div className="question-meta"><span>{q.question_type==="mcq"?"MCQ":"Written"}</span><span>{q.marks} নম্বর</span></div>
                      <MathText text={q.question_text}/>
                      {q.question_type==="mcq"&&(q.options||[]).length>0&&<div className="question-options-preview">{q.options.map((o,j)=><div key={j}>{String.fromCharCode(65+j)}. <MathText text={o}/></div>)}</div>}
                      {q.correct_answer&&<div className="correct-answer-preview">সঠিক উত্তর: <MathText text={q.correct_answer}/></div>}
                      {(q.files||[]).map(f=><p className="template-file-link" key={f.id}><a href={templateFileUrls[f.id]||"#"} target="_blank" rel="noreferrer">{f.file_name} ↗</a></p>)}
                    </div>
                    <div className="question-actions">
                      <button className="btn outline small" onClick={()=>beginEditQuestion(q)}>Edit</button>
                      <button className="btn danger-outline small" onClick={()=>deleteTemplateQuestion(q)}>Delete</button>
                    </div>
                  </article>
                ))}
                {templateQuestions.length===0&&<div className="empty-state">এই Set-এ এখনো কোনো প্রশ্ন নেই। নিচের Form থেকে প্রশ্ন যোগ করো।</div>}
              </div>

              <div className="question-form-panel">
                <div className="section-head">
                  <div><h3>{editingQuestion?"প্রশ্ন Edit করো":"নতুন প্রশ্ন যোগ করো"}</h3><p>Formula লিখতে $...$ অথবা $$...$$ ব্যবহার করো।</p></div>
                  {editingQuestion&&<button className="text-btn" onClick={()=>{setEditingQuestion(null);setQuestion({text:"",type:"mcq",marks:1,options:["","","",""],correct:"",file:null})}}>Edit বাতিল</button>}
                </div>
                <form className="form-stack" onSubmit={saveTemplateQuestion}>
                  <label>প্রশ্নের লেখা</label>
                  <textarea rows="4" required value={question.text} onChange={e=>setQuestion({...question,text:e.target.value})}/>
                  <div className="two-cols">
                    <div>
                      <label>প্রশ্নের ধরন</label>
                      <select value={question.type} onChange={e=>setQuestion({...question,type:e.target.value,correct:""})}>
                        <option value="mcq">MCQ</option>
                        <option value="written">Written / CQ</option>
                      </select>
                    </div>
                    <div>
                      <label>নম্বর</label>
                      <input type="number" min="0.5" step="0.5" value={question.marks} onChange={e=>setQuestion({...question,marks:e.target.value})}/>
                    </div>
                  </div>
                  {question.type==="mcq"&&<>
                    <div className="options-builder">
                      {question.options.map((o,i)=>(
                        <div key={i}>
                          <label>Option {i+1}</label>
                          <input value={o} onChange={e=>setQuestion({...question,options:question.options.map((v,j)=>i===j?e.target.value:v)})}/>
                        </div>
                      ))}
                    </div>
                    <label>সঠিক উত্তর</label>
                    <select value={question.correct} onChange={e=>setQuestion({...question,correct:e.target.value})}>
                      <option value="">সঠিক উত্তর নির্বাচন</option>
                      {question.options.filter(Boolean).map(o=><option key={o}>{o}</option>)}
                    </select>
                  </>}
                  <label>প্রশ্নের ছবি/PDF (ঐচ্ছিক)</label>
                  <input type="file" accept={ACCEPT} onChange={e=>setQuestion({...question,file:e.target.files?.[0]||null})}/>
                  <button className="btn primary">{editingQuestion?"পরিবর্তন সংরক্ষণ":"প্রশ্ন যোগ করো"}</button>
                </form>
              </div>
            </section>}
          </>}

          {page==="schedule"&&<>
            <div className="page-heading">
              <div><h1>Schedule an Exam</h1><p>Question Bank থেকে পরীক্ষা বেছে শিক্ষার্থী ও সময় নির্ধারণ করো।</p></div>
            </div>
            <section className="card schedule-card">
              <div className="step-title"><span>01</span><div><b>Choose an Exam</b><small>Question Bank থেকে একটি পরীক্ষা নির্বাচন করো</small></div></div>
              <form className="form-stack" onSubmit={scheduleTemplate}>
                <label>Saved Exam</label>
                <select required value={schedule.template_id} onChange={e=>setSchedule({...schedule,template_id:e.target.value})}>
                  <option value="">পরীক্ষা নির্বাচন করো</option>
                  {templates.filter(t=>!t.is_archived).map(t=><option value={t.id} key={t.id}>{t.subject} · {t.chapter_name||"অন্যান্য"} · {t.title} ({t.question_count||0} প্রশ্ন)</option>)}
                </select>
                {schedule.template_id&&templates.find(t=>t.id===schedule.template_id)&&(
                  <div className="selected-template-summary">
                    <b>{templates.find(t=>t.id===schedule.template_id).title}</b>
                    <span>{templates.find(t=>t.id===schedule.template_id).chapter_name||"অন্যান্য"} · {templates.find(t=>t.id===schedule.template_id).question_count||0}টি প্রশ্ন · {templates.find(t=>t.id===schedule.template_id).question_marks||0} নম্বর</span>
                  </div>
                )}
                <div className="step-title"><span>02</span><div><b>Set Date & Time</b><small>পরীক্ষার সময় নির্ধারণ করো</small></div></div>
                <div className="two-cols">
                  <div>
                    <label>Exam Date & Start Time</label>
                    <input type="datetime-local" required value={schedule.starts_at} onChange={e=>setSchedule({...schedule,starts_at:e.target.value})}/>
                  </div>
                  <div>
                    <label>Duration (Minutes)</label>
                    <input type="number" min="1" required value={schedule.duration} onChange={e=>setSchedule({...schedule,duration:e.target.value})}/>
                  </div>
                </div>
                <div className="step-title"><span>03</span><div><b>Assign Students</b><small>যারা এই পরীক্ষায় অংশ নেবে তাদের নির্বাচন করো</small></div></div>
                <div className="student-select-head">
                  <b>Students ({students.length})</b>
                  <div>
                    <button type="button" className="text-btn" onClick={()=>setSchedule({...schedule,student_ids:students.map(s=>s.id)})}>Select all</button>
                    <button type="button" className="text-btn" onClick={()=>setSchedule({...schedule,student_ids:[]})}>Clear</button>
                  </div>
                </div>
                <div className="student-check-grid">
                  {students.map(s=>(
                    <label key={s.id} className="student-check">
                      <input type="checkbox" checked={schedule.student_ids.includes(s.id)} onChange={e=>setSchedule({...schedule,student_ids:e.target.checked?[...schedule.student_ids,s.id]:schedule.student_ids.filter(id=>id!==s.id)})}/>
                      <span className="avatar small-avatar">{(s.name||"S")[0]}</span>
                      <span><b>{s.name}</b><small>{s.class_name||"Student"} · {s.roll_no||"No roll"}</small></span>
                    </label>
                  ))}
                </div>
                <div className="schedule-summary">
                  <b>{schedule.student_ids.length} students selected</b>
                  <button className="btn primary">Publish Scheduled Exam</button>
                </div>
              </form>
            </section>
          </>}

          {page==="scheduled"&&<>
            <div className="page-heading">
              <div><h1>Scheduled Exams</h1><p>আগে ও বর্তমানে নির্ধারিত পরীক্ষাগুলো। একই template একাধিকবার schedule করা যায়।</p></div>
              <button className="btn primary" onClick={()=>setPage("schedule")}>＋ New Schedule</button>
            </div>
            <section className="card">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>EXAM</th><th>SUBJECT</th><th>DATE & TIME</th><th>DURATION</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {scheduled.map(e=>(
                      <tr key={e.id}>
                        <td><b>{e.title}</b></td>
                        <td>{e.subject}</td>
                        <td>{new Date(e.starts_at).toLocaleString("bn-BD")}</td>
                        <td>{e.duration_minutes} min</td>
                        <td><span className="status-chip">{e.is_published?"Published":"Draft"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {scheduled.length===0&&<p className="muted">কোনো পরীক্ষা schedule করা হয়নি।</p>}
            </section>
          </>}

          {page==="students"&&<>
            <div className="page-heading">
              <div><h1>Students</h1><p>শিক্ষার্থী ব্যবস্থাপনা ও নতুন শিক্ষার্থী যুক্ত করো।</p></div>
            </div>
            <div className="dashboard-columns">
              <section className="card">
                <h2>Add Student</h2>
                <form className="form-stack" onSubmit={addStudent}>
                  <label>নাম</label>
                  <input required value={newStudent.name} onChange={e=>setNewStudent({...newStudent,name:e.target.value})}/>
                  <label>শ্রেণি</label>
                  <input value={newStudent.class_name} onChange={e=>setNewStudent({...newStudent,class_name:e.target.value})}/>
                  <label>রোল</label>
                  <input value={newStudent.roll_no} onChange={e=>setNewStudent({...newStudent,roll_no:e.target.value})}/>
                  <label>Access Code (কমপক্ষে ৬ অক্ষর)</label>
                  <input required minLength="6" value={newStudent.access_code} onChange={e=>setNewStudent({...newStudent,access_code:e.target.value})}/>
                  <button className="btn primary">Add Student</button>
                </form>
              </section>
              <section className="card">
                <h2>All Students ({students.length})</h2>
                {students.map(s=>(
                  <div className="row-item" key={s.id}>
                    <span className="avatar">{(s.name||"S")[0]}</span>
                    <div className="row-main">
                      <b>{s.name}</b>
                      <small>{s.class_name||"Student"} · {s.roll_no||"—"}</small>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </>}

          {page==="submissions"&&<>
            <div className="page-heading">
              <div><h1>Submissions & Results</h1><p>শিক্ষার্থীদের জমা দেওয়া পরীক্ষা যাচাই ও নম্বর প্রকাশ করো।</p></div>
            </div>
            <section className="card">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>STUDENT</th><th>EXAM</th><th>MCQ SCORE</th><th>SUBMITTED</th><th>ACTION</th></tr>
                  </thead>
                  <tbody>
                    {attempts.map(a=>(
                      <tr key={a.id}>
                        <td>{a.student_name}</td>
                        <td>{a.exam_title}</td>
                        <td>{a.mcq_score}/{a.mcq_total}</td>
                        <td>{a.submitted_at?new Date(a.submitted_at).toLocaleString("bn-BD"):"In progress"}</td>
                        <td>
                          <button className="btn outline small" disabled={a.status!=="submitted"} onClick={()=>openGrade(a)}>
                            Review & Grade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {grading&&<section className="card">
              <div className="section-head">
                <h2>{grading.student_name} — {grading.exam_title}</h2>
                <button className="text-btn" onClick={()=>setGrading(null)}>Close</button>
              </div>
              <p>MCQ: {grading.mcq_score}/{grading.mcq_total}</p>
              {(grading.written_questions||[]).map((q,i)=>(
                <div className="grade-row" key={q.id}>
                  <b>{i+1}. <MathText text={q.question_text}/></b>
                  <p>{grading.answers?.[q.id]||"No text answer"}</p>
                  <label>Marks (Max {q.marks})</label>
                  <input type="number" min="0" max={q.marks} step="0.5" value={gradingMarks[q.id]??""} onChange={e=>setGradingMarks({...gradingMarks,[q.id]:e.target.value})}/>
                </div>
              ))}
              <h3>Uploaded Answer Files</h3>
              {(grading.answer_files||[]).map(f=><p key={f.id}><a href={answerUrls[f.id]} target="_blank" rel="noreferrer">{f.file_name}</a></p>)}
              <label>Teacher Feedback</label>
              <textarea rows="3" value={feedback} onChange={e=>setFeedback(e.target.value)}/>
              <button className="btn primary" onClick={saveGrade}>Publish Result</button>
            </section>}
          </>}

          {error&&<div className="toast error-toast">{error}<button onClick={()=>setError("")}>×</button></div>}
          {notice&&<div className="toast success-toast">{notice}</div>}
        </main>
      </section>
    </div>
  );
}

export default App;
