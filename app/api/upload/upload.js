import { put } from "@vercel/blob";
import formidable from "formidable";
import fs from "fs";

// Disable default body parsing (biar bisa handle file upload)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(400).json({ error: "File parsing error" });
      }

      const file = files.file;
      const stream = fs.createReadStream(file.filepath);

      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        return res.status(500).json({ error: "Missing BLOB_READ_WRITE_TOKEN" });
      }

      const blob = await put(file.originalFilename, stream, {
        access: "public",
        token,
      });

      return res.status(200).json(blob);
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
