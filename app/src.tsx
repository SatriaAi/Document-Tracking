import { useState } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      setUrl(data.url);
    } else {
      alert("Upload failed: " + data.error);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Upload to Vercel Blob</h1>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload}>Upload</button>
      {url && (
        <p>
          ✅ Uploaded: <a href={url} target="_blank">{url}</a>
        </p>
      )}
    </div>
  );
}

export default App;
