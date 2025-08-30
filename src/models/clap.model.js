import mongoose, { Schema } from "mongoose";

const clapSchema = new Schema({
    noteId: {
        type: Schema.Types.ObjectId,
        ref: 'Note',
        required: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    claps: {
        type: Number,
        required: true,
        min: 0,
        max: 50
    }
})

export const Clap = mongoose.model('Clap', clapSchema)
