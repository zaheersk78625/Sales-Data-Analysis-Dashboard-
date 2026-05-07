import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email Transporter Setup
  const getTransporter = () => {
    const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;
    
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.warn("⚠️ Email credentials missing. Notifications will be logged to console only.");
      return null;
    }

    return nodemailer.createTransport({
      service: EMAIL_SERVICE || 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  };

  // --- API Routes ---

  app.post("/api/notify", async (req, res) => {
    const { type, payload, receiver } = req.body;
    const targetEmail = receiver || process.env.NOTIFICATION_RECEIVER;

    const subjectMap: Record<string, string> = {
      'AI_INSIGHTS': '🚀 New Strategic Insights Generated - Nexus Sales',
      'PERFORMANCE_ALERT': '⚠️ Critical Performance Alert - Nexus Sales',
      'REPORT_READY': '📊 Monthly Sales Report is Ready'
    };

    const content = `
      <h2>Nexus Sales Notification</h2>
      <p><strong>Type:</strong> ${type.replace('_', ' ')}</p>
      <div style="padding: 15px; background: #f4f4f4; border-radius: 8px;">
        ${payload}
      </div>
      <p style="font-size: 0.8em; color: #666;">This is an automated notification from your Nexus Business Intelligence Dashboard.</p>
    `;

    console.log(`[Notification] Triggering ${type} alert...`);

    const transporter = getTransporter();
    if (transporter && targetEmail) {
      try {
        await transporter.sendMail({
          from: `"Nexus Analytics" <${process.env.EMAIL_USER}>`,
          to: targetEmail,
          subject: subjectMap[type] || 'Nexus Notification',
          html: content,
        });
        res.json({ success: true, method: 'email' });
      } catch (error) {
        console.error("Failed to send email:", error);
        res.status(500).json({ success: false, error: 'Email service error' });
      }
    } else {
      // Fallback: Console log if no email config
      console.log("------------------------------------------");
      console.log(`SUBJECT: ${subjectMap[type]}`);
      console.log(`CONTENT: ${payload}`);
      console.log("------------------------------------------");
      res.json({ success: true, method: 'console' });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.VITE_DEV_SERVER || process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Nexus Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export default await startServer();
