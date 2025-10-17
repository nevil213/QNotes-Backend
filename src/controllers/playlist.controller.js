import mongoose from "mongoose";
import { Note } from "../models/note.model.js";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const createPlaylist = asyncHandler( async (req, res, next) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            throw new ApiError(400, "Name and description are required");
        }

        const playlist = await Playlist.create({
            name,
            description,
            owner: req?.user?.id
        });

        return res.status(201).json(
            new ApiResponse(201, playlist, "Playlist created successfully")
        );
    } catch (error) {
        next(error);
    }
});


const addNote = asyncHandler( async (req, res, next) => {
    try {
        const { playlistId } = req.params;
        let { noteId } = req.params;

        noteId = new mongoose.Types.ObjectId(noteId);

        if (!noteId || !playlistId) {
            throw new ApiError(400, "Note ID and playlist ID are required");
        }

        const playlist = await Playlist.findById(playlistId);

        if (!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if(!playlist.owner.equals(req.user._id)) {
            throw new ApiError(403, "You are not authorized to add notes to this playlist");
        }

        if(playlist.notes.includes(noteId)) {
            throw new ApiError(400, "Note is already in the playlist");
        }

        const note = await Note.find({
            _id: noteId,
            $or: [{isPublic: true}, {owner: req.user._id}]
        });

        if(!note || note.length === 0) {
            throw new  ApiError(400, "note not found")
        }

        playlist.notes.push(noteId);
        await playlist.save();

        return res.status(200).json(
            new ApiResponse(200, playlist, "Notes added to playlist successfully")
        );
    } catch (error) {
        next(error);
    }
});

const updatePlaylistInfo = asyncHandler( async (req, res, next) => {
    try {
        const { playlistId } = req.params;
        const { name, description, isPublic } = req.body;

        if (!(name || description || isPublic)) {
            throw new ApiError(400, "Name, description or visibility are required");
        }

        const playlist = await Playlist.findById(playlistId);

        if (!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if (!playlist.owner.equals(req.user._id)) {
            throw new ApiError(403, "You are not authorized to update this playlist");
        }

        playlist.name = name || playlist.name;
        playlist.description = description || playlist.description;
        if(isPublic !== undefined && isPublic != playlist.isPublic){
            playlist.isPublic = isPublic;
        }
        await playlist.save();

        return res.status(200).json(
            new ApiResponse(200, playlist, "Playlist updated successfully")
        );
    } catch (error) {
        next(error);
    }
});

const deletePlaylist = asyncHandler( async (req, res, next) => {
    try {
        const { playlistId } = req.params;

        const playlist = await Playlist.findById(playlistId);

        if (!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if (!playlist.owner.equals(req.user._id)) {
            throw new ApiError(403, "You are not authorized to delete this playlist");
        }

        await playlist.deleteOne({ _id: playlistId });

        return res.status(200).json(
            new ApiResponse(200, null, "Playlist deleted successfully")
        );
    } catch (error) {
        next(error);
    }
});

const removeNote = asyncHandler( async (req, res, next) => {
    try {
        const { playlistId, noteId } = req.params;

        if (!noteId || !playlistId) {
            throw new ApiError(400, "Note ID and Playlist ID are required");
        }

        const playlist = await Playlist.findById(playlistId);

        if (!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if (!playlist.owner.equals(req.user._id)) {
            throw new ApiError(403, "You are not authorized to remove notes from this playlist");
        }

        if(!playlist.notes.includes(noteId)) {
            throw new ApiError(400, "Note is not in the playlist");
        }

        playlist.notes.pull(noteId);

        await playlist.save();

        return res.status(200).json(
            new ApiResponse(200, playlist, "Note removed from playlist successfully")
        );
    } catch (error) {
        next(error);
    }
});

const getPlaylistsByUser = asyncHandler( async (req, res, next) => {
    try {
        const userId = req?.user?.id;

        const playlists = await Playlist.find({ owner: userId });
        
        return res.status(200).json(
            new ApiResponse(200, playlists, "Playlists retrieved successfully")
        );
    } catch (error) {
        next(error);
    }
});

const getPlaylistByUsername = asyncHandler(async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username });
    if (!user) {
        return res.status(404).json(
            new ApiResponse(404, null, "User not found")
        );
    }

    const playlists = await Playlist.find({ owner: user._id, isPublic: true });

    if(playlists.length === 0) {
        return res.status(404).json(
            new ApiResponse(404, null, "No public playlists found")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, playlists, "Playlists retrieved successfully")
    );
})


const getNotesByPlaylistId = asyncHandler( async (req, res, next) => {
    try {
        const { playlistId } = req.params;

        if (!playlistId) {
            throw new ApiError(400, "Playlist ID is required");
        }

        const checkPlaylist = await Playlist.findById(playlistId);
        if (!checkPlaylist) {
            throw new ApiError(404, "Playlist not found");
        }

        // console.log(req?.user?._id);

        const notes = await Playlist.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(playlistId),
                    $or: [
                        {owner: new mongoose.Types.ObjectId(req?.user?._id)},
                        {isPublic: true}
                    ]
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
                                $or: [
                                    { isPublic: true },
                                    { owner: new mongoose.Types.ObjectId(req?.user?._id) }
                                ]
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                title: 1,
                                description: 1,
                                // note: {           // will dynamically fetch when user clicks on note id
                                //     $filter: {
                                //         input: "noteVersions",
                                //         as: "version",
                                //         cond: {
                                //             $eq: ["$$version._id", "starredNoteId"]
                                //         }
                                //     }
                                // },
                                isPublic: 1,
                                createdAt: 1,
                                // owner: {
                                //     $arrayElemAt: ["$owner", 0]
                                // }
                            }
                        }
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
        ])

        return res.status(200).json(
            new ApiResponse(200, notes[0], "Playlist retrieved successfully")
        );
    } catch (error) {
        next(error);
    }
});

export {
    createPlaylist,
    addNote,
    updatePlaylistInfo,
    deletePlaylist,
    removeNote,
    getPlaylistsByUser,
    getPlaylistByUsername,
    getNotesByPlaylistId,
}