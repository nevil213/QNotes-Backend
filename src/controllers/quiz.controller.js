import mongoose from "mongoose";
import { Note } from "../models/note.model.js";
import { Quiz } from "../models/quiz.model.js";
import Transcript from "../models/transcript.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const createQuiz = asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    const quantity = req.body?.quantity || 10;
    const userId = req.user._id;

    if(!noteId){
        throw new ApiError(400, "noteid required for create quiz");
    }

    const note = await Note.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(noteId),
                $or: [
                    {owner: userId},
                    {isPublic: true}
                ]
            }
        },
        {
            $project: {
                note: {
                    $filter: {
                        input: '$noteVersions',
                        as: 'version',
                        cond: {
                            $eq: ['$$version._id', '$starredNoteId']
                        }
                    }
                }
            }
        },
        {
            $addFields: {
                note: {
                    $arrayElemAt: ['$note.content', 0]
                }
            }
        }
    ]);

    // console.log("note: ", note)

    if(!note || !note[0]){
        throw new ApiError(400, "note not found for create quiz");
    }

    if(quantity > 25){
        throw new ApiError(400, "Quantity should be less than or equal to 25");
    }

    if(quantity < 5){
        throw new ApiError(400, "Quantity should be greater than 5");
    }

    const quiz = await Quiz.find({noteId});

    if(quiz.length !== 0){
        throw new ApiError(400, "quiz for this note is already created");
    }

    const transcript = await Transcript.find({noteId});
    
    let text;

    if(transcript){
        text = transcript[0].text;
    }
    else{
        text = note[0];
    }

    // console.log("text:", text);

    const models = [
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'llama-3.3-70b-versatile',
        'moonshotai/kimi-k2-instruct-0905',
        'llama-3.1-8b-instant',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
    ];

    let quizResponse;
    let modelUsed;

    for (const model of models) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        "role": "system", "content": `You are concise quize maker, you have the knowledge about the the text written and also you can ask important questions well. Your job is to use your existing knowledge and this provided text to make a well quize of ${quantity} mcqs(Multiple Choice Question) with 4 questions and 1 answer in simple language in strictly english language. you should response strickly in this format [{"question": "<question>", "options": ["<option 1>", "<option 2>", "<option 3>", "<option 4>"], "answer": <index of currect answer from the options (e.g. 0/1/2/3)>}]. no need of your wordings like <here is the note or something like that>`
                    },
                    {
                        "role": "user", "content": text
                    }
                ]
            })
        });

        quizResponse = await response.json();

        // console.log(`Trying model for notes: ${model}`, quizResponse);

        if (!quizResponse.error) {
            modelUsed = model;
            break;
        }

        if (quizResponse.error?.code === 'rate_limit_exceeded') {
            // console.log(`Rate limit exceeded for ${model}, trying next model...`);
            continue;
        } else {
            throw new ApiError(501, `API error: ${quizResponse.error?.message || 'Unknown error'}`);
        }
    }

    if(!quizResponse || !quizResponse.choices || quizResponse.choices.length === 0){
        throw new ApiError(501, "something went wrong while creating notes - all models failed or rate limited");
    }

    // console.log(quizResponse.choices[0].message.content);
    let quizData;

    try{
        quizData = JSON.parse(quizResponse.choices[0].message.content);
        const formattedQuizData = quizData.map(item => ({
            question: item.question,
            options: item.options,
            answer: item.answer
        }));
        const newQuiz = new Quiz({
            noteId: noteId,
            quize: formattedQuizData
        });
        await newQuiz.save();
        return res.status(200).json(
            new ApiResponse(200, newQuiz, "quiz generated successfully")
        )

    }   catch(err){
        throw new ApiError(500, "Failed to parse quiz data from response");
    }    
})

const addQuestionsToQuiz = asyncHandler(async (req, res) => {
    // to be implemented later
    
});

const getQuizByNoteId = asyncHandler(async (req, res) => {
    const { noteId } = req.params;
    if(!noteId){
        throw new ApiError(400, "noteid required for get quiz");
    }

    const note = await Note.find({_id: noteId, $or: [
        {owner: req.user._id},
        {isPublic: true}
    ]});

    if(!note || note.length === 0){
        throw new ApiError(404, "note not found for this noteid");
    }

    const quiz = await Quiz.findOne({noteId});

    if(!quiz){
        throw new ApiError(404, "quiz not found for this noteid");
    }

    return res.status(200).json(
        new ApiResponse(200, quiz, "quiz fetched successfully")
    )
});

const deleteQuizByNoteId = asyncHandler(async (req, res) => {
    // to be implemented later
});

export {
    createQuiz,
    getQuizByNoteId
}