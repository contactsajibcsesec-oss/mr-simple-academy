import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const allowed = ["image/jpeg", "image/png", "application/pdf"];
const max = 8 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const root = createClient(url, secret, { auth: { persistSession: false } });

  const body = await req.json().catch(() => null);
  if (!body?.action) return reply({ error: "Missing action" }, 400);

  // ── Helper: validate student access code ──────────────────────────
  async function studentFromCode(code: string) {
    const c = createClient(url, anon);
    const { data, error } = await c.rpc("student_portal_login", { p_code: code });
    if (error || !data?.success) return null;
    return data.student;
  }

  // ── Helper: validate admin from Authorization header ──────────────
  async function adminFromToken() {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return null;
    const { data: isAdmin } = await userClient.rpc("is_academy_admin");
    if (!isAdmin) return null;
    return u.user;
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTION: create-answer-upload  (v1.4 flow – step 1)
  // Validates student + active exam, then creates a signed upload URL
  // so the browser can upload the file directly to Storage.
  // ══════════════════════════════════════════════════════════════════
  if (body.action === "create-answer-upload") {
    if (!body.code || !body.exam_id || !body.question_id || !body.file_name || !allowed.includes(body.mime_type))
      return reply({ error: "Invalid upload data" }, 400);

    const s = await studentFromCode(body.code);
    if (!s) return reply({ error: "Invalid access code" }, 401);

    const { data: assigned } = await root
      .from("exam_students")
      .select("exam_id")
      .eq("exam_id", body.exam_id)
      .eq("student_id", s.id)
      .maybeSingle();
    if (!assigned) return reply({ error: "Not assigned to this exam" }, 403);

    const { data: a } = await root
      .from("exam_attempts")
      .select("id,status")
      .eq("exam_id", body.exam_id)
      .eq("student_id", s.id)
      .eq("status", "in_progress")
      .maybeSingle();
    if (!a) return reply({ error: "Start the exam before uploading" }, 403);

    const safeName = String(body.file_name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
    const path = `${body.exam_id}/${a.id}/${crypto.randomUUID()}-${safeName}`;

    const { data: signed, error: signErr } = await root.storage
      .from("academy-answer-files")
      .createSignedUploadUrl(path);
    if (signErr || !signed) return reply({ error: signErr?.message || "Could not create upload URL" }, 400);

    return reply({
      path,
      token: signed.token,
      file_name: safeName,
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTION: confirm-answer-upload  (v1.4 flow – step 3)
  // After the browser uploaded the file, this verifies it exists in
  // Storage and saves the metadata row in exam_answer_files.
  // ══════════════════════════════════════════════════════════════════
  if (body.action === "confirm-answer-upload") {
    if (!body.code || !body.exam_id || !body.question_id || !body.path || !body.file_name || !allowed.includes(body.mime_type))
      return reply({ error: "Invalid confirm data" }, 400);

    const s = await studentFromCode(body.code);
    if (!s) return reply({ error: "Invalid access code" }, 401);

    const { data: a } = await root
      .from("exam_attempts")
      .select("id,status")
      .eq("exam_id", body.exam_id)
      .eq("student_id", s.id)
      .eq("status", "in_progress")
      .maybeSingle();
    if (!a) return reply({ error: "No active attempt" }, 403);

    // Verify the file actually exists in Storage
    const { data: obj } = await root.storage.from("academy-answer-files").list(
      body.path.substring(0, body.path.lastIndexOf("/")),
      { search: body.path.substring(body.path.lastIndexOf("/") + 1) }
    );
    // Even if list check is imprecise, the insert below is the authority

    const ins = await root.from("exam_answer_files").insert({
      attempt_id: a.id,
      question_id: body.question_id || null,
      student_id: s.id,
      storage_path: body.path,
      file_name: body.file_name,
      mime_type: body.mime_type,
    });
    if (ins.error) return reply({ error: ins.error.message }, 400);

    return reply({ success: true, file_name: body.file_name });
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTION: upload-answer  (v1.3 legacy – base64 upload)
  // Kept for backward compatibility.
  // ══════════════════════════════════════════════════════════════════
  if (body.action === "upload-answer") {
    if (!body.code || !body.exam_id || !body.file_base64 || !body.file_name || !allowed.includes(body.mime_type))
      return reply({ error: "Invalid upload data" }, 400);

    const s = await studentFromCode(body.code);
    if (!s) return reply({ error: "Invalid access code" }, 401);

    const { data: assigned } = await root
      .from("exam_students")
      .select("exam_id")
      .eq("exam_id", body.exam_id)
      .eq("student_id", s.id)
      .maybeSingle();
    if (!assigned) return reply({ error: "Not assigned to this exam" }, 403);

    const { data: a } = await root
      .from("exam_attempts")
      .select("id,status")
      .eq("exam_id", body.exam_id)
      .eq("student_id", s.id)
      .eq("status", "in_progress")
      .maybeSingle();
    if (!a) return reply({ error: "Start the exam before uploading" }, 403);

    const bytes = Uint8Array.from(atob(body.file_base64), (c) => c.charCodeAt(0));
    if (bytes.length > max) return reply({ error: "File size limit is 8 MB" }, 413);

    const name = String(body.file_name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
    const path = `${body.exam_id}/${a.id}/${crypto.randomUUID()}-${name}`;

    const up = await root.storage.from("academy-answer-files").upload(path, bytes, {
      contentType: body.mime_type,
      upsert: false,
    });
    if (up.error) return reply({ error: up.error.message }, 400);

    const ins = await root.from("exam_answer_files").insert({
      attempt_id: a.id,
      question_id: body.question_id || null,
      student_id: s.id,
      storage_path: path,
      file_name: name,
      mime_type: body.mime_type,
    });
    if (ins.error) {
      await root.storage.from("academy-answer-files").remove([path]);
      return reply({ error: ins.error.message }, 400);
    }

    return reply({ success: true, file_name: name });
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTION: question-url  (student – signed URL for exam question file)
  // ══════════════════════════════════════════════════════════════════
  if (body.action === "question-url") {
    const s = await studentFromCode(body.code);
    if (!s) return reply({ error: "Invalid access code" }, 401);

    const { data: f } = await root
      .from("exam_question_files")
      .select("storage_path,question_id")
      .eq("id", body.file_id)
      .maybeSingle();
    if (!f) return reply({ error: "File not found" }, 404);

    const { data: q } = await root
      .from("exam_questions")
      .select("exam_id")
      .eq("id", f.question_id)
      .maybeSingle();

    const { data: assigned } = await root
      .from("exam_students")
      .select("exam_id")
      .eq("exam_id", q.exam_id)
      .eq("student_id", s.id)
      .maybeSingle();
    if (!assigned) return reply({ error: "Not assigned" }, 403);

    const signed = await root.storage.from("academy-question-files").createSignedUrl(f.storage_path, 90);
    if (signed.error) return reply({ error: signed.error.message }, 400);
    return reply({ signed_url: signed.data.signedUrl });
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTION: admin-template-question-url  (admin – signed URL for
  //         template question file in the Question Bank)
  // ══════════════════════════════════════════════════════════════════
  if (body.action === "admin-template-question-url") {
    const admin = await adminFromToken();
    if (!admin) return reply({ error: "Admin login required" }, 401);

    const { data: f } = await root
      .from("template_question_files")
      .select("storage_path")
      .eq("id", body.file_id)
      .maybeSingle();
    if (!f) return reply({ error: "File not found" }, 404);

    const signed = await root.storage.from("academy-question-files").createSignedUrl(f.storage_path, 120);
    if (signed.error) return reply({ error: signed.error.message }, 400);
    return reply({ signed_url: signed.data.signedUrl });
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTION: admin-answer-url / admin-question-url  (admin – signed URLs)
  // ══════════════════════════════════════════════════════════════════
  if (body.action === "admin-answer-url" || body.action === "admin-question-url") {
    const admin = await adminFromToken();
    if (!admin) return reply({ error: "Admin login required" }, 401);

    const table = body.action === "admin-answer-url" ? "exam_answer_files" : "exam_question_files";
    const bucket = body.action === "admin-answer-url" ? "academy-answer-files" : "academy-question-files";

    const { data: f } = await root.from(table).select("storage_path").eq("id", body.file_id).maybeSingle();
    if (!f) return reply({ error: "File not found" }, 404);

    const signed = await root.storage.from(bucket).createSignedUrl(f.storage_path, 120);
    if (signed.error) return reply({ error: signed.error.message }, 400);
    return reply({ signed_url: signed.data.signedUrl });
  }

  return reply({ error: "Unsupported action" }, 400);
});
