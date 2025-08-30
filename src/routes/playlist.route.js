import { Router } from "express";
import { addNote, createPlaylist, deletePlaylist, getNotesByPlaylistId, getPlaylistByUsername, getPlaylistsByUser, removeNote, updatePlaylistInfo } from "../controllers/playlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getUserPlaylists } from "../../../Learn Backend with js/Project/src/controllers/playlist.controller.js";

const router = Router();

const customverifyJWT = (req, res, next) => {
    verifyJWT(req, res, function (err) {
        next();
    });
};

router.route("/create-playlist").post(verifyJWT, createPlaylist);
router.route("/add-note/:playlistId/:noteId").put(verifyJWT, addNote);
router.route("/update-playlist/:playlistId").patch(verifyJWT, updatePlaylistInfo);
router.route("/delete-playlist/:playlistId").delete(verifyJWT, deletePlaylist);
router.route("/remove-note/:playlistId/:noteId").delete(verifyJWT, removeNote);
router.route("/get-playlist-by-user").get(verifyJWT, getPlaylistsByUser);
router.route("/get-playlist-by-username/:username").get(getPlaylistByUsername);
router.route("/get-playlist/:playlistId").get(customverifyJWT, getNotesByPlaylistId);


export default router;