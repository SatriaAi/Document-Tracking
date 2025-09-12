import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false, // biar bisa handle raw file
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Missing BLOB_READ_WRITE_TOKEN" });
    }

    // Ambil nama file dari query param
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const blob = await put(filename, req, {
      access: "public",
      token,
    });

    return res.status(200).json(blob);
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}
