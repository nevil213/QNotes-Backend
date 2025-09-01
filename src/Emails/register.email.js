// const nodemailer = require("nodemailer");
import nodemailer from "nodemailer";

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: `${process.env.EMAIL}`,
    pass: `${process.env.EMAIL_PASSWORD}`,
  },
});


// Wrap in an async IIFE so we can use await.
const verificationMail = async (otp, email, verificationUrl) => {
const info = await transporter.sendMail({
    from: `"QNotes" ${process.env.EMAIL}>`,
    to: email,
    subject: "Verification Email",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your QNotes account</title>
  <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
</head>

<body style="font-family: Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #E6E6E6;">
  <table role="presentation"
    style="width: 100%; border-collapse: collapse; border: 0px; border-spacing: 0px; font-family: Arial, Helvetica, sans-serif; background-color: #E6E6E6;">
    <tbody>
      <tr>
        <td align="center" style="padding: 1rem 2rem; vertical-align: top; width: 100%;">
          <table role="presentation" style="max-width: 600px; border-collapse: collapse; border: 0px; border-spacing: 0px; text-align: left;">
            <tbody>
              <tr>
                <td style="padding: 40px 0px 0px;">
                  <div style="padding: 30px; background-color: #ffffff; border-radius: 8px; box-shadow: 0px 2px 10px rgba(0,0,0,0.1);">
                    <div style="color: #002E63; text-align: center; border-bottom: 2px solid #E6E6E6; padding-bottom: 20px; margin-bottom: 20px;">
                      <h2 style="margin: 0; padding-bottom: 10px; color: #002E63;">Verification Code</h2>
                      <p style="margin: 0; color: #555555;">Use this code to complete your registration</p>
                    </div>
                    <div style="text-align: center;">
                      <p style="color: #555555; margin-bottom: 20px;">Your verification code is:</p>
                      <div style="background-color: #E6E6E6; border-radius: 6px; padding: 15px; margin: 0 auto 25px auto; width: 180px;">
                        <span style="color: #002E63; font-size: 30px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
                      </div>
                      <a href="${verificationUrl}" style="text-decoration: none; display: inline-block;">
                        <div style="background-color: #26D400; border-radius: 4px; padding: 12px; margin: 25px auto; width: 200px;">
                          <span style="color: white; font-size: 16px; font-weight: bold;">Verify My Account</span>
                        </div>
                      </a>
                      <p style="color: #555555; font-size: 14px;">This code will expire in 15 minutes</p>
                      <p style="color: #C40000; font-size: 13px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                  </div>
                  <div style="padding-top: 20px; color: #555555; text-align: center;">
                    <p style="padding-bottom: 16px; font-size: 13px;">Made with ♥ in India</p>
                    <p style="color: #002E63; font-size: 12px; margin: 5px 0;">© 2025 QNotes. All rights reserved.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>

</html>`, // HTML body
});

  console.log("Message sent:", info.messageId);
};

export {
    verificationMail
}