# Admin Runbook M4

## Muc tieu
- Van hanh Admin Dashboard cho policy ingest, excel import, audit va jobs.
- Dam bao khong mat du lieu khi import/apply.

## Khoi dong local
- API: `cd apps/api && uvicorn app.main:app --reload`
- Worker: `cd apps/api && python -m app.scripts.run_admin_worker`
- Web: `cd apps/web && npm run dev`

## Luong policy ingest
1. Vao `/admin/policies`, upload `.pdf` hoac `.docx`.
2. He thong tao job `policy_ingest` status `queued`.
3. Worker xu ly: extract text -> chunk -> save chunks -> complete.
4. Kiem tra `/admin/jobs` va `/admin/audit`.

## Luong excel import
1. Upload file `.xlsx` tai `/admin/imports`.
2. Worker chay preview va ghi ket qua vao `result_summary.preview`.
3. Neu `preview_completed`, bam `Apply`.
4. Worker apply transaction vao bang term exam/offering.

## Xu ly su co thuong gap
- `invalid_xlsx_file`: file khong phai xlsx hop le.
- `preview_not_ready`: job chua o trang thai preview_completed.
- `course_not_found:*`: import exam co ma mon chua ton tai.

## Checklist release
- API tests pass:
  - `tests/test_admin_policies_imports.py`
  - `tests/test_policy_retrieval_contract.py`
  - `tests/test_admin_audit_jobs.py`
  - `tests/test_excel_import_parser.py`
- Web checks pass:
  - `npm run typecheck`
  - `npm run test`
