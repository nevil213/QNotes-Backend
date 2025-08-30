import mongoose, { Schema } from "mongoose";

const transcriptSchema = new Schema({
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Note",
        required: true,
        unique: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Transcript = mongoose.model("Transcript", transcriptSchema);

export default Transcript;