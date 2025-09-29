// lib/sendEmail.ts
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface SendEmailProps {
  to: string;          // Correo del destinatario
  subject: string;     // Asunto del correo
  content: string;     // Contenido HTML o texto
  link?: string;       // Link opcional que quieres agregar al contenido
}

export async function sendEmail({ to, subject, content, link }: SendEmailProps) {
  const htmlContent = `
    <div>
      <p>${content}</p>
      ${link ? `<p>Accede aquí: <a href="${link}">${link}</a></p>` : ""}
    </div>
  `;

  const msg = {
    to,
    from: process.env.EMAIL_FROM!,
    subject,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    console.log(`Correo enviado a ${to}`);
  } catch (error) {
    console.error(`Error al enviar correo a ${to}:`, error);
  }
}
