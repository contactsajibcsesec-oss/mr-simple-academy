# Mr. Simple Academy — Version 1.4

Version 1.4 introduces a separate **Question Bank** and **Exam Scheduling** workflow with a modern sidebar Admin Dashboard.

## Main change
An exam template is saved once in the Question Bank. Whenever needed, the admin can schedule that same template again with a different date/time, duration, and selected students. Each schedule creates a separate exam instance and separate student attempts/results.

## Admin Dashboard
- Overview: students, question bank templates, scheduled exams, submissions.
- Question Bank: create reusable exam templates and add MCQ/written questions.
- Schedule Exam: choose a saved template, set date/time and duration, select students, publish.
- Scheduled Exams: view each scheduled instance.
- Students: add and view students.
- Submissions: review uploaded answer files, mark written answers and publish feedback/results.

## Upgrade instructions
1. Back up the current project folder and Supabase database.
2. Replace the project source with this v1.4 project. Keep your current `.env` file and its existing Supabase URL/key.
3. In Supabase SQL Editor, run `supabase/v1.4-migration.sql` once. **Do not rerun the v1.3 migration.**
4. Existing exams and their questions are copied into the new Question Bank as templates. Original exams, attempts, and results are not deleted.
5. Keep these two Supabase Storage buckets PRIVATE:
   - `academy-question-files`
   - `academy-answer-files`
6. Keep the `academy-file-access` Edge Function deployed from v1.3. Its secrets must include `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
7. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

## Frontend environment
Keep `.env` with browser-safe keys only:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```
Never put the service-role secret in `.env`, React code, GitHub, or any `VITE_` variable.

## Question files and answer uploads
- JPG, PNG and PDF are accepted.
- Maximum file size is 8 MB.
- Question files are uploaded to the private `academy-question-files` bucket.
- Student answer files are uploaded through the access-code validating Edge Function to the private `academy-answer-files` bucket.
- Admin opens answer files through short-lived signed URLs.

## Important
The migration assumes your current v1.3 database objects exist, including `students`, `exams`, `exam_questions`, `exam_students`, `exam_attempts`, `exam_question_files`, and `is_academy_admin()`.
Test with a demo template, a demo schedule, and one demo student before assigning a real exam. The package contains the frontend and migration; final verification must be done against your own Supabase project after migration and Edge Function deployment.
