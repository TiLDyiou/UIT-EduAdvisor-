"""Script to send mock deadlines and exam schedule emails to user with inline styles for full compatibility."""

import asyncio
import logging
import sys

# Thêm thư mục hiện tại vào sys.path để python nhận diện được app module
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import get_settings
from app.services.bot.real_sender import RealPlatformSender

logger = logging.getLogger(__name__)

# Email-compatible HTML content with inline styles for deadlines
DEADLINES_HTML = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Nhắc nhở hạn nộp bài tập</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; border: 1px solid #e5e7eb;">
        
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Danh sách các bài tập sắp hết hạn cần hoàn thành</p>
        </div>


        <div style="display: block; gap: 16px;">
            <!-- task item 1 -->
            <div style="border-radius:12px;border:1px solid #e5e7eb;background-color:#ffffff;padding:20px;margin-bottom:16px">
                <div style="display:flex;margin-bottom:12px">
                    <div style="margin-right:12px;display:inline-flex;height:18px;width:18px;border-radius:6px;border:1.5px solid #d1d5db;background-color:#f9fafb"></div>
                    <p style="margin:0;font-size:16px;font-weight:500;color:#1f2937;line-height:1.4">
                        Nộp báo cáo đồ án môn học nhập môn công nghệ thông tin
                    </p>
                </div>
                <div style="padding-left:30px;margin-top:8px">
                    <div style="margin-bottom:6px">
                        <span style="font-size:14px;color:#6b7280">Môn học:</span>
                        <span style="background-color:#eff6ff;color:#2563eb;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;margin-left:4px;display:inline-block">IT001</span>
                    </div>
                    <div>
                        <span style="font-size:14px;color:#6b7280">Hạn chót:</span>
                        <span style="font-size:14px;color:#ef4444;font-weight:600;margin-left:4px">Hôm nay / Sắp hết hạn (26/06/2026 23:59)</span>
                    </div>
                </div>
            </div>

            <!-- task item 2 -->
            <div style="border-radius:12px;border:1px solid #e5e7eb;background-color:#ffffff;padding:20px;margin-bottom:16px">
                <div style="display:flex;margin-bottom:12px">
                    <div style="margin-right:12px;display:inline-flex;height:18px;width:18px;border-radius:6px;border:1.5px solid #d1d5db;background-color:#f9fafb"></div>
                    <p style="margin:0;font-size:16px;font-weight:500;color:#1f2937;line-height:1.4">
                        Hoàn thành bài thực hành 4 môn Cấu trúc dữ liệu và Giải thuật
                    </p>
                </div>
                <div style="padding-left:30px;margin-top:8px">
                    <div style="margin-bottom:6px">
                        <span style="font-size:14px;color:#6b7280">Môn học:</span>
                        <span style="background-color:#eff6ff;color:#2563eb;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;margin-left:4px;display:inline-block">IT002</span>
                    </div>
                    <div>
                        <span style="font-size:14px;color:#6b7280">Hạn chót:</span>
                        <span style="font-size:14px;color:#4b5563;font-weight:600;margin-left:4px">28/06/2026 23:59</span>
                    </div>
                </div>
            </div>

            <!-- task item 3 -->
            <div style="border-radius:12px;border:1px solid #e5e7eb;background-color:#ffffff;padding:20px;margin-bottom:16px">
                <div style="display:flex;margin-bottom:12px">
                    <div style="margin-right:12px;display:inline-flex;height:18px;width:18px;border-radius:6px;border:1.5px solid #d1d5db;background-color:#f9fafb"></div>
                    <p style="margin:0;font-size:16px;font-weight:500;color:#1f2937;line-height:1.4">
                        Nộp bài tập Assignment 2 môn Kiến trúc phần mềm
                    </p>
                </div>
                <div style="padding-left:30px;margin-top:8px">
                    <div style="margin-bottom:6px">
                        <span style="font-size:14px;color:#6b7280">Môn học:</span>
                        <span style="background-color:#eff6ff;color:#2563eb;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;margin-left:4px;display:inline-block">SE100</span>
                    </div>
                    <div>
                        <span style="font-size:14px;color:#6b7280">Hạn chót:</span>
                        <span style="font-size:14px;color:#4b5563;font-weight:600;margin-left:4px">30/06/2026 23:59</span>
                    </div>
                </div>
            </div>
        </div>
        </div>
    </div>
</body>
</html>
"""

# Email-compatible HTML content with inline styles for exams
EXAMS_HTML = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Nhắc nhở lịch thi sắp tới</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; border: 1px solid #e5e7eb;">
        
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Lịch thi các môn học sắp diễn ra</p>
        </div>

        <div style="overflow: hidden; border-radius: 12px; border: 1px solid #e5e7eb; background-color: #ffffff; padding-top: 16px;">
            <div style="margin-bottom: 16px; padding: 0 24px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0;">
                    Lịch thi chi tiết
                </h3>
            </div>

            <div style="width: 100%; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <!-- table header start -->
                    <thead>
                        <tr style="border-top: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; background-color: #f9fafb;">
                            <th style="padding: 12px 24px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                                Mã môn
                            </th>
                            <th style="padding: 12px 24px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                                Tên môn học
                            </th>
                            <th style="padding: 12px 24px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                                Ngày thi
                            </th>
                            <th style="padding: 12px 24px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                                Ca thi
                            </th>
                            <th style="padding: 12px 24px; text-align: left; font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                                Phòng thi
                            </th>
                        </tr>
                    </thead>
                    <!-- table header end -->
 
                    <!-- table body start -->
                    <tbody style="border-top: 1px solid #f3f4f6;">
                        <!-- row 1 -->
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; font-weight: 600; color: #374151;">
                                IT001
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; font-weight: 500; color: #374151;">
                                Nhập môn Điện tử viễn thông
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                29/06/2026
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                Ca 1
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                C301
                            </td>
                        </tr>
 
                        <!-- row 2 -->
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; font-weight: 600; color: #374151;">
                                SE100
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; font-weight: 500; color: #374151;">
                                Thiết kế phần mềm hướng đối tượng
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                29/06/2026
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                Ca 3
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                A102
                            </td>
                        </tr>
 
                        <!-- row 3 -->
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; font-weight: 600; color: #374151;">
                                CS200
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; font-weight: 500; color: #374151;">
                                Cơ sở dữ liệu nâng cao
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                29/06/2026
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                Ca 2
                            </td>
                            <td style="padding: 16px 24px; white-space: nowrap; font-size: 14px; color: #374151;">
                                B202
                            </td>
                        </tr>
                    </tbody>
                    <!-- table body end -->
                </table>
            </div>
        </div>
    </div>
</body>
</html>
"""

SINGLE_DEADLINE_HTML = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Nhắc nhở hạn nộp bài tập</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Bạn có bài tập sắp hết hạn cần hoàn thành</p>
        </div>
        <div style="border-radius:12px;border:1px solid #e5e7eb;background-color:#ffffff;padding:20px;margin-bottom:16px">
            <div style="display:flex;margin-bottom:12px">
                <div style="margin-right:12px;display:inline-flex;height:18px;width:18px;border-radius:6px;border:1.5px solid #d1d5db;background-color:#f9fafb"></div>
                <p style="margin:0;font-size:16px;font-weight:500;color:#1f2937;line-height:1.4">
                    Nộp báo cáo đồ án môn học nhập môn công nghệ thông tin
                </p>
            </div>
            <div style="padding-left:30px;margin-top:8px">
                <div style="margin-bottom:6px">
                    <span style="font-size:14px;color:#6b7280">Môn học:</span>
                    <span style="background-color:#eff6ff;color:#2563eb;font-size:12px;font-weight:600;border-radius:6px;padding:3px 8px;margin-left:4px;display:inline-block">IT001</span>
                </div>
                <div>
                    <span style="font-size:14px;color:#6b7280">Hạn chót:</span>
                    <span style="font-size:14px;color:#ef4444;font-weight:600;margin-left:4px">Hôm nay / Sắp hết hạn (26/06/2026 23:59)</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>"""

SINGLE_EXAM_HTML = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Nhắc nhở lịch thi sắp tới</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 24px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 20px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Lịch thi môn học sắp diễn ra</p>
        </div>
        <div style="border-radius: 12px; border: 1px solid #e5e7eb; background-color: #ffffff; padding: 20px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
            <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">Thông tin phòng thi</h3>
            <div style="margin-bottom: 12px;">
                <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Môn học:</span>
                <span style="font-size: 16px; font-weight: 500; color: #111827;">IT001 - Nhập môn Điện tử viễn thông</span>
            </div>
             <div style="margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 24px;">
                <div style="flex: 1; min-width: 120px;">
                    <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Ngày thi:</span>
                    <span style="font-size: 16px; font-weight: 500; color: #111827;">29/06/2026</span>
                </div>
                <div style="flex: 1; min-width: 120px;">
                    <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Ca thi:</span>
                    <span style="font-size: 16px; font-weight: 500; color: #111827;">Ca 1</span>
                </div>
            </div>
            <div style="margin-bottom: 12px;">
                <span style="font-size: 14px; color: #6b7280; display: block; margin-bottom: 2px;">Phòng thi:</span>
                <span style="font-size: 16px; font-weight: 600; color: #2563eb;">C301</span>
            </div>
            <div style="margin-top: 16px;">
                <span style="background-color: #fef3c7; color: #d97706; font-size: 12px; font-weight: 500; border-radius: 9999px; padding: 4px 12px; display: inline-block;">Sắp diễn ra</span>
            </div>
        </div>
    </div>
</body>
</html>"""

OTP_HTML = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UIT EduAdvisor - Xác nhận liên kết Email</title>
</head>
<body style="background-color: #f9fafb; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937;">
    <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 32px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6;">
            <h2 style="font-size: 22px; font-weight: bold; color: #111827; margin: 0;">UIT EduAdvisor</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 6px 0 0 0;">Liên kết địa chỉ Email để nhận thông báo tự động</p>
        </div>
        <div style="margin-bottom: 24px; text-align: center;">
            <p style="font-size: 15px; color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">
                Bạn đã yêu cầu liên kết địa chỉ email này với tài khoản học sinh tại UIT EduAdvisor. Vui lòng sử dụng mã OTP dưới đây để xác nhận:
            </p>
            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 16px 24px; display: inline-block; margin-bottom: 20px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 4px;">123456</span>
            </div>
            <p style="font-size: 13px; color: #9ca3af; margin: 0;">
                Mã xác nhận này sẽ hết hạn sau <strong>5 phút</strong>. Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này.
            </p>
        </div>
        <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                Đây là email tự động, vui lòng không phản hồi email này.
            </p>
        </div>
    </div>
</body>
</html>"""

async def main():
    recipient = "dain03242@gmail.com"
    settings = get_settings()
    
    print(f"SMTP Configuration:")
    print(f"Host: {settings.smtp_host}:{settings.smtp_port}")
    print(f"User: {settings.smtp_user}")
    print(f"From: {settings.smtp_from_email}")
    print(f"Sending mock compatible inline-styled HTML emails to {recipient}...")
    
    sender = RealPlatformSender(settings)
    
    # Send Email 1: Deadlines Board
    print("Sending Email 1: Deadlines Board...")
    ok1 = await sender.send_message("mail", recipient, DEADLINES_HTML)
    if ok1:
        print("-> Email 1 sent successfully!")
    else:
        print("-> Failed to send Email 1.")
        
    # Send Email 2: Exams Board
    print("Sending Email 2: Exam Schedule Board...")
    ok2 = await sender.send_message("mail", recipient, EXAMS_HTML)
    if ok2:
        print("-> Email 2 sent successfully!")
    else:
        print("-> Failed to send Email 2.")

    # Send Email 3: Single Deadline Reminder
    print("Sending Email 3: Single Deadline Reminder...")
    ok3 = await sender.send_message("mail", recipient, SINGLE_DEADLINE_HTML)
    if ok3:
        print("-> Email 3 sent successfully!")
    else:
        print("-> Failed to send Email 3.")

    # Send Email 4: Single Exam Reminder
    print("Sending Email 4: Single Exam Reminder...")
    ok4 = await sender.send_message("mail", recipient, SINGLE_EXAM_HTML)
    if ok4:
        print("-> Email 4 sent successfully!")
    else:
        print("-> Failed to send Email 4.")

    # Send Email 5: OTP Verification
    print("Sending Email 5: OTP Verification...")
    ok5 = await sender.send_message("mail", recipient, OTP_HTML)
    if ok5:
        print("-> Email 5 sent successfully!")
    else:
        print("-> Failed to send Email 5.")

if __name__ == "__main__":
    asyncio.run(main())
