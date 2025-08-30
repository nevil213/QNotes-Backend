import mongoose, { Schema } from "mongoose";

const noteSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    url: {
        type: String,  // cloudinary note url
        required: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    noteVersions: [
        {
            content: {
            type: String, //md file texts
            required: true
            },
            id: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            }
        }
    ],
    starredNoteId: {
        type: mongoose.Schema.Types.ObjectId,  // id from noteversions
        required: true
    },
    isPublic: {
        type: Boolean,
        required: true,
        default: true
    }
}, { timestamps: true})

export const Note = mongoose.model('Note', noteSchema)