# Justice Ultimate Automobiles Backend - Email Setup Guide

## 1. Enable SendGrid (Recommended for Production)

1. Go to https://sendgrid.com/ and log in or create an account.
2. Navigate to **Settings > API Keys**.
3. Click **Create API Key**. Give it a name and select "Full Access" or at least "Mail Send".
4. Copy the generated API key.
5. In your `backend j/server/` directory, create or edit a `.env` file and add:
   
   SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY
   EMAIL_FROM=your_verified_sendgrid_email@example.com

6. Restart your backend server:
   node index.js

---

## 2. Enable Gmail (For Testing/Development)

1. Create a Gmail account (or use an existing one).
2. Go to your Google Account > Security > "App passwords" (you may need to enable 2-Step Verification first).
3. Generate an App Password for "Mail".
4. In your `.env` file, add:
   
   GMAIL_USER=your_gmail_address@gmail.com
   GMAIL_PASS=your_gmail_app_password
   EMAIL_FROM=your_gmail_address@gmail.com

5. Restart your backend server:
   node index.js

---

## 3. How to Use Email Features

- The backend will automatically use SendGrid if SENDGRID_API_KEY is set and valid. Otherwise, it will use Gmail.
- To send a receipt (or any email with PDF attachment), make a POST request to:

  POST http://localhost:5001/send-receipt
  Headers: { Authorization: Bearer <admin_token>, Content-Type: application/json }
  Body (JSON):
  {
    "to": "recipient@example.com",
    "subject": "Your Receipt",
    "html": "<b>Thank you for your purchase!</b>",
    "pdfBase64": "<base64-encoded-pdf>",
    "filename": "receipt.pdf"
  }

- For admin alerts, POST to `/api/admin/alert` (see adminSecurity.js for details).

---

## 4. Troubleshooting
- If you see "SendGrid API key not configured or invalid. Email alerts will be disabled.", check your .env file and restart the server.
- For Gmail, make sure you use an App Password, not your regular Gmail password.
- Check your spam folder if emails are not received.

---

**Need more help? Ask your developer or contact support!** 