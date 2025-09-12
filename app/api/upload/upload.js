import { put } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const file = req.body; // nanti formData dari frontend
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("Missing BLOB_READ_WRITE_TOKEN");
    }

    const blob = await put(file.name, file, {
      access: "public",
      token,
    });

    return res.status(200).json(blob);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
