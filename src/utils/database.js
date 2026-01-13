const mongoose = require("mongoose");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/caption_generator";

    await mongoose.connect(mongoURI);

    console.log("✅ MongoDB connected successfully");
    console.log(`📍 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Video Schema
const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
  },
  uploadPath: {
    type: String,
    required: true,
  },
  audioPath: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    default: "uploaded",
    enum: [
      "uploaded",
      "extracting_audio",
      "splitting",
      "transcribing",
      "merging",
      "completed",
      "failed",
    ],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

// Chunk Schema
const chunkSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    index: true,
  },
  chunkIndex: {
    type: Number,
    required: true,
  },
  chunkPath: {
    type: String,
    required: true,
  },
  transcript: {
    type: String,
    default: null,
  },
  startTime: {
    type: Number,
    default: null,
  },
  endTime: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    default: "pending",
    enum: ["pending", "processing", "completed", "failed"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

// Create compound index for efficient querying
chunkSchema.index({ videoId: 1, chunkIndex: 1 }, { unique: true });

// Caption Schema
const captionSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    index: true,
  },
  chunkIndex: {
    type: Number,
    required: true,
  },
  startTime: {
    type: Number,
    required: true,
  },
  endTime: {
    type: Number,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
});

// Create index for efficient sorting
captionSchema.index({ videoId: 1, chunkIndex: 1, startTime: 1 });

// Create models
const Video = mongoose.model("Video", videoSchema);
const Chunk = mongoose.model("Chunk", chunkSchema);
const Caption = mongoose.model("Caption", captionSchema);

// Video operations
const createVideo = async (videoId, filename, uploadPath) => {
  const video = new Video({
    videoId,
    filename,
    uploadPath,
  });
  return await video.save();
};

const getVideo = async (videoId) => {
  return await Video.findOne({ videoId });
};

const updateVideoStatus = async (videoId, status) => {
  return await Video.findOneAndUpdate(
    { videoId },
    {
      status,
      completedAt: status === "completed" ? new Date() : null,
    },
    { new: true }
  );
};

const updateVideoAudioPath = async (videoId, audioPath) => {
  return await Video.findOneAndUpdate(
    { videoId },
    { audioPath },
    { new: true }
  );
};

// Chunk operations
const createChunk = async (videoId, chunkIndex, chunkPath) => {
  const chunk = new Chunk({
    videoId,
    chunkIndex,
    chunkPath,
  });
  return await chunk.save();
};

const getChunks = async (videoId) => {
  return await Chunk.find({ videoId }).sort({ chunkIndex: 1 });
};

const getPendingChunk = async (videoId) => {
  return await Chunk.findOne({
    videoId,
    status: "pending",
  }).sort({ chunkIndex: 1 });
};

const updateChunkStatus = async (chunkId, status) => {
  return await Chunk.findByIdAndUpdate(
    chunkId,
    {
      status,
      completedAt: status === "completed" ? new Date() : null,
    },
    { new: true }
  );
};

const updateChunkTranscript = async (videoId, chunkIndex, transcript) => {
  return await Chunk.findOneAndUpdate(
    { videoId, chunkIndex },
    { transcript },
    { new: true }
  );
};

// Caption operations
const insertCaption = async (videoId, chunkIndex, startTime, endTime, text) => {
  const caption = new Caption({
    videoId,
    chunkIndex,
    startTime,
    endTime,
    text,
  });
  return await caption.save();
};

const getCaptions = async (videoId) => {
  return await Caption.find({ videoId }).sort({ chunkIndex: 1, startTime: 1 });
};

const deleteVideoCaptions = async (videoId) => {
  return await Caption.deleteMany({ videoId });
};

const getHistory = async () => {
  return await Video.find({ status: "completed" })
    .sort({ createdAt: -1 })
    .select("videoId filename createdAt completedAt"); // Select only needed fields
};

const deleteVideo = async (videoId) => {
  // Delete video record
  const video = await Video.findOne({ videoId });
  if (!video) return null;

  await Video.deleteOne({ videoId });
  await Chunk.deleteMany({ videoId });
  await Caption.deleteMany({ videoId });

  return video;
};

module.exports = {
  connectDB,
  Video,
  Chunk,
  Caption,
  createVideo,
  getVideo,
  updateVideoStatus,
  updateVideoAudioPath,
  createChunk,
  getChunks,
  getPendingChunk,
  updateChunkStatus,
  updateChunkTranscript,
  insertCaption,
  getCaptions,
  deleteVideoCaptions,
  getHistory,
  deleteVideo,
};
