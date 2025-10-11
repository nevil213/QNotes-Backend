import { Router } from "express";

import { createNote,
    starNoteVersion,
    getNotes,
    deleteNote,
    createNewVersionNote,
    deleteNoteVersion,
    updateNoteInfo,
    getNoteById,
    getAllNotesByUsername,
    getNoteVersions,
    getPublicNotes,
    createNoteByText} from "../controllers/note.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";


const customverifyJWT = (req, res, next) => {
    verifyJWT(req, res, function (err) {
        next();
    });
};


const router = Router();



// new routes
router.route("/create-note").post(
    verifyJWT,
    upload.single("audio"),
    createNote)

router.route("/create-note-by-text").post(
    verifyJWT,
    createNoteByText)

router.route("/get-note-versions/:noteId").get(verifyJWT, getNoteVersions);

router.route("/star-note/:noteId/:noteVersionId").patch(verifyJWT, starNoteVersion);

router.route("/delete-note/:noteId").delete(verifyJWT, deleteNote);

router.route("/get-notes").get(verifyJWT, getNotes);

router.route("/create-new-version-note/:noteId").post(
    verifyJWT,
    createNewVersionNote
);

router.route("/delete-note-version/:noteId/:noteVersionId").delete(verifyJWT, deleteNoteVersion);

router.route("/u/:username").get(getAllNotesByUsername);

router.route("/n/:noteId").get(customverifyJWT, getNoteById);

router.route("/update-noteinfo/:noteId").patch(verifyJWT, updateNoteInfo);

router.route("/public-notes").get(getPublicNotes);



export default router;