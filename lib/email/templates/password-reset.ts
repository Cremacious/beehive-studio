interface PasswordResetEmailOptions {
  url: string
  username: string
}

export function passwordResetEmailHtml({ url, username }: PasswordResetEmailOptions): string {
  const greeting = username ? `Hi @${username},` : 'Hi there,'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset your Beehive Studio password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Email card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a1a;border-radius:12px 12px 0 0;padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:700;color:#FFC300;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">Beehive Studio</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 28px 40px;">

              <p style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;">Reset your password</p>

              <p style="margin:16px 0 0 0;font-size:15px;color:#444444;line-height:1.6;">${greeting}</p>
              <p style="margin:12px 0 0 0;font-size:15px;color:#444444;line-height:1.6;">
                We received a request to reset your Beehive Studio password. Click the button below to choose a new one.
              </p>
              <p style="margin:6px 0 0 0;font-size:14px;color:#888888;line-height:1.6;">This link expires in 1 hour.</p>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;">
                <tr>
                  <td style="border-radius:9999px;background-color:#FFC300;">
                    <a href="${url}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#1a1a1a;text-decoration:none;border-radius:9999px;font-family:Arial,Helvetica,sans-serif;">
                      Reset my password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Raw URL fallback -->
              <p style="margin:24px 0 0 0;font-size:13px;color:#888888;line-height:1.6;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:6px 0 0 0;font-size:12px;color:#888888;line-height:1.6;word-break:break-all;">
                <a href="${url}" style="color:#888888;">${url}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9f9f9;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e8e8e8;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
                If you did not request a password reset, you can safely ignore this email. Your password will not change.
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#cccccc;line-height:1.6;">
                Beehive Studio
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>
</body>
</html>`
}

export function passwordResetEmailText({ url, username }: PasswordResetEmailOptions): string {
  const greeting = username ? `Hi @${username},` : 'Hi there,'

  return `${greeting}

We received a request to reset your Beehive Studio password.

Reset your password by visiting the link below. This link expires in 1 hour.

${url}

If you did not request a password reset, you can safely ignore this email. Your password will not change.

-- Beehive Studio`
}
