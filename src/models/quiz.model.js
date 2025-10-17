import mongoose from "mongoose";

const quizeSchema = new mongoose.Schema({
    noteId: {
        type: mongoose.Types.ObjectId,
        ref: 'Note',
        required: true,
        unique: true
    },
    quize: [
        {
            question: {
                type: String,
                required: true
            },
            options: [
                {
                    type: String,
                    required: true
                }
            ],
            answer: {
                type: Number,
                required: true,
            }
        }
    ]
});

export const Quiz = mongoose.model('Quize', quizeSchema)