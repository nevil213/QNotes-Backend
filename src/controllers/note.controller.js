import { Note } from "../models/note.model.js";
import { reduceAudioBuffer } from "../utils/reduceAudio.js";
import mongoose from "mongoose";
import Transcript from "../models/transcript.model.js";
import { deleteCloudinaryVideo } from "../utils/deleteCloudinaryFile.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { AUDIO_PATH } from "../constants.js";
import { parseFile } from "../utils/parser.js";

// create Note
const createNote = asyncHandler( async (req, res) => {
    const userId = req.user._id;
    
    try {
        
        if(req.file) {
            
            const inputBuffer = req.file.buffer;

            let processedBuffer;
            try {
            processedBuffer = await reduceAudioBuffer(inputBuffer);
            } catch (error) {
                throw new ApiError(400, error.message);
            }

            if(!processedBuffer) {
                throw new ApiError(400, 'Audio processing failed');
            }

            const response = await uploadOnCloudinary(processedBuffer, AUDIO_PATH);
            if (!response?.url) {
                throw new ApiError(400, 'Note upload failed');
            }
            
            
            const noteBlob = new Blob([processedBuffer], { type: "audio/opus" });
            
            const formData = new FormData();
            formData.append("file", noteBlob, "note.mp3");
            formData.append("model", "whisper-large-v3-turbo");
            
            const transcriptResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: formData
            });
            
            console.log(response)
            
            const result = await transcriptResponse.json();
            
            console.log("result", result);
            if(!result || !result.text){
                throw new ApiError(400, "audio processing failed");
            }
            
            const models = [
                'openai/gpt-oss-120b',
                'openai/gpt-oss-20b',
                'llama-3.3-70b-versatile',
                'moonshotai/kimi-k2-instruct-0905',
                'llama-3.1-8b-instant',
                'meta-llama/llama-4-maverick-17b-128e-instruct'
            ];

            let notesResult;
            let notesModelUsed;

            for (const model of models) {
                const notesResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { "role": "system", "content": "You are a concise note-maker, you have the knowledge about the topic explained in the transcript and also you can explain it well. Your job is to use your existing knowledge and this provided transcript to make a well detailed notes in simple language in strictly english language which includes almost whole the transcript. no need of your wordings like <here is the note or something like that>" },
                            { "role": "user", "content": result.text }
                        ]
                    })
                });

                notesResult = await notesResponse.json();

                console.log(`Trying model for notes: ${model}`, notesResult);

                if (!notesResult.error) {
                    notesModelUsed = model;
                    break;
                }

                if (notesResult.error?.code === 'rate_limit_exceeded') {
                    console.log(`Rate limit exceeded for ${model}, trying next model...`);
                    continue;
                } else {
                    throw new ApiError(400, `API error: ${notesResult.error?.message || 'Unknown error'}`);
                }
            }
            
            if(!notesResult || !notesResult.choices || notesResult.choices.length === 0){
                throw new ApiError(400, "notes generation failed - all models failed or rate limited");
            }
            
            let titleDescriptionResult;
            let titleModelUsed;

            const modelsfortitle = [
                'moonshotai/kimi-k2-instruct',
                'moonshotai/kimi-k2-instruct-0905',
                'llama-3.1-8b-instant',
                'llama-3.3-70b-versatile',
                'meta-llama/llama-4-maverick-17b-128e-instruct',
                'groq/compound'
            ];

            for (const model of modelsfortitle) {
                const titleDescriptionResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { "role": "system", "content": 'You are a title and description maker. Your job is to create title and short 1 line descriptions based on the given notes. the response should be in this json format only. {"title": <title inside double quotes>, "description": <description inside double quotes>}. nothing should be there in the response other than this format, not your wordings like <here is the title and description>' },
                            { "role": "user", "content": notesResult.choices[0].message.content }
                        ]
                    })
                });

                titleDescriptionResult = await titleDescriptionResponse.json();

                console.log(`Trying model for title/description: ${model}`, titleDescriptionResult);

                if (!titleDescriptionResult.error) {
                    titleModelUsed = model;
                    break;
                }

                if (titleDescriptionResult.error?.code === 'rate_limit_exceeded') {
                    console.log(`Rate limit exceeded for ${model}, trying next model...`);
                    continue;
                } else {
                    console.log(`API error for title/description with ${model}, trying next model...`);
                    continue;
                }
            }
            
            let title;
            let description;
            
            if(!titleDescriptionResult || !titleDescriptionResult.choices || titleDescriptionResult.choices.length === 0){
                title = "Untitled";
                description = "No description available";
            }
            else{
                // Parse the JSON string to extract title and description
                let parsed;
                try {
                    // Remove curly braces if present and parse as JSON
                    let content = titleDescriptionResult.choices[0].message.content.trim();
                    if (content.startsWith("{") && content.endsWith("}")) {
                        parsed = JSON.parse(content);
                        title = parsed.title || "Untitled";
                        description = parsed.description || "No description available";
                    } else {
                        title = "Untitled";
                        description = "No description available";
                    }
                } catch (e) {
                    title = "Untitled";
                    description = "No description available";
                    console.log("Error parsing title and description JSON:", e);
                }
            }
            
            const _id = new mongoose.Types.ObjectId()
            
            const note = await Note.create({
                owner: userId,
                url: response?.url,
                title,
                description,
                noteVersions: [
                    {
                        content: notesResult.choices[0].message.content,
                        _id
                    }
                ],
                starredNoteId: _id
            });
            
            if(!note){
                throw new ApiError(500, "something went wrong while creating note");
            }
            
            const transcript = await Transcript.create({
                noteId: note?._id,
                text: result.text
            });
            
            if(!transcript){
                throw new ApiError(500, "something went wrong while creating transcript");
            }
            
            const user = await User.findByIdAndUpdate(
                userId,
                {
                    $push: {
                        notes: note._id
                    }
                },
                {
                    new: true
                }
            ).select("notes");
            
            if(!user){
                throw new ApiError(500, "something went wrong while adding note to user notes");
            }
            
            return res
            .status(201)
            .json(
                new ApiResponse(201,
                    {
                        "url": response?.url,
                        note,
                        "notes": user.notes
                    },
                    "note created successfully")
            )
        }
        else{
            throw new ApiError(400, "audio file is required");
        }
    } catch (error) {
        console.error("Error in createNote:", error);
        throw new ApiError(400, error)
    }
    
})

const createNoteByText = asyncHandler(async (req, res) => {
    const { text } = req.body;
    const userId = req?.user?._id;

    if(!text){
        throw new ApiError(400, "text required for create notes")
    }

    const models = [
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'llama-3.3-70b-versatile',
        'moonshotai/kimi-k2-instruct-0905',
        'llama-3.1-8b-instant',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
    ];

    let notesResponse;
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
                        "role": "system", "content": "You are concise note maker, you have the knowledge about the the text written and also you can explain it well. Your job is to use your existing knowledge and this provided text to make a well detailed notes in simple language in strictly english language which includes almost the whole text. no need of your wordings like <here is the note or something like that>"
                    },
                    {
                        "role": "user", "content": text
                    }
                ]
            })
        });

        notesResponse = await response.json();

        console.log(`Trying model for notes: ${model}`, notesResponse);

        if (!notesResponse.error) {
            modelUsed = model;
            break;
        }

        if (notesResponse.error?.code === 'rate_limit_exceeded') {
            console.log(`Rate limit exceeded for ${model}, trying next model...`);
            continue;
        } else {
            throw new ApiError(501, `API error: ${notesResponse.error?.message || 'Unknown error'}`);
        }
    }

    if(!notesResponse || !notesResponse.choices || notesResponse.choices.length === 0){
        throw new ApiError(501, "something went wrong while creating notes - all models failed or rate limited");
    }

    const modelsfortitle = [
        'moonshotai/kimi-k2-instruct',
        'moonshotai/kimi-k2-instruct-0905',
        'llama-3.1-8b-instant',
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-maverick-17b-128e-instruct',
        'groq/compound'
    ];

    let titleDescriptionResult;
    let titleModelUsed;

    for (const model of modelsfortitle) {
        const titleDescriptionResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { "role": "system", "content": "You are a title and description maker. Your job is to create title and short 1 line descriptions based on the given notes. the response should be in this json format only. {title: <title inside double quotes>, description: <description inside double quotes>}. nothing should be there in the response other than this format, not your wordings like <here is the title and description>" },
                    { "role": "user", "content": notesResponse.choices[0].message.content }
                ]
            })
        });

        titleDescriptionResult = await titleDescriptionResponse.json();

        console.log(`Trying model for title/description: ${model}`, titleDescriptionResult);

        if (!titleDescriptionResult.error) {
            titleModelUsed = model;
            break;
        }

        if (titleDescriptionResult.error?.code === 'rate_limit_exceeded') {
            console.log(`Rate limit exceeded for ${model}, trying next model...`);
            continue;
        } else {
            console.log(`API error for title/description with ${model}, trying next model...`);
            continue;
        }
    }
    
    let title;
    let description;
    
    if(!titleDescriptionResult || !titleDescriptionResult.choices || titleDescriptionResult.choices.length === 0){
        title = "Untitled";
        description = "No description available";
    }
    else{
        // Parse the JSON string to extract title and description
        let parsed;
        try {
            // Remove curly braces if present and parse as JSON
            let content = titleDescriptionResult.choices[0].message.content.trim();
            if (content.startsWith("{") && content.endsWith("}")) {
                parsed = JSON.parse(content);
                title = parsed.title || "Untitled";
                description = parsed.description || "No description available";
            } else {
                title = "Untitled";
                description = "No description available";
            }
        } catch (e) {
            title = "Untitled";
            description = "No description available";
            console.log("Error parsing title and description JSON:", e);
        }
    }
    
    const _id = new mongoose.Types.ObjectId()
    
    const note = await Note.create({
        owner: userId,
        url: "BYTEXT",
        title,
        description,
        noteVersions: [
            {
                content: notesResponse.choices[0].message.content,
                _id
            }
        ],
        starredNoteId: _id
    });
    
    if(!note){
        throw new ApiError(500, "something went wrong while creating note");
    }
    
    const transcript = await Transcript.create({
        noteId: note?._id,
        text: text
    });
    
    if(!transcript){
        throw new ApiError(500, "something went wrong while creating transcript");
    }
    
    const user = await User.findByIdAndUpdate(
        userId,
        {
            $push: {
                notes: note._id
            }
        },
        {
            new: true
        }
    ).select("notes");
    
    if(!user){
        throw new ApiError(500, "something went wrong while adding note to user notes");
    }
    
    return res
    .status(201)
    .json(
        new ApiResponse(201,
            {
                note,
                "notes": user.notes
            },
            "note created successfully")
    )
})

const createNoteByFile = asyncHandler(async (req, res) => {
    const fileBuffer = req.file?.buffer;
    const userId = req?.user?._id;

    const text = await parseFile(fileBuffer);

    if(!text){
        throw new ApiError(400, "failed to parse file for create notes")
    }

    const models = [
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'llama-3.3-70b-versatile',
        'moonshotai/kimi-k2-instruct-0905',
        'llama-3.1-8b-instant',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
    ];

    let notesResponse;
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
                        "role": "system", "content": "You are concise note maker, you have the knowledge about the the text written and also you can explain it well. Your job is to use your existing knowledge and this provided text to make a well detailed notes in simple language in strictly english language which includes almost the whole text. no need of your wordings like <here is the note or something like that>"
                    },
                    {
                        "role": "user", "content": text
                    }
                ]
            })
        });

        notesResponse = await response.json();

        console.log(`Trying model: ${model}`, notesResponse);

        if (!notesResponse.error) {
            modelUsed = model;
            break;
        }

        if (notesResponse.error?.code === 'rate_limit_exceeded') {
            console.log(`Rate limit exceeded for ${model}, trying next model...`);
            continue;
        } else {
            throw new ApiError(501, `API error: ${notesResponse.error?.message || 'Unknown error'}`);
        }
    }

    if(!notesResponse || !notesResponse.choices || notesResponse.choices.length === 0){
        throw new ApiError(501, "something went wrong while creating notes - all models failed or rate limited");
    }

    const modelsfortitle = [
        'moonshotai/kimi-k2-instruct',
        'moonshotai/kimi-k2-instruct-0905',
        'llama-3.1-8b-instant',
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-maverick-17b-128e-instruct',
        'groq/compound'
    ];

    let titleDescriptionResult;
    let titleModelUsed;

    for (const model of modelsfortitle) {
        const titleDescriptionResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { "role": "system", "content": "You are a title and description maker. Your job is to create title and short 1 line descriptions based on the given notes. the response should be in this json format only. {title: <title inside double quotes>, description: <description inside double quotes>}. nothing should be there in the response other than this format, not your wordings like <here is the title and description>" },
                    { "role": "user", "content": notesResponse.choices[0].message.content }
                ]
            })
        });

        titleDescriptionResult = await titleDescriptionResponse.json();

        console.log(`Trying model for title/description: ${model}`, titleDescriptionResult);

        if (!titleDescriptionResult.error) {
            titleModelUsed = model;
            break;
        }

        if (titleDescriptionResult.error?.code === 'rate_limit_exceeded') {
            console.log(`Rate limit exceeded for ${model}, trying next model...`);
            continue;
        } else {
            console.log(`API error for title/description with ${model}, trying next model...`);
            continue;
        }
    }
    
    let title;
    let description;
    
    if(!titleDescriptionResult || !titleDescriptionResult.choices || titleDescriptionResult.choices.length === 0){
        title = "Untitled";
        description = "No description available";
    }
    else{
        // Parse the JSON string to extract title and description
        let parsed;
        try {
            // Remove curly braces if present and parse as JSON
            let content = titleDescriptionResult.choices[0].message.content.trim();
            console.log(content)
            if (content.startsWith("{") && content.endsWith("}")) {
                // Replace single quotes with double quotes if needed
                // content = content.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
                // console.log(content)
                parsed = JSON.parse(content);
                console.log(parsed);
                title = parsed.title || "Untitled";
                description = parsed.description || "No description available";
            } else {
                title = "Untitled";
                description = "No description available";
            }
        } catch (e) {
            title = "Untitled";
            description = "No description available";
            console.log("Error parsing title and description JSON:", e);
        }
    }
    
    const _id = new mongoose.Types.ObjectId();

    const note = await Note.create({
        title,
        description,
        url: "BYTEXT",
        owner: userId,
        noteVersions: [{
            content: notesResponse.choices[0].message.content,
            _id
        }],
        starredNoteId: _id
    })

    await Transcript.create({
        noteId: note?._id,
        text
    })

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $push:{
                notes: note?._id
            }
        },
        {
            new: true
        }
    ).select("notes")

    if(!user){
        throw new ApiError(500, "something went wrong while adding note to user notes");
    }

    return res.status(201).json(
        new ApiResponse(201,
            {
                note,
                "notes": user.notes
            },
            "note created successfully")
    )
})


// const createNote = asyncHandler(async (req, res) => {
//     if(!JSON.stringify(isByAudio)){
//         throw new ApiError("isNyAudio required");
//     }
// })

const starNoteVersion = asyncHandler ( async ( req, res ) => {
    const { noteId, noteVersionId } = req.params;

    if(!(noteId && noteVersionId)){
        throw new ApiError(400, "noteId and noteVersionId are required");
    }

    const note = await Note.findById(noteId);

    if(!note){
        throw new ApiError(404, "Note not found");
    }

    if(!note.owner.equals(req.user._id)){
        throw new ApiError(403, "You are not authorized to star this note");
    }

    // note.noteVersions.map(version => console.log(version._id, noteVersionId, version._id.equals(noteVersionId)))

    // console.log(note.noteVersions)

    // print version._id for each noteversion

    if(!note.noteVersions.some(version => version._id && version._id.toString() === String(noteVersionId))){
        throw new ApiError(404, "Note version not found");
    }

    await Note.findByIdAndUpdate(noteId, {
        starredNoteId: noteVersionId
    });

    return res.status(200).json(
        new ApiResponse(200, "", "note starred successfully")
    );
})

const getNoteVersions = asyncHandler (async (req, res) => {
    const { noteId } = req.params;

    if(!noteId){
        throw new ApiError(400, "noteId is required");
    }

    const note = await Note.findById(noteId);

    if(!note){
        throw new ApiError(404, "Note not found");
    }

    if(!note.owner.equals(req.user._id)){
        throw new ApiError(403, "You are not authorized to view this note");
    }

    return res.status(200).json(
        new ApiResponse(200, {versions: note.noteVersions, starredVersionId: note.starredNoteId, createdAt: note.createdAt}, "note versions fetched successfully")
    );
})

const updateNoteInfo = asyncHandler( async (req, res) => {
    const { title, description, isPublic, content } = req.body;
    const { noteId } = req.params;

    // console.log(content);

    if(!(title || description || isPublic.toString() || content)){
        throw new ApiError(400, "title or description or content required")
    }

    if(isPublic && typeof isPublic !== "boolean"){
        throw new ApiError(400, "isPublic should be Boolean");
    }

    const note = await Note.findById(noteId);

    if(!note){
        throw new ApiError(404, "Note not found");
    }

    if(!note.owner.equals(req?.user?._id)){
        throw new ApiError(401, "you are not authorized to edit title or description of this note")
    }

    note.title = title || note.title;
    note.description = description || note.description;
    
    content && note.noteVersions.forEach( version => {
        if(version._id.equals(note.starredNoteId)){
            version.content = content;
        }
    })

    if(isPublic.toString()){
        if(isPublic){
            note.isPublic = true;
        }
        else{
            note.isPublic = false;
        }
    }

    await note.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, "", "title or description updated")
    )
})

const getNotes = asyncHandler( async (req, res) => {
    
    const userId = req.user._id;

    const user = await User.aggregate([
        {
            $match: {
                _id: userId
            }
        },
        {
            $lookup: {
                from: "notes",
                localField: "notes",
                foreignField: "_id",
                as: "notes",
                pipeline: [
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            isPublic: 1,
                            note: {
                                $filter: {
                                    input: '$noteVersions',
                                    as: 'version',
                                    cond: {
                                        $eq: ['$$version._id', '$starredNoteId']
                                    }
                                }
                            },
                            createdAt: 1
                        }
                    },
                    {
                        $addFields: {
                            note: {
                                $arrayElemAt: ['$note.content', 0]
                            }
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                notesCount: {
                    $size: "$notes"
                }
            }
        },
        {
            $project: {
                _id: 1,
                notesCount: 1,
                notes: 1
            }
        }
    ])

    if (!user){
        throw new ApiError(404, "no history found")
    }
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, {notes: user[0].notes, notesCount: user[0].notesCount}, "notes history fetch successfully")
    )
})

const getAllNotesByUsername = asyncHandler( async (req, res) => {
    const {username } = req.params;
    
    if(!username){
        throw new ApiError(400, "username is required");
    }

    const user = await User.findOne({ username: username.trim() }).select("_id fullname username avatar coverImage");

    if(!user){
        throw new ApiError(404, "User not found");
    }

    // const notes = await Note.find({ owner: user._id, isPublic: true });
    // const notes = await Note.aggregate([
    //     {
    //         $match: {
    //             owner: user._id,
    //             isPublic: true
    //         }
    //     },
    //     {
    //         $project: {
    //             title: 1,
    //             description: 1,
    //             note: {
    //                 $filter: {
    //                     input: 'noteVersions',
    //                     as: 'version',
    //                     cond: {
    //                         $eq: ['$$version._id', '$starredNoteId']
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // ])  // slower i think. notes have larger amount than just user, and this will check for each document whether owner is given username or not..

    const notes = await User.aggregate([
        {
            $match: {
                username: username.trim()
            }
        },
        {
            $lookup: {
                from: 'notes',
                localField: 'notes',
                foreignField: '_id',
                as: 'notes',
                pipeline: [
                    {
                        $match: {
                            isPublic: true
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            createdAt: 1
                            // note: {       // we will dynamically fetch after user click on any single note with title..
                            //     $filter: {
                            //         input: 'noteVersions',
                            //         as: 'version',
                            //         cond: {
                            //             $eq: ['$$version._id', '$starredNoteId']
                            //         }
                            //     }
                            // }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                username: 1,
                fullname: 1,
                avatar: 1,
                coverImage: 1,
                notes: 1
            }
        }
    ])

    return res.status(200).json(
        new ApiResponse(200, notes, "User notes fetched successfully")
    );
})

const getNoteById = asyncHandler(async (req, res) => {
    const { noteId } = req.params;

    if(!noteId){
        throw new ApiError(400, "note id is required");
    }
    
    const note = await Note.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(noteId),
                $or: [
                    {owner: req?.user?._id},
                    {isPublic: true}
                ]
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'owner',
                foreignField: '_id',
                as: 'owner',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: '$owner'
                }
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                note: {
                    $filter: {
                        input: '$noteVersions',
                        as: 'version',
                        cond: { $eq: ['$$version._id', '$starredNoteId'] }
                    }
                },
                createdAt: 1,
                owner: 1,
            }
        },
        {
            $addFields: {
                note: {
                    $arrayElemAt: ['$note.content', 0]
                }
            }
        },
    ]);

    if(!note || note.length === 0){
        throw new ApiError(404, "note not found")
    }

    return res.status(200).json(
        new ApiResponse(200, note, "note fetched successfully")
    )

            
} )

const deleteNote = asyncHandler( async (req, res) => {
    
    const noteId = req.params.noteId;
    
    const note = await Note.findById(noteId);
    
    if(!note){
        throw new ApiError(404, "Note not found");
    }
    
    if(!note.owner.equals(req.user._id)){
            throw new ApiError(403, "You are not authorized to delete this note");
    }

    await Note.findByIdAndDelete(noteId);

    await Transcript.deleteOne({noteId: noteId})

    if(note.url !== "BYTEXT"){
        let publicId = note.url.split("/").pop().split(".")[0];
        await deleteCloudinaryVideo(AUDIO_PATH + publicId)
    }
    

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $pull: {
                notes: noteId
            }
        }
    );

    return res.status(200).json(
        new ApiResponse(200, "", "note deleted successfully")
    );
})

const createNewVersionNote = asyncHandler( async (req, res) => {
    const noteId = req.params.noteId;
    const userId = req.user._id;

    const note = await Note.findById(noteId);

    if(!note){
        throw new ApiError(404, "Note not found");
    }

    if(!note.owner.equals(req.user._id)){
        throw new ApiError(403, "You are not authorized to create a new version of this note");
    }

    const transcript = await Transcript.findOne({ noteId });

    if(!transcript){
        throw new ApiError(404, "Transcript not found, user has to upload audio again");
    }

    const title = note.title;
    const description = note.description;

    const models = [
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'llama-3.3-70b-versatile',
        'moonshotai/kimi-k2-instruct-0905',
        'llama-3.1-8b-instant',
        'meta-llama/llama-4-maverick-17b-128e-instruct'
    ];

    let notesResponse;
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
                    { "role": "system", "content": `You are a concise note-maker, you have the knowledge about the ${title} regarding ${description} and also you can explain it well. Your job is to use your existing knowledge and this provided transcript to make a well detailed notes in simple language in strictly english language which includes almost the whole transcript. no need of your wordings like <here is the note or something like that>` },
                    { "role": "user", "content": transcript.text }
                ]
            })
        });

        notesResponse = await response.json();

        console.log(`Trying model for new version: ${model}`, notesResponse);

        if (!notesResponse.error) {
            modelUsed = model;
            break;
        }

        if (notesResponse.error?.code === 'rate_limit_exceeded') {
            console.log(`Rate limit exceeded for ${model}, trying next model...`);
            continue;
        } else {
            throw new ApiError(500, `API error: ${notesResponse.error?.message || 'Unknown error'}`);
        }
    }

    if(!notesResponse || !notesResponse.choices || notesResponse.choices.length === 0){
        throw new ApiError(500, "something went wrong while generating notes - all models failed or rate limited");
    }

    const generatedNotes = notesResponse.choices[0].message.content;

    const _id = new mongoose.Types.ObjectId()

    const newNoteVersion = await Note.findByIdAndUpdate(
        noteId,
        {
            $push: {
                noteVersions: {
                    content: generatedNotes,
                    _id
                }
            }
        },
        {
            new: true
        }
    );

    return res.status(201).json(
        new ApiResponse(201, newNoteVersion, "note created successfully")
    );
})

const deleteNoteVersion = asyncHandler( async (req, res) => {
    const noteId = req.params.noteId;
    const noteVersionId = req.params.noteVersionId;

    const note = await Note.findById(noteId);

    if(!note){
        throw new ApiError(404, "Note not found");
    }

    if(!note.owner.equals(req.user._id)){
        throw new ApiError(403, "You are not authorized to delete this note");
    }

    if(note.noteVersions.length === 1){
        throw new ApiError(400, "You cannot delete the last version of a note");
    }

    if(note.starredNoteId.equals(noteVersionId)){
        throw new ApiError(400, "You cannot delete a starred note. Please star other note first.");
    }

    if(!note.noteVersions.some(version => version._id.equals(noteVersionId))){
        throw new ApiError(404, "Note version not found");
    }

    note.noteVersions.pull({_id: noteVersionId});

    await note.save();

    return res.status(200).json(
        new ApiResponse(200, "", "Note version deleted successfully")
    );
})

const getPublicNotes = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'newest';
    const filterBy = req.query.filterBy || 'all';
    const search = req.query.search || '';

    console.log("search", search)
    
    const skip = (page - 1) * limit;
    
    if (page < 1) {
        throw new ApiError(400, "Page number must be greater than 0");
    }
    
    if (limit < 1 || limit > 100) {
        throw new ApiError(400, "Limit must be between 1 and 100");
    }

    let filterQuery = { isPublic: true };
    
    if (search) {
        filterQuery.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }
    
    if (filterBy !== 'all') {
        const now = new Date();
        let dateFilter;
        
        switch (filterBy) {
            case 'today':
                dateFilter = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                dateFilter = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                dateFilter = new Date(now.setDate(now.getDate() - 30));
                break;
        }
        
        if (dateFilter) {
            filterQuery.createdAt = { $gte: dateFilter };
        }
    }

    let sortQuery = {};
    
    switch (sortBy) {
        case 'newest':
            sortQuery = { createdAt: -1 };
            break;
        case 'most-clapped':
            sortQuery = { totalClaps: -1, createdAt: -1 };
            break;
        case 'trending':
            break;
        default:
            sortQuery = { createdAt: -1 };
    }

    const aggregationPipeline = [
        { $match: filterQuery },
    ];

    if (sortBy === 'trending') {
        aggregationPipeline.push({
            $addFields: {
                trendingScore: {
                    $add: [
                        {
                            $multiply: [
                                {
                                    $divide: [
                                        { $subtract: [new Date(), "$createdAt"] },
                                        1000 * 60 * 60 * 24
                                    ]
                                },
                                -1
                            ]
                        },
                        { $multiply: [{ $ifNull: ["$totalClaps", 0] }, 0.1] }
                    ]
                }
            }
        });
    }

    aggregationPipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "author"
        }
    });

    aggregationPipeline.push({
        $lookup: {
            from: "claps",
            localField: "_id",
            foreignField: "noteId",
            as: "claps"
        }
    });

    aggregationPipeline.push({
        $addFields: {
            totalClaps: { $sum: "$claps.claps" }
        }
    });

    if (sortBy === 'trending') {
        aggregationPipeline.push({
            $addFields: {
                trendingScore: {
                    $add: [
                        {
                            $multiply: [
                                {
                                    $divide: [
                                        { $subtract: [new Date(), "$createdAt"] },
                                        1000 * 60 * 60 * 24
                                    ]
                                },
                                -1
                            ]
                        },
                        { $multiply: ["$totalClaps", 0.1] }
                    ]
                }
            }
        });
    }

    if (sortBy === 'trending') {
        aggregationPipeline.push({ $sort: { trendingScore: 1 } });
    } else {
        aggregationPipeline.push({ $sort: sortQuery });
    }

    aggregationPipeline.push({
        $project: {
            title: 1,
            description: 1,
            createdAt: 1,
            totalClaps: 1,
            tags: 1,
            isPublic: 1,
            author: {
                $arrayElemAt: [
                    {
                        $map: {
                            input: "$author",
                            as: "user",
                            in: {
                                _id: "$$user._id",
                                fullname: "$$user.fullname",
                                username: "$$user.username",
                                avatar: "$$user.avatar"
                            }
                        }
                    },
                    0
                ]
            }
        }
    });

    aggregationPipeline.push({ $skip: skip }, { $limit: limit });

    const notes = await Note.aggregate(aggregationPipeline);
    
    const countPipeline = [
        { $match: filterQuery },
        { $count: "total" }
    ];
    const countResult = await Note.aggregate(countPipeline);
    const totalNotes = countResult[0]?.total || 0;

    const totalPages = Math.ceil(totalNotes / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    const hasMore = hasNextPage;

    const response = {
        notes,
        pagination: {
            currentPage: page,
            totalPages,
            totalNotes,
            notesPerPage: limit,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null
        },
        hasMore,
        filters: {
            sortBy,
            filterBy,
            search
        }
    };

    return res.status(200).json(
        new ApiResponse(200, response, "Public notes fetched successfully")
    );
});


export {
    createNote,
    getNoteVersions,
    starNoteVersion,
    getNotes,
    deleteNote,
    createNewVersionNote,
    deleteNoteVersion,
    getAllNotesByUsername,
    getNoteById,
    updateNoteInfo,
    getPublicNotes,
    createNoteByText,
    createNoteByFile
}