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
            
            
            const noteBlob = new Blob([processedBuffer], { type: "audio/mp3" });
            
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
            
            // console.log(response)
            
            const result = await transcriptResponse.json();
            
            if(!result || !result.text){
                throw new ApiError(400, "audio processing failed");
            }
            
            const notesResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { "role": "system", "content": "You are a concise note-maker, you have the knowledge about the topic explained in the transcript and also you can explain it well. Your job is to use your existing knowledge and this provided transcript to make a well detailed notes in simple language in english which includes almost whole the transcript. no need of your wordings like <here is the note or something like that>" },
                        { "role": "user", "content": result.text }
                    ]
                })
            });
            
            
            const notesResult = await notesResponse.json();
            
            if(!notesResult || !notesResult.choices || notesResult.choices.length === 0){
                throw new ApiError(400, "notes generation failed");
            }
            console.log(notesResult.choices[0].message);
            
            const titleDescriptionResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { "role": "system", "content": "You are a title and description maker. Your job is to create title and short 1 line descriptions based on the given notes. the response should be in this json format only. {title: <title inside double quotes>, description: <description inside double quotes>}. nothing should be there in the response other than this format, not your wordings like <here is the title and description>" },
                        { "role": "user", "content": notesResult.choices[0].message.content }
                    ]
                })
            });
            
            const titleDescriptionResult = await titleDescriptionResponse.json();
            
            console.log(titleDescriptionResult.choices[0].message.content);
            
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
                        // Replace single quotes with double quotes if needed
                        content = content.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
                        parsed = JSON.parse(content);
                        // console.log(parsed);
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
            
            // if(result && result.text){
                //     return res.status(201).json(
                    //         new ApiResponse(201, result.text, "audio proccessed successfully")
                    //     )
                    // }            
                    
                    // console.log(title, description, response?.url);

                    const id = new mongoose.Types.ObjectId()
                    
                    const note = await Note.create({
                        owner: userId,
                        url: response?.url,
                        title,
                        description,
                        noteVersions: [
                            {
                                content: notesResult.choices[0].message.content,
                                id
                            }
                        ],
                        starredNoteId: id
                    });
                    
                    if(!note){
                        throw new ApiError(500, "something went wrong while creating note");
                    }
                    
                    const transcript = await Transcript.create({
                        noteId: note?._id,
                        text: notesResult.choices[0].message.content
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
                    throw new ApiError(400, error)
                }
                
            })
            

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

    if(!note.noteVersions.some(version => version.id.equals(noteVersionId))){
        throw new ApiError(404, "Note version not found");
    }

    await Note.findByIdAndUpdate(noteId, {
        starredNoteId: noteVersionId
    });

    return res.status(200).json(
        new ApiResponse(200, "", "note starred successfully")
    );
})

const updateNoteInfo = asyncHandler( async (req, res) => {
    const { title, description, isPublic } = req.body;
    const { noteId } = req.params;

    if(!(title || description || isPublic.toString())){
        throw new ApiError(400, "title or description required")
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
                                        $eq: ['$$version.id', '$starredNoteId']
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
    //                         $eq: ['$$version.id', '$starredNoteId']
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
                            // note: {       // we will dynamically fetch after user click on any single note with title..
                            //     $filter: {
                            //         input: 'noteVersions',
                            //         as: 'version',
                            //         cond: {
                            //             $eq: ['$$version.id', '$starredNoteId']
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
            $project: {
                title: 1,
                description: 1,
                note: {
                    $filter: {
                        input: '$noteVersions',
                        as: 'version',
                        cond: ['$$version.id', '$starredNoteId']
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
    
    let publicId = note.url.split("/").pop().split(".")[0];

    await deleteCloudinaryVideo(AUDIO_PATH + publicId)

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

    let notesResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { "role": "system", "content": `You are a concise note-maker, you have the knowledge about the ${title} regarding ${description} and also you can explain it well. Your job is to use your existing knowledge and this provided transcript to make a well detailed notes in simple language in english which includes almost the whole transcript. no need of your wordings like <here is the note or something like that>` },
                { "role": "user", "content": transcript.text }
            ]
        })
    });

    notesResponse = await notesResponse.json();

    // console.log(notesResponse);

    if(!notesResponse || !notesResponse.choices || notesResponse.choices.length === 0){
        throw new ApiError(500, "something went wrong while generating notes");
    }

    const generatedNotes = notesResponse.choices[0].message.content;

    const newNoteVersion = await Note.findByIdAndUpdate(
        noteId,
        {
            $push: {
                noteVersions: {
                    content: generatedNotes,
                    id: new mongoose.Types.ObjectId()
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

    if(!note.noteVersions.some(version => version.id.equals(noteVersionId))){
        throw new ApiError(404, "Note version not found");
    }

    note.noteVersions.pull({id: noteVersionId});

    await note.save();

    return res.status(200).json(
        new ApiResponse(200, "", "Note version deleted successfully")
    );
})


export {
    createNote,
    starNoteVersion,
    getNotes,
    deleteNote,
    createNewVersionNote,
    deleteNoteVersion,
    getAllNotesByUsername,
    getNoteById,
    updateNoteInfo
}