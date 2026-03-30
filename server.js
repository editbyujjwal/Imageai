import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: "YOUR_API_KEY"
});

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${h}:${m}:${s},000`;
}

function toSRT(segments) {
  return segments.map((seg, i) => {
    return `${i + 1}
${formatTime(seg.start)} --> ${formatTime(seg.end)}
${seg.text}\n`;
  }).join("\n");
}

app.post("/upload", upload.single("video"), async (req, res) => {
  try {
    const videoPath = req.file.path;
    const audioPath = `${videoPath}.mp3`;

    await extractAudio(videoPath, audioPath);

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "gpt-4o-transcribe",
      response_format: "verbose_json"
    });

    const srt = toSRT(response.segments);

    res.json({
      transcript: response.text,
      srt: srt
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => console.log("Server running on 3000"));
