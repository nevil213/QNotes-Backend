import { Clap } from "../models/clap.model.js";
import { Note } from "../models/note.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const increaseClap = asyncHandler(async (req, res, next) => {
    try {
        const { noteId } = req.params;
        const { amount } = req.body;

        if (!(noteId && amount)) {
            throw new ApiError(400, "Note ID & amount is required");
        }

        
        if(amount <= 0){
            throw new ApiError(400, "amount should be positive")
        }

        const note = await Note.findById(noteId);

        if (!note) {
            throw new ApiError(404, "Note not found");
        }

        const oldClap = await Clap.findOne({owner: req?.user?._id, noteId});

        if(!oldClap){
            const clap = await Clap.create({
                noteId,
                owner: req?.user?._id,
                claps: amount
            })
            await clap.save();
        }
        else{
            oldClap.claps = Math.min(oldClap.claps + amount, 50);
            await oldClap.save();
        }

        return res.status(200).json(
            new ApiResponse(200, "", "Clap increased successfully")
        );

    } catch (error) {
        next(error);
    }
});

const decreaseClap = asyncHandler(async (req, res, next) => {
    try {
        const { noteId } = req.params;
        const { amount } = req.body;

        if (!(noteId && amount)) {
            throw new ApiError(400, "Note ID & amount is required");
        }

        if(amount <= 0){
            throw new ApiError(400, "amount should be positive")
        }

        const note = await Note.findById(noteId);

        if (!note) {
            throw new ApiError(404, "Note not found");
        }

        const oldClap = await Clap.findOne({owner: req?.user?._id, noteId});

        if(oldClap){
            const a = Math.max(oldClap.claps - amount, 0);
            if(a == 0){
                await Clap.deleteOne({noteId, owner: req?.user?._id});
            }
            else{
                oldClap.claps = a;
                await oldClap.save();
            }
        }

        return res.status(200).json(
            new ApiResponse(200, "", "Clap decreased successfully")
        );

    } catch (error) {
        next(error);
    }
});

const getClaps = asyncHandler(async (req, res) => {
    const { noteId } = req.params;

    if(!noteId){
        throw new ApiError(400, "note id required");
    }

    const note = await Note.findById(noteId);

    if (!note) {
        throw new ApiError(404, "Note not found");
    }

    const userClaps = await Clap.findOne({owner: req?.user?._id, noteId});

    // console.log(userClaps)

    const allClaps = await Clap.find({noteId});

    let claps = 0;

    allClaps.forEach(clap => {
        claps+=clap.claps;
    });

    return res.status(200).json(
        new ApiResponse(200, { userClaps: userClaps?.claps || 0,  totalClaps: claps }, "claps getched successfully")
    )

})

export {
    increaseClap,
    decreaseClap,
    getClaps
}