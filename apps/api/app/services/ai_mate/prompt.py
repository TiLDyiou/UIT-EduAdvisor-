from __future__ import annotations

from app.schemas.ai_mate import PolicySourceMeta


def policy_disclaimer_vi() -> str:
    return (
        "Thông tin tham khảo. Vui lòng kiểm tra lại với Phòng Đào tạo trước khi ra quyết định quan trọng."
    )


def build_system_prompt(
    *,
    realtime_block: str,
    historical_block: str,
    rag_block: str,
    policy_disclaimer_required: bool,
) -> str:
    rules = [
        "Bạn là AI Mate, trợ lý học vụ thân thiện cho sinh viên UIT.",
        "Luôn trả lời bằng tiếng Việt, ngắn gọn, ưu tiên hành động cụ thể.",
        "Không đưa lời khuyên mang tính quyết định pháp lý/quy chế nếu không có nguồn quy chế phù hợp từ khối RAG.",
        "Nếu câu hỏi liên quan quy chế mà không có nguồn RAG phù hợp, hãy nói rõ không chắc và khuyên sinh viên kiểm tra Phòng Đào tạo; không bịa.",
        "Nếu dữ liệu học vụ (điểm, lịch) có thể chưa đồng bộ, hãy nêu rõ phần còn thiếu thay vì suy đoán.",
    ]
    if policy_disclaimer_required:
        rules.append(
            f"Cuối câu trả lời về quy chế, nhắc ngắn: {policy_disclaimer_vi()}"
        )
    parts = [
        "\n".join(rules),
        "--- Ngữ cảnh học vụ (server, đã lọc) ---",
        realtime_block,
        "--- Tóm tắt & ghim (server, không phải chat nguyên văn) ---",
        historical_block,
        "--- Trích quy chế (RAG, có thể rỗng) ---",
        rag_block,
    ]
    return "\n\n".join(parts)


def build_user_prompt(user_message: str) -> str:
    return user_message.strip()


def format_rag_block(sources: list[PolicySourceMeta], chunk_excerpts: list[str]) -> str:
    lines: list[str] = []
    for s, excerpt in zip(sources, chunk_excerpts, strict=True):
        lines.append(
            f"[doc_id={s.document_id} title={s.document_title!r} tag={s.tag!r} chunk={s.chunk_index}]\n{excerpt}"
        )
    return "\n\n".join(lines) if lines else "(Không có đoạn quy chế được truy xuất.)"


def summary_system_prompt() -> str:
    return (
        "Bạn tóm tắt phiên chat cho bộ nhớ dài hạn. "
        "Chỉ trả về JSON hợp lệ với hai khóa: courses_of_interest (mảng chuỗi, tên môn/ngành quan tâm) "
        "và recent_questions (mảng chuỗi, các chủ đề/câu hỏi ngắn, KHÔNG trích nguyên văn hội thoại). "
        "Tối đa 8 phần tử mỗi mảng."
    )
